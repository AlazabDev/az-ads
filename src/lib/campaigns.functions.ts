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
].join("\n");

async function callAzure(messages: { role: string; content: string }[]) {
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
    z.object({ campaignId: z.string().uuid(), content: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Insert user message
    const { error: uErr } = await supabase.from("campaign_messages").insert({
      campaign_id: data.campaignId,
      user_id: userId,
      role: "user",
      content: data.content,
    });
    if (uErr) throw new Error(uErr.message);

    // Load full history for context
    const { data: history, error: hErr } = await supabase
      .from("campaign_messages")
      .select("role,content")
      .eq("campaign_id", data.campaignId)
      .order("created_at", { ascending: true });
    if (hErr) throw new Error(hErr.message);

    const reply = await callAzure(history ?? []);

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