import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles, Image as ImageIcon, Film, Trash2, Download, Copy, Check, Wand2, X, Plus } from "lucide-react";
import {
  generateStudioImage,
  editStudioImage,
  generateVideoStoryboard,
  listStudioAssets,
  deleteStudioAsset,
} from "@/lib/studio.functions";
import { listBrandAssets } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({
    meta: [
      { title: "الاستوديو — AdForge" },
      { name: "description", content: "توليد الصور الإعلانية وسكربتات الفيديو القصيرة بالذكاء الاصطناعي." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioPage,
  errorComponent: ({ error }) => <div className="p-10 text-destructive">{error.message}</div>,
});

const assetsKey = ["studio-assets"] as const;
const brandAssetsKey = ["brand-assets"] as const;

type Aspect = "1:1" | "4:5" | "9:16" | "16:9" | "3:4" | "4:3";

function StudioPage() {
  const [tab, setTab] = useState<"image" | "video">("image");
  const qc = useQueryClient();
  const listFn = useServerFn(listStudioAssets);
  const delFn = useServerFn(deleteStudioAsset);

  const { data: assets = [], isLoading } = useQuery({ queryKey: assetsKey, queryFn: () => listFn() });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: assetsKey }),
  });

  const [editTarget, setEditTarget] = useState<{ url: string; prompt: string } | null>(null);

  return (
    <div dir="rtl" className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-brand flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-gold" />
          الاستوديو
        </h1>
        <p className="text-sm text-muted-foreground mt-1">أنشئ صوراً إعلانية أو سكربتات فيديو قصيرة جاهزة للتنفيذ.</p>
      </header>

      <div className="inline-flex rounded-xl border border-border bg-card p-1 mb-6">
        {[
          { id: "image", label: "صورة إعلانية", icon: ImageIcon },
          { id: "video", label: "سكربت فيديو", icon: Film },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "image" | "video")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand text-brand-foreground shadow-brand" : "text-muted-foreground hover:text-brand"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "image" ? <ImageGen /> : <VideoGen />}

      <section className="mt-10">
        <h2 className="text-xl font-bold text-brand mb-4">مكتبتك</h2>
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            لا توجد أصول بعد. ولّد أول عنصر إعلاني.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map((a) => (
              <div key={a.id} className="rounded-2xl overflow-hidden border border-border bg-card group relative">
                {a.kind === "image" ? (
                  <img src={a.public_url} alt={a.prompt} className="w-full aspect-square object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-square grid place-items-center bg-gradient-brand text-brand-foreground p-3 text-center">
                    <div>
                      <Film className="w-8 h-8 mx-auto mb-2" />
                      <div className="text-xs font-semibold line-clamp-4">{a.prompt}</div>
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{a.prompt}</div>
                  <div className="flex items-center justify-between">
                    <a
                      href={a.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-brand inline-flex items-center gap-1 hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      فتح
                    </a>
                    <div className="flex items-center gap-2">
                      {a.kind === "image" && (
                        <button
                          onClick={() => { setEditTarget({ url: a.public_url, prompt: "" }); setTab("image"); }}
                          className="text-muted-foreground hover:text-brand"
                          title="تعديل بالذكاء الاصطناعي"
                        >
                          <Wand2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm("حذف هذا العنصر؟")) delMut.mutate(a.id); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editTarget && <EditDialog target={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}

function ImageGen() {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [variants, setVariants] = useState(1);
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [showRefs, setShowRefs] = useState(false);
  const qc = useQueryClient();
  const genFn = useServerFn(generateStudioImage);
  const mut = useMutation({
    mutationFn: () => genFn({ data: { prompt, aspect_ratio: aspect, variants, reference_urls: refUrls } }),
    onSuccess: (res) => {
      setPreviews(res.assets.map((a) => a.public_url));
      qc.invalidateQueries({ queryKey: assetsKey });
    },
  });

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <label className="block text-sm font-bold text-brand mb-2">وصف الصورة</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="مثال: بوستر ترويجي لمنتج عطر فاخر، خلفية ذهبية، إضاءة درامية، تصوير احترافي"
        className="w-full min-h-[110px] rounded-xl border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:border-brand"
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        <div>
          <label className="block text-xs font-semibold text-brand mb-1">نسبة الأبعاد</label>
          <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
            <option value="1:1">مربع 1:1</option>
            <option value="4:5">عمودي 4:5 (بوست)</option>
            <option value="9:16">ستوري 9:16</option>
            <option value="16:9">أفقي 16:9</option>
            <option value="3:4">3:4</option>
            <option value="4:3">4:3</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand mb-1">عدد النسخ</label>
          <select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => setShowRefs((v) => !v)} className="w-full rounded-lg border border-border bg-background p-2 text-sm hover:border-brand inline-flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            مراجع بصرية ({refUrls.length})
          </button>
        </div>
      </div>

      {showRefs && <ReferencePicker selected={refUrls} onChange={setRefUrls} />}

      <div className="flex items-center justify-between mt-4">
        <div className="text-xs text-muted-foreground">مدعوم بـ Lovable AI · Gemini Image</div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || prompt.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground px-5 py-2.5 text-sm font-bold shadow-brand disabled:opacity-60"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {variants > 1 ? `توليد ${variants} صور` : "توليد الصورة"}
        </button>
      </div>
      {mut.error && <div className="mt-3 text-sm text-destructive">{(mut.error as Error).message}</div>}
      {previews.length > 0 && (
        <div className={`mt-5 grid gap-3 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {previews.map((u) => (
            <img key={u} src={u} alt="نتيجة" className="rounded-2xl w-full border border-border" />
          ))}
        </div>
      )}
    </div>
  );
}

function ReferencePicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const listFn = useServerFn(listBrandAssets);
  const { data, isLoading } = useQuery({ queryKey: brandAssetsKey, queryFn: () => listFn({ data: { prefix: "raw_images", limit: 60 } }) });
  const items = (data as { url: string; name: string }[] | undefined) ?? [];
  const toggle = (url: string) => {
    if (selected.includes(url)) onChange(selected.filter((u) => u !== url));
    else if (selected.length < 4) onChange([...selected, url]);
  };
  return (
    <div className="mt-3 rounded-2xl border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground mb-2">اختر حتى 4 مراجع من مكتبتك (اضغط للاختيار/الإلغاء)</div>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">لا توجد أصول. ارفعها من الإعدادات.</div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-64 overflow-auto">
          {items.map((it) => {
            const isSel = selected.includes(it.url);
            return (
              <button
                key={it.name}
                onClick={() => toggle(it.url)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${isSel ? "border-brand shadow-brand" : "border-transparent hover:border-border"}`}
              >
                <img src={it.url} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
                {isSel && (
                  <div className="absolute inset-0 bg-brand/40 grid place-items-center">
                    <Check className="w-5 h-5 text-brand-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditDialog({ target, onClose }: { target: { url: string; prompt: string }; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const qc = useQueryClient();
  const editFn = useServerFn(editStudioImage);
  const mut = useMutation({
    mutationFn: () => editFn({ data: { source_url: target.url, prompt } }),
    onSuccess: (row) => {
      setResult(row.public_url);
      qc.invalidateQueries({ queryKey: assetsKey });
    },
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl border border-border w-full max-w-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 left-3 p-1 rounded-lg hover:bg-muted">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-brand mb-4 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-gold" /> تعديل الصورة بالذكاء الاصطناعي
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <img src={result ?? target.url} alt="مصدر" className="w-full rounded-xl border border-border" />
          <div>
            <label className="block text-xs font-semibold text-brand mb-1">وصف التعديل</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="مثال: غيّر الخلفية إلى لون ذهبي وأضف إضاءة دراميّة"
              className="w-full min-h-[120px] rounded-xl border border-border bg-background p-3 text-sm resize-y"
            />
            <button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || prompt.trim().length < 3}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground px-4 py-2.5 text-sm font-bold shadow-brand disabled:opacity-60"
            >
              {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              تطبيق التعديل
            </button>
            {mut.error && <div className="mt-2 text-xs text-destructive">{(mut.error as Error).message}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoGen() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<"reels" | "tiktok" | "shorts" | "story">("reels");
  const [duration, setDuration] = useState(30);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const genFn = useServerFn(generateVideoStoryboard);
  const mut = useMutation({
    mutationFn: () => genFn({ data: { prompt, platform, duration_sec: duration } }),
    onSuccess: (r) => {
      setScript(r.script);
      qc.invalidateQueries({ queryKey: assetsKey });
    },
  });

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <label className="block text-sm font-bold text-brand mb-2">فكرة الفيديو</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="مثال: إعلان تشويقي لإطلاق تطبيق توصيل جديد يخفض السعر بنسبة 40%"
        className="w-full min-h-[100px] rounded-xl border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:border-brand"
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="block text-xs font-semibold text-brand mb-1">المنصة</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          >
            <option value="reels">Instagram Reels</option>
            <option value="tiktok">TikTok</option>
            <option value="shorts">YouTube Shorts</option>
            <option value="story">Story (15s)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand mb-1">المدة (ثانية)</label>
          <input
            type="number"
            min={10}
            max={90}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-end mt-4">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || prompt.trim().length < 3}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground px-5 py-2.5 text-sm font-bold shadow-brand disabled:opacity-60"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          توليد السكربت
        </button>
      </div>
      {mut.error && <div className="mt-3 text-sm text-destructive">{(mut.error as Error).message}</div>}
      {script && (
        <div className="mt-5 relative">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(script);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="absolute top-3 left-3 rounded-lg bg-brand text-brand-foreground px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "تم" : "نسخ"}
          </button>
          <pre className="whitespace-pre-wrap text-sm bg-background border border-border rounded-2xl p-4 max-h-[500px] overflow-auto text-right">
            {script}
          </pre>
        </div>
      )}
    </div>
  );
}