import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Platform = z.enum(["whatsapp", "telegram", "facebook", "instagram", "tiktok"]);

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("social_connections")
      .select("id,platform,account_label,credentials,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const SaveInput = z.object({
  id: z.string().uuid().optional(),
  platform: Platform,
  account_label: z.string().min(1).max(80),
  credentials: z.record(z.string(), z.string()).default({}),
  is_active: z.boolean().default(true),
});

export const saveConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("social_connections")
        .update({
          platform: data.platform,
          account_label: data.account_label,
          credentials: data.credentials,
          is_active: data.is_active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("social_connections")
      .insert({
        user_id: context.userId,
        platform: data.platform,
        account_label: data.account_label,
        credentials: data.credentials,
        is_active: data.is_active,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("social_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Quick live-test the credentials by hitting the platform API (WhatsApp Cloud & Telegram bot).
export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("social_connections")
      .select("platform,credentials")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("الاتصال غير موجود");
    const creds = (row.credentials ?? {}) as Record<string, string>;

    if (row.platform === "telegram") {
      const token = creds.bot_token;
      if (!token) return { ok: false, message: "أدخل bot_token" };
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = (await r.json()) as { ok?: boolean; result?: { username?: string }; description?: string };
      return j.ok
        ? { ok: true, message: `متصل: @${j.result?.username ?? "?"}` }
        : { ok: false, message: j.description ?? "فشل الاتصال" };
    }
    if (row.platform === "whatsapp") {
      const token = creds.access_token;
      const phoneId = creds.phone_number_id;
      if (!token || !phoneId) return { ok: false, message: "أدخل access_token و phone_number_id" };
      const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json()) as { display_phone_number?: string; error?: { message?: string } };
      return r.ok
        ? { ok: true, message: `متصل: ${j.display_phone_number ?? phoneId}` }
        : { ok: false, message: j.error?.message ?? "فشل الاتصال" };
    }
    return { ok: false, message: "الاختبار غير مدعوم لهذه المنصة بعد." };
  });