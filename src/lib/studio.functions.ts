import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BRAND_BUCKET = "Alazab-Ads";

function publicUrl(path: string) {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BRAND_BUCKET}/${path}`;
}

// ---------- List generated assets ----------
export const listStudioAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("studio_assets")
      .select("id,kind,prompt,public_url,storage_path,model,width,height,created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteStudioAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: e1 } = await context.supabase
      .from("studio_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (row?.storage_path) {
      await context.supabase.storage.from(BRAND_BUCKET).remove([row.storage_path]);
    }
    const { error } = await context.supabase.from("studio_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Brand asset uploads (raw_images) ----------
export const deleteBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.storage.from(BRAND_BUCKET).remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI image generation via Lovable AI Gateway ----------
const GenInput = z.object({
  prompt: z.string().min(3).max(1500),
  reference_urls: z.array(z.string().url()).max(4).optional().default([]),
  aspect_ratio: z.enum(["1:1", "4:5", "9:16", "16:9", "3:4", "4:3"]).optional().default("1:1"),
  variants: z.number().int().min(1).max(4).optional().default(1),
});

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function extractBase64Image(json: unknown): { dataUrl: string; mime: string } | null {
  // Try common OpenAI-compatible shapes
  const j = json as Record<string, unknown>;
  const choices = j.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (msg) {
    const images = msg.images as Array<Record<string, unknown>> | undefined;
    const img0 = images?.[0];
    if (img0) {
      const iu = img0.image_url as Record<string, unknown> | undefined;
      const url = (iu?.url ?? img0.url) as string | undefined;
      if (url?.startsWith("data:")) {
        const mime = url.slice(5, url.indexOf(";")) || "image/png";
        return { dataUrl: url, mime };
      }
    }
    // content parts variant
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === "image_url" && typeof part?.image_url?.url === "string") {
          const url = part.image_url.url as string;
          if (url.startsWith("data:")) {
            const mime = url.slice(5, url.indexOf(";")) || "image/png";
            return { dataUrl: url, mime };
          }
        }
      }
    }
  }
  // /v1/images/generations shape (openai)
  const dataArr = j.data as Array<Record<string, unknown>> | undefined;
  const first = dataArr?.[0];
  if (first) {
    const b64 = first.b64_json as string | undefined;
    if (b64) return { dataUrl: `data:image/png;base64,${b64}`, mime: "image/png" };
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const generateStudioImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مضبوط في الخادم.");

    const model = "google/gemini-2.5-flash-image";
    const fullPrompt = `${data.prompt}\n\nAspect ratio: ${data.aspect_ratio}. High quality, professional advertising visual.`;

    const runOnce = async () => {
      const content: ContentPart[] = [{ type: "text", text: fullPrompt }];
      for (const url of data.reference_urls) content.push({ type: "image_url", image_url: { url } });
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
      });
      if (!res.ok) {
        const txt = await res.text();
        if (res.status === 429) throw new Error("تجاوزت حد الطلبات. حاول لاحقاً.");
        if (res.status === 402) throw new Error("رصيد Lovable AI انتهى. يرجى الترقية.");
        throw new Error(`فشل توليد الصورة [${res.status}]: ${txt.slice(0, 300)}`);
      }
      const json = await res.json();
      const img = extractBase64Image(json);
      if (!img) throw new Error("لم يعد النموذج بصورة قابلة للقراءة.");
      const base64 = img.dataUrl.split(",")[1] ?? "";
      const bytes = base64ToBytes(base64);
      const ext = img.mime.includes("jpeg") ? "jpg" : "png";
      const path = `generated/${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await context.supabase.storage
        .from(BRAND_BUCKET)
        .upload(path, bytes, { contentType: img.mime, upsert: false });
      if (upErr) throw new Error(`فشل رفع الصورة: ${upErr.message}`);
      const url = publicUrl(path);
      const { data: row, error: insErr } = await context.supabase
        .from("studio_assets")
        .insert({
          user_id: context.userId,
          kind: "image",
          prompt: data.prompt,
          storage_path: path,
          public_url: url,
          model,
        })
        .select("id,kind,prompt,public_url,storage_path,model,created_at")
        .single();
      if (insErr) throw new Error(insErr.message);
      return row;
    };

    const results = await Promise.allSettled(Array.from({ length: data.variants }, runOnce));
    const rows: Awaited<ReturnType<typeof runOnce>>[] = [];
    let firstError: string | null = null;
    for (const r of results) {
      if (r.status === "fulfilled") rows.push(r.value);
      else if (!firstError) firstError = (r.reason as Error)?.message ?? "فشل التوليد";
    }
    if (rows.length === 0) throw new Error(firstError ?? "فشل توليد الصور.");
    return { assets: rows };
  });

// ---------- Edit / iterate on an existing image ----------
const EditInput = z.object({
  source_url: z.string().url(),
  prompt: z.string().min(3).max(1500),
});

export const editStudioImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EditInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مضبوط في الخادم.");
    const model = "google/gemini-2.5-flash-image";
    const content: ContentPart[] = [
      { type: "text", text: `Edit this image: ${data.prompt}. Keep the composition professional and advertising-ready.` },
      { type: "image_url", image_url: { url: data.source_url } },
    ];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("تجاوزت حد الطلبات.");
      if (res.status === 402) throw new Error("رصيد Lovable AI انتهى.");
      throw new Error(`فشل تعديل الصورة [${res.status}]`);
    }
    const img = extractBase64Image(await res.json());
    if (!img) throw new Error("لم يعد النموذج بصورة.");
    const bytes = base64ToBytes(img.dataUrl.split(",")[1] ?? "");
    const ext = img.mime.includes("jpeg") ? "jpg" : "png";
    const path = `generated/${context.userId}/${Date.now()}-edit.${ext}`;
    const { error: upErr } = await context.supabase.storage
      .from(BRAND_BUCKET)
      .upload(path, bytes, { contentType: img.mime, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const url = publicUrl(path);
    const { data: row, error } = await context.supabase
      .from("studio_assets")
      .insert({
        user_id: context.userId,
        kind: "image",
        prompt: `[تعديل] ${data.prompt}`,
        storage_path: path,
        public_url: url,
        model,
      })
      .select("id,kind,prompt,public_url,storage_path,model,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Short video: storyboard/script generation (Azure GPT) ----------
// True video synthesis requires a dedicated pipeline; we generate an actionable
// storyboard the user can execute, and store it as an asset row (kind='video').
const VideoInput = z.object({
  prompt: z.string().min(3).max(1500),
  duration_sec: z.number().int().min(10).max(90).default(30),
  platform: z.enum(["reels", "tiktok", "shorts", "story"]).default("reels"),
});

export const generateVideoStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VideoInput.parse(d))
  .handler(async ({ data, context }) => {
    const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
    const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-5.5";
    const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || "2024-10-21";
    if (!endpoint || !apiKey) throw new Error("Azure AI Foundry غير مُعدّ.");

    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "أنت مخرج فيديوهات إعلانية قصيرة. أعد سكربتاً بصيغة Markdown يتضمن: عنوان جذاب، هدف الفيديو، الجمهور، ثم مشاهد مرقّمة (المدة، اللقطة، الصوت/الموسيقى، النص على الشاشة، دعوة للفعل). اجعله عملياً وقابلاً للتنفيذ بأدوات بسيطة.",
          },
          {
            role: "user",
            content: `المنصة: ${data.platform}\nالمدة الإجمالية: ${data.duration_sec} ثانية\nالفكرة: ${data.prompt}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) throw new Error(`فشل توليد السكربت [${res.status}]`);
    const json = await res.json();
    const script: string = json?.choices?.[0]?.message?.content ?? "";
    if (!script) throw new Error("لم يُرجع النموذج سكربتاً.");

    // Persist as an asset for library. storage_path uses a virtual scripts/ folder (json blob upload).
    const path = `scripts/${context.userId}/${Date.now()}.md`;
    const bytes = new TextEncoder().encode(script);
    const { error: upErr } = await context.supabase.storage
      .from(BRAND_BUCKET)
      .upload(path, bytes, { contentType: "text/markdown", upsert: false });
    if (upErr) throw new Error(`فشل حفظ السكربت: ${upErr.message}`);
    const link = publicUrl(path);

    const { data: row, error } = await context.supabase
      .from("studio_assets")
      .insert({
        user_id: context.userId,
        kind: "video",
        prompt: data.prompt,
        storage_path: path,
        public_url: link,
        model: deployment,
      })
      .select("id,kind,prompt,public_url,storage_path,model,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { asset: row, script };
  });