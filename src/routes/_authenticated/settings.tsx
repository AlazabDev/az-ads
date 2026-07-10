import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Loader2, Plus, Trash2, Upload, Link2, CheckCircle2, XCircle, Settings as SettingsIcon,
  MessageCircle, Send as SendIcon, Facebook, Instagram, Video as VideoIcon,
} from "lucide-react";
import {
  listConnections, saveConnection, deleteConnection, testConnection,
} from "@/lib/settings.functions";
import { listBrandAssets } from "@/lib/campaigns.functions";
import { deleteBrandAsset } from "@/lib/studio.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — AdForge" },
      { name: "description", content: "اربط حسابات النشر وأدر مكتبة الأصول." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
  errorComponent: ({ error }) => <div className="p-10 text-destructive">{error.message}</div>,
});

function SettingsPage() {
  return (
    <div dir="rtl" className="max-w-6xl mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-3xl font-black text-brand flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-gold" />
          الإعدادات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">اربط حساباتك للنشر التلقائي، وأدر أصولك الرقمية.</p>
      </header>

      <ConnectionsSection />
      <AssetsSection />
    </div>
  );
}

// ==================== Connections ====================

type Platform = "whatsapp" | "telegram" | "facebook" | "instagram" | "tiktok";

const PLATFORMS: {
  id: Platform; name: string; icon: React.ComponentType<{ className?: string }>; fields: { key: string; label: string; type?: string; hint?: string }[];
}[] = [
  { id: "whatsapp", name: "WhatsApp Business", icon: MessageCircle, fields: [
    { key: "access_token", label: "Access Token", type: "password" },
    { key: "phone_number_id", label: "Phone Number ID" },
  ]},
  { id: "telegram", name: "Telegram Bot", icon: SendIcon, fields: [
    { key: "bot_token", label: "Bot Token", type: "password" },
    { key: "chat_id", label: "Default Chat ID", hint: "اختياري" },
  ]},
  { id: "facebook", name: "Facebook Page", icon: Facebook, fields: [
    { key: "page_id", label: "Page ID" },
    { key: "page_access_token", label: "Page Access Token", type: "password" },
  ]},
  { id: "instagram", name: "Instagram", icon: Instagram, fields: [
    { key: "ig_user_id", label: "IG User ID" },
    { key: "access_token", label: "Access Token", type: "password" },
  ]},
  { id: "tiktok", name: "TikTok", icon: VideoIcon, fields: [
    { key: "access_token", label: "Access Token", type: "password" },
  ]},
];

const connectionsKey = ["connections"] as const;

function ConnectionsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listConnections);
  const saveFn = useServerFn(saveConnection);
  const delFn = useServerFn(deleteConnection);
  const testFn = useServerFn(testConnection);

  const { data: connections = [], isLoading } = useQuery({ queryKey: connectionsKey, queryFn: () => listFn() });

  const [adding, setAdding] = useState<Platform | null>(null);
  const [label, setLabel] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { platform: adding!, account_label: label, credentials: creds, is_active: true } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: connectionsKey });
      setAdding(null); setLabel(""); setCreds({});
    },
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionsKey }),
  });
  const testMut = useMutation({
    mutationFn: (id: string) => testFn({ data: { id } }),
    onSuccess: (r, id) => setTestResult((prev) => ({ ...prev, [id]: r })),
  });

  const currentPlatform = adding ? PLATFORMS.find((p) => p.id === adding)! : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-brand">الحسابات المرتبطة</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setAdding(p.id); setLabel(""); setCreds({}); }}
            className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-2 hover:border-brand/40 hover:shadow-brand transition"
          >
            <p.icon className="w-6 h-6 text-brand" />
            <span className="text-xs font-semibold text-brand">{p.name}</span>
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة
            </span>
          </button>
        ))}
      </div>

      {currentPlatform && (
        <div className="rounded-2xl border border-brand/30 bg-card p-5 mb-6">
          <h3 className="font-bold text-brand mb-3 flex items-center gap-2">
            <currentPlatform.icon className="w-5 h-5" />
            ربط {currentPlatform.name}
          </h3>
          <div className="grid gap-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="اسم الحساب (لتمييزه)"
              className="rounded-lg border border-border bg-background p-2 text-sm"
            />
            {currentPlatform.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground">{f.label}{f.hint ? ` (${f.hint})` : ""}</label>
                <input
                  type={f.type ?? "text"}
                  value={creds[f.key] ?? ""}
                  onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm mt-1"
                />
              </div>
            ))}
            {saveMut.error && <div className="text-sm text-destructive">{(saveMut.error as Error).message}</div>}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setAdding(null); setLabel(""); setCreds({}); }}
                className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground"
              >إلغاء</button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !label.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-muted-foreground py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          لم تربط أي حساب بعد.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {connections.map((c) => {
            const meta = PLATFORMS.find((p) => p.id === c.platform);
            const Icon = meta?.icon ?? Link2;
            const t = testResult[c.id];
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                <Icon className="w-6 h-6 text-brand mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-brand truncate">{c.account_label}</div>
                  <div className="text-xs text-muted-foreground">{meta?.name ?? c.platform}</div>
                  {t && (
                    <div className={`mt-2 text-xs inline-flex items-center gap-1 ${t.ok ? "text-green-600" : "text-destructive"}`}>
                      {t.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {t.message}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => testMut.mutate(c.id)}
                    disabled={testMut.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-brand hover:border-brand/40"
                  >
                    {testMut.isPending && testMut.variables === c.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "اختبار"}
                  </button>
                  <button
                    onClick={() => { if (confirm("حذف هذا الاتصال؟")) delMut.mutate(c.id); }}
                    className="text-xs px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/5"
                  >
                    <Trash2 className="w-3 h-3 inline" /> حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ==================== Assets library ====================

const assetsKey = ["brand-assets"] as const;

function AssetsSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrandAssets);
  const delFn = useServerFn(deleteBrandAsset);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: assetsKey,
    queryFn: () => listFn({ data: { prefix: "raw_images", limit: 60, offset: 0 } }),
  });
  const items = data?.items ?? [];

  const delMut = useMutation({
    mutationFn: (path: string) => delFn({ data: { path } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetsKey }),
  });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null); setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]/g, "_");
        const path = `raw_images/${Date.now()}-${safe}`;
        const { error: e } = await supabase.storage.from("Alazab-Ads").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (e) throw new Error(e.message);
      }
      await qc.invalidateQueries({ queryKey: assetsKey });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand">مكتبة الأصول</h2>
          <p className="text-xs text-muted-foreground">صور تُستخدم مع الذكاء الاصطناعي كمرجع بصري (raw_images).</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground px-4 py-2 text-sm font-bold shadow-brand cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          رفع صور
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            hidden
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
      </div>
      {error && <div className="text-sm text-destructive mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-6"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          لا توجد أصول. ارفع صوراً لتستخدمها في الحملات.
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {items.map((a) => (
            <div key={a.path} className="relative group rounded-xl overflow-hidden border border-border bg-card">
              <img src={a.url} alt={a.name} className="w-full aspect-square object-cover" loading="lazy" />
              <button
                onClick={() => { if (confirm("حذف الملف؟")) delMut.mutate(a.path); }}
                className="absolute top-1 left-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition"
                title="حذف"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}