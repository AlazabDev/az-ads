import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Loader2, Copy, Check, ArrowRight, Send, Trash2,
  Megaphone, Hash, FileVideo, Image as ImageIcon, Calendar,
  Target, Lightbulb, TrendingUp, Languages, RefreshCw,
} from "lucide-react";
import { chatWithAzure } from "@/lib/azure-ai.functions";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "استوديو المحتوى — AdForge" },
      { name: "description", content: "استوديو محادثة مع GPT-5.5 لإنشاء نصوص وصور وسيناريوهات إعلانية." },
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

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "adforge.studio.chat.v1";

const TOOLS: {
  id: string;
  label: string;
  icon: typeof Megaphone;
  template: string;
}[] = [
  { id: "ad", label: "نص إعلاني", icon: Megaphone,
    template: "اكتب نصاً إعلانياً قوياً (عنوان + وصف + CTA) لـ: " },
  { id: "caption", label: "كابشن سوشيال", icon: Sparkles,
    template: "اقترح 3 كابشنات جذابة مع إيموجي لمنشور على إنستغرام عن: " },
  { id: "hash", label: "هاشتاجات", icon: Hash,
    template: "أعطني 15 هاشتاج مستهدف (عربي + إنجليزي) لمنتج/موضوع: " },
  { id: "script", label: "سكربت فيديو", icon: FileVideo,
    template: "اكتب سكربت ريلز/تيك توك مدته 30 ثانية بمشاهد مرقّمة عن: " },
  { id: "image", label: "أفكار صور", icon: ImageIcon,
    template: "اقترح 5 أفكار Prompt احترافية لتوليد صور إعلانية (بالإنجليزية داخل code) لـ: " },
  { id: "plan", label: "خطة نشر أسبوعية", icon: Calendar,
    template: "صمّم خطة نشر أسبوعية (7 أيام) لكل من إنستغرام وتيك توك وواتساب لعلامة/منتج: " },
  { id: "audience", label: "تحليل جمهور", icon: Target,
    template: "حلّل الجمهور المستهدف (ديموغرافيا، اهتمامات، نقاط ألم، رسائل تجذبهم) لـ: " },
  { id: "ideas", label: "أفكار حملات", icon: Lightbulb,
    template: "اقترح 5 أفكار حملات إعلانية إبداعية لموسم/مناسبة/منتج: " },
  { id: "improve", label: "تحسين نص", icon: TrendingUp,
    template: "حسّن النص التالي ليكون أكثر جاذبية وإقناعاً ومناسبة لسوشيال ميديا:\n\n" },
  { id: "translate", label: "ترجمة إعلانية", icon: Languages,
    template: "ترجم النص التالي إلى إنجليزية إعلانية طبيعية مع الحفاظ على الأثر التسويقي:\n\n" },
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "مرحباً 👋 أنا **AdForge Copilot** — مساعدك لصناعة المحتوى الإعلاني.\n\nاختر أداة سريعة من اليمين، أو اكتب طلبك مباشرة: مثل _\"اكتب إعلان لمقهى مختص جديد في الرياض\"_.",
};

function StudioPage() {
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {}
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const chat = useServerFn(chatWithAzure);
  const mutation = useMutation({
    mutationFn: (msgs: Msg[]) => chat({ data: { messages: msgs } }),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  });

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    const next: Msg[] = [...messages.filter((m) => m !== WELCOME || messages.length > 1), { role: "user", content: trimmed }];
    // Ensure welcome is preserved but not sent as user
    const clean = next;
    setMessages(clean);
    setInput("");
    // Send only real convo (drop welcome)
    const toSend = clean.filter((m, i) => !(i === 0 && m.role === "assistant" && m.content === WELCOME.content));
    mutation.mutate(toSend);
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); send(input); };
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const useTool = (template: string) => {
    setInput(template);
    setTimeout(() => {
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) { el.selectionStart = el.selectionEnd = el.value.length; }
    }, 0);
  };

  const resetChat = () => {
    if (!confirm("مسح المحادثة بالكامل؟")) return;
    setMessages([WELCOME]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const retry = () => {
    // resend last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const trimIdx = messages.length - lastUserIdx;
    const upTo = messages.slice(0, trimIdx);
    setMessages(upTo);
    mutation.mutate(upTo.filter((m) => !(m === WELCOME)));
  };

  const copyMsg = async (idx: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
              <Sparkles className="w-5 h-5 text-brand-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-brand leading-none">AdForge</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">استوديو المحتوى · GPT-5.5</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={resetChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
              title="محادثة جديدة"
            >
              <Trash2 className="w-3.5 h-3.5" />
              جديدة
            </button>
            <Link to="/" className="text-sm text-muted-foreground hover:text-brand inline-flex items-center gap-1">
              <ArrowRight className="w-4 h-4" />
              الرئيسية
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto grid lg:grid-cols-[280px_1fr] gap-4 p-4">
        {/* Tools sidebar */}
        <aside className="rounded-2xl border border-border bg-card p-4 h-fit lg:sticky lg:top-[76px]">
          <div className="text-xs font-bold text-gold mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            أدوات سريعة
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => useTool(t.template)}
                className="text-right inline-flex items-center gap-2 rounded-xl border border-border bg-surface hover:bg-surface-2 hover:border-brand/40 transition px-3 py-2.5 text-sm font-semibold text-brand"
              >
                <t.icon className="w-4 h-4 text-gold shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Chat */}
        <section className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden min-h-[70vh]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"} md:${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] md:max-w-[80%] group ${m.role === "user" ? "order-1" : ""}`}>
                  <div className={`text-[11px] mb-1 font-bold ${m.role === "user" ? "text-brand" : "text-gold"}`}>
                    {m.role === "user" ? "أنت" : "AdForge Copilot"}
                  </div>
                  {m.role === "user" ? (
                    <div className="rounded-2xl rounded-tr-sm bg-brand text-brand-foreground px-4 py-3 text-[15px] whitespace-pre-wrap leading-relaxed shadow-brand">
                      {m.content}
                    </div>
                  ) : (
                    <div className="rounded-2xl rounded-tl-sm bg-surface border border-border px-4 py-3 text-[15px] leading-relaxed text-foreground prose prose-sm max-w-none prose-headings:text-brand prose-strong:text-brand prose-code:text-brand prose-code:bg-surface-2 prose-code:px-1 prose-code:rounded prose-pre:bg-ink prose-pre:text-white">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                      {i > 0 && (
                        <div className="not-prose flex items-center gap-2 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => copyMsg(i, m.content)}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand"
                          >
                            {copiedIdx === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedIdx === i ? "تم النسخ" : "نسخ"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {mutation.isPending && (
              <div className="flex justify-end md:justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-surface border border-border px-4 py-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  يفكّر Copilot…
                </div>
              </div>
            )}

            {mutation.error && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="text-sm font-bold text-destructive mb-1">تعذّر الاتصال بالنموذج</div>
                <div className="text-xs text-muted-foreground whitespace-pre-wrap mb-3">
                  {(mutation.error as Error).message}
                </div>
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-brand-foreground px-3 py-1.5 text-xs font-semibold"
                >
                  <RefreshCw className="w-3 h-3" />
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="border-t border-border p-3 md:p-4 bg-card">
            <div className="rounded-2xl border border-border bg-surface focus-within:border-brand transition p-2 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={2}
                placeholder="اكتب طلبك… (Enter للإرسال، Shift+Enter لسطر جديد)"
                className="flex-1 bg-transparent resize-none outline-none px-3 py-2 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 max-h-48"
              />
              <button
                type="submit"
                disabled={!input.trim() || mutation.isPending}
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-brand text-brand-foreground shadow-brand disabled:opacity-50 hover:scale-105 transition"
                aria-label="إرسال"
              >
                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 text-center">
              يعمل بواسطة Azure AI Foundry · GPT-5.5 · المحادثة محفوظة في متصفحك فقط
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}