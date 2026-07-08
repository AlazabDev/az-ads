import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Sparkles, Wand2, Loader2, Copy, Check, ArrowRight,
  Facebook, Instagram, Video, MessageCircle, Send,
  Type, Hash, FileVideo, Megaphone,
} from "lucide-react";
import { generateAdContent } from "@/lib/azure-ai.functions";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "الاستوديو — AdForge" },
      { name: "description", content: "أنشئ نصوصاً وصوراً وفيديوهات إعلانية بالذكاء الاصطناعي." },
    ],
  }),
  component: StudioPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-brand mb-2">حدث خطأ</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold"
          >
            حاول مجدداً
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-10 text-center">الصفحة غير موجودة</div>,
});

type Kind = "ad_copy" | "caption" | "hashtags" | "video_script";
type Platform = "facebook" | "instagram" | "tiktok" | "whatsapp" | "telegram" | "general";

const KINDS: { id: Kind; label: string; icon: typeof Type; desc: string }[] = [
  { id: "ad_copy", label: "نص إعلاني", icon: Megaphone, desc: "عنوان + وصف + CTA" },
  { id: "caption", label: "كابشن سوشيال", icon: Type, desc: "منشور جذاب" },
  { id: "hashtags", label: "هاشتاجات", icon: Hash, desc: "15 هاشتاج مستهدف" },
  { id: "video_script", label: "سكربت فيديو", icon: FileVideo, desc: "ريلز / تيك توك" },
];

const PLATFORMS: { id: Platform; label: string; icon: typeof Facebook }[] = [
  { id: "general", label: "عام", icon: Sparkles },
  { id: "facebook", label: "فيسبوك", icon: Facebook },
  { id: "instagram", label: "إنستغرام", icon: Instagram },
  { id: "tiktok", label: "تيك توك", icon: Video },
  { id: "whatsapp", label: "واتساب", icon: MessageCircle },
  { id: "telegram", label: "تيليجرام", icon: Send },
];

function StudioPage() {
  const [kind, setKind] = useState<Kind>("ad_copy");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("احترافي وجذاب");
  const [copied, setCopied] = useState(false);

  const gen = useServerFn(generateAdContent);
  const mutation = useMutation({
    mutationFn: (input: { prompt: string; kind: Kind; platform: Platform; tone: string }) =>
      gen({ data: input }),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    mutation.mutate({ prompt, kind, platform, tone });
  };

  const copy = async () => {
    if (!mutation.data?.content) return;
    await navigator.clipboard.writeText(mutation.data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
              <Sparkles className="w-5 h-5 text-brand-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-brand">AdForge</span>
            <span className="text-xs text-muted-foreground mr-2 hidden md:inline">الاستوديو</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            الرئيسية
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-[380px_1fr] gap-8">
        {/* Controls */}
        <form onSubmit={submit} className="space-y-6">
          <div>
            <div className="text-xs font-bold text-gold mb-2">١. نوع المحتوى</div>
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => {
                const active = kind === k.id;
                return (
                  <button
                    type="button"
                    key={k.id}
                    onClick={() => setKind(k.id)}
                    className={`text-right rounded-2xl border p-4 transition ${
                      active
                        ? "border-brand bg-brand text-brand-foreground shadow-brand"
                        : "border-border bg-card hover:border-brand/40"
                    }`}
                  >
                    <k.icon className={`w-5 h-5 mb-2 ${active ? "text-gold" : "text-brand"}`} />
                    <div className="font-bold text-sm">{k.label}</div>
                    <div className={`text-xs mt-1 ${active ? "text-brand-foreground/70" : "text-muted-foreground"}`}>
                      {k.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-gold mb-2">٢. المنصة</div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = platform === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-gold text-gold-foreground border-gold"
                        : "bg-card text-brand border-border hover:border-gold"
                    }`}
                  >
                    <p.icon className="w-4 h-4" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gold mb-2 block">٣. النبرة</label>
            <input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-brand transition"
              placeholder="مثال: عصري، فكاهي، فاخر…"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gold mb-2 block">٤. اوصف منتجك/فكرتك</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-brand transition resize-none"
              placeholder="مثال: قهوة مختصة عربية، عبوة 250 جرام، للمهنيين الشباب، سعر 45 ريال…"
            />
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-brand text-brand-foreground px-6 py-4 font-bold shadow-brand disabled:opacity-60 hover:scale-[1.01] transition"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جارٍ الإنشاء…
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                إنشاء بالذكاء الاصطناعي
              </>
            )}
          </button>
        </form>

        {/* Result */}
        <div className="rounded-3xl border border-border bg-card p-6 md:p-10 shadow-soft min-h-[500px] relative">
          {!mutation.data && !mutation.isPending && !mutation.error && (
            <div className="h-full min-h-[400px] grid place-items-center text-center">
              <div>
                <div className="w-20 h-20 rounded-3xl bg-gradient-mesh grid place-items-center mx-auto mb-6">
                  <Wand2 className="w-10 h-10 text-brand" />
                </div>
                <h3 className="text-2xl font-bold text-brand mb-2">ابدأ بوصف فكرتك</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  اختر نوع المحتوى والمنصة، ثم اكتب وصفاً موجزاً لمنتجك — GPT‑5.5 عبر Azure Foundry
                  سيتولى الباقي.
                </p>
              </div>
            </div>
          )}

          {mutation.isPending && (
            <div className="h-full min-h-[400px] grid place-items-center">
              <div className="text-center">
                <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">يفكّر الذكاء الاصطناعي…</p>
              </div>
            </div>
          )}

          {mutation.error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="font-bold text-destructive mb-2">تعذّر إنشاء المحتوى</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {(mutation.error as Error).message}
              </div>
            </div>
          )}

          {mutation.data && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-gold">
                  <Sparkles className="w-4 h-4" />
                  تم بواسطة {mutation.data.model}
                </div>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-2 rounded-xl bg-surface border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-brand" /> : <Copy className="w-4 h-4" />}
                  {copied ? "تم النسخ" : "نسخ"}
                </button>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed text-foreground text-[15px] bg-surface rounded-2xl p-6 border border-border">
                {mutation.data.content}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
