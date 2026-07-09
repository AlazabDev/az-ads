import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STUDIO_SYSTEM = [
  'أنت "AdForge Copilot" — مساعد إبداعي عربي متخصص في صناعة المواد الإعلانية (نصوص، أفكار صور، سيناريوهات فيديو، خطط نشر) للمنصات: فيسبوك، إنستغرام، تيك توك، واتساب، تيليجرام.',
  "• ردّ دائماً بالعربية الفصحى الواضحة ما لم يطلب المستخدم غير ذلك.",
  "• كن موجزاً ومنظّماً: استخدم عناوين وقوائم عند الحاجة.",
  '• عند طلب "نص إعلاني" قدّم: عنوان، وصف قصير، دعوة للفعل (CTA).',
  '• عند طلب "أفكار صور" قدّم 3-5 أفكار Prompt جاهزة للاستخدام في مولّدات الصور (بالإنجليزية داخل كتلة كود).',
  '• عند طلب "سكربت فيديو" قسّمه إلى مشاهد مرقّمة مع مدة وحوار وتوجيه بصري.',
  "• إذا أُرفقت صور مع رسالة المستخدم فاستعن بها كأصول بصرية حقيقية للعلامة/المنتج: صف ما تراه، واربطه بالنص الإعلاني، واستخدم تفاصيله (ألوان، تكوين، نمط) لاقتراحات مخصصة.",
].join("\n");

type AzureMessage = { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };

async function callAzure(messages: AzureMessage[]) {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-5.5";
  const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || "2024-10-21";
  if (!endpoint || !apiKey) {
    throw new Error("Azure AI Foundry غير مُعدّ.");
  }
  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      messages: [{ role: "system", content: STUDIO_SYSTEM }, ...messages],
      temperature: 0.8,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure Foundry [${res.status}]: ${body.slice(0, 400)}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "") as string;
}

const BRAND_BUCKET = "Alazab-Ads";

function publicAssetUrl(path: string) {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BRAND_BUCKET}/${path}`;
}

export const listBrandAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        prefix: z.string().optional().default("raw_images"),
        limit: z.number().int().min(1).max(200).optional().default(60),
        offset: z.number().int().min(0).optional().default(0),
        search: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.storage
      .from(BRAND_BUCKET)
      .list(data.prefix, {
        limit: data.limit,
        offset: data.offset,
        sortBy: { column: "created_at", order: "desc" },
        search: data.search,
      });
    if (error) throw new Error(error.message);
    const items = (rows ?? [])
      .filter((r) => r.name && !r.name.endsWith("/") && r.metadata)
      .map((r) => {
        const path = data.prefix ? `${data.prefix}/${r.name}` : r.name;
        return {
          name: r.name,
          path,
          url: publicAssetUrl(path),
          size: (r.metadata as { size?: number })?.size ?? 0,
          mimetype: (r.metadata as { mimetype?: string })?.mimetype ?? "",
        };
      });
    return { items, hasMore: items.length === data.limit };
  });

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("id,title,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: campaign, error: e1 } = await context.supabase
      .from("campaigns")
      .select("id,title,created_at,updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!campaign) throw new Error("الحملة غير موجودة");
    const { data: messages, error: e2 } = await context.supabase
      .from("campaign_messages")
      .select("id,role,content,created_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { campaign, messages: messages ?? [] };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().min(1).max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .insert({ user_id: context.userId, title: data.title ?? "حملة جديدة" })
      .select("id,title,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendCampaignMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaignId: z.string().uuid(),
        content: z.string().min(1),
        attachments: z.array(z.string().url()).max(6).optional().default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Persist user message. Attachments are appended as markdown image links so
    // they render in history and stay tied to the message that used them.
    const attachmentBlock = data.attachments.length
      ? "\n\n" + data.attachments.map((u) => `![مرفق](${u})`).join("\n")
      : "";
    const storedUserContent = data.content + attachmentBlock;
    const { error: uErr } = await supabase.from("campaign_messages").insert({
      campaign_id: data.campaignId,
      user_id: userId,
      role: "user",
      content: storedUserContent,
    });
    if (uErr) throw new Error(uErr.message);

    // Load full history for context
    const { data: history, error: hErr } = await supabase
      .from("campaign_messages")
      .select("role,content")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    // Rebuild messages for the model. Convert prior stored messages to text and
    // upgrade the LAST user message to multimodal when attachments are present.
    const msgs: AzureMessage[] = (history ?? []).map((m) => ({ role: m.role, content: m.content }));
    if (data.attachments.length && msgs.length) {
      const last = msgs[msgs.length - 1];
      last.content = [
        { type: "text", text: data.content },
        ...data.attachments.map((url) => ({ type: "image_url", image_url: { url } })),
      ];
    }
    const reply = await callAzure(msgs);

    const { data: assistantRow, error: aErr } = await supabase
      .from("campaign_messages")
      .insert({
        campaign_id: data.campaignId,
        user_id: userId,
        role: "assistant",
        content: reply,
      })
      .select("id,role,content,created_at")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Auto-title from first user message
    const { data: camp } = await supabase
      .from("campaigns")
      .select("title")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (camp && camp.title === "حملة جديدة") {
      const newTitle = data.content.slice(0, 60);
      await supabase.from("campaigns").update({ title: newTitle }).eq("id", data.campaignId);
    } else {
      await supabase.from("campaigns").update({ updated_at: new Date().toISOString() }).eq("id", data.campaignId);
    }

    return { assistant: assistantRow };
  });