import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(3),
  kind: z.enum(["ad_copy", "caption", "hashtags", "video_script"]).default("ad_copy"),
  platform: z.enum(["facebook", "instagram", "tiktok", "whatsapp", "telegram", "general"]).default("general"),
  tone: z.string().default("احترافي وجذاب"),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  ad_copy: "أنت خبير كتابة إعلانات عربية. اكتب نص إعلان قصير وقوي (حد أقصى 60 كلمة) مع عنوان جذاب ودعوة للفعل.",
  caption: "أنت خبير محتوى سوشيال ميديا. اكتب كابشن جذاب مع رموز تعبيرية مناسبة.",
  hashtags: "أنت خبير SEO للسوشيال. أعد 10-15 هاشتاج عربي/إنجليزي مناسب.",
  video_script: "أنت كاتب سيناريو فيديو قصير. اكتب سكربت فيديو 30-60 ثانية بمشاهد مرقّمة وحوار.",
};

export const generateAdContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
    const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-5.5";
    const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || "2024-10-21";

    if (!endpoint || !apiKey) {
      throw new Error(
        "Azure AI Foundry غير مُعدّ بعد. أضف AZURE_FOUNDRY_ENDPOINT و AZURE_FOUNDRY_API_KEY في الإعدادات.",
      );
    }

    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[data.kind] },
          {
            role: "user",
            content: `المنصة: ${data.platform}\nالنبرة: ${data.tone}\nالمطلوب: ${data.prompt}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Azure Foundry error [${res.status}]: ${body}`);
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    return { content, model: deployment };
  });

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1),
});

const STUDIO_SYSTEM = [
  'أنت "AdForge Copilot" — مساعد إبداعي عربي متخصص في صناعة المواد الإعلانية (نصوص، أفكار صور، سيناريوهات فيديو، خطط نشر) للمنصات: فيسبوك، إنستغرام، تيك توك، واتساب، تيليجرام.',
  '• ردّ دائماً بالعربية الفصحى الواضحة ما لم يطلب المستخدم غير ذلك.',
  '• كن موجزاً ومنظّماً: استخدم عناوين وقوائم عند الحاجة.',
  '• عند طلب "نص إعلاني" قدّم: عنوان، وصف قصير، دعوة للفعل (CTA).',
  '• عند طلب "أفكار صور" قدّم 3-5 أفكار Prompt جاهزة للاستخدام في مولّدات الصور (بالإنجليزية داخل كتلة كود).',
  '• عند طلب "سكربت فيديو" قسّمه إلى مشاهد مرقّمة مع مدة وحوار وتوجيه بصري.',
  '• اسأل عن الجمهور المستهدف والمنصة إذا لم يوضّحها المستخدم.',
].join("\n");

export const chatWithAzure = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ChatInput.parse(data))
  .handler(async ({ data }) => {
    const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
    const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-5.5";
    const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || "2024-10-21";

    if (!endpoint || !apiKey) {
      throw new Error(
        "Azure AI Foundry غير مُعدّ. أضف AZURE_FOUNDRY_ENDPOINT و AZURE_FOUNDRY_API_KEY.",
      );
    }

    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages: [{ role: "system", content: STUDIO_SYSTEM }, ...data.messages],
        temperature: 0.8,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Azure Foundry error [${res.status}]: ${body.slice(0, 400)}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    return { content, model: deployment };
  });
