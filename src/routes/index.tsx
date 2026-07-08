import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles, Image as ImageIcon, Video, Send, BarChart3,
  MessageCircle, Zap, Globe, Camera, ArrowLeft, Wand2, Layers,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-gradient-mesh">
      <Nav />
      <Hero />
      <Features />
      <Channels />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/70 border-b border-border/60">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
            <Sparkles className="w-5 h-5 text-brand-foreground" />
          </div>
          <span className="font-display font-bold text-xl text-brand">AdForge</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-brand transition">المزايا</a>
          <a href="#channels" className="hover:text-brand transition">قنوات النشر</a>
          <a href="#cta" className="hover:text-brand transition">البدء</a>
        </nav>
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-xl bg-brand text-brand-foreground px-5 py-2.5 text-sm font-semibold shadow-brand hover:opacity-90 transition"
        >
          افتح الاستوديو
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-gold/15 text-brand px-4 py-1.5 text-xs font-semibold mb-8 border border-gold/30">
          <Zap className="w-3.5 h-3.5 text-gold" />
          مدعوم بـ Azure AI Foundry — GPT‑5.5
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-brand leading-[1.05] tracking-tight">
          استوديو إعلانك،
          <br />
          <span className="relative inline-block">
            <span className="bg-gradient-brand bg-clip-text text-transparent">في دقيقة واحدة</span>
            <span className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-gold rounded-full opacity-80" />
          </span>
        </h1>
        <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          أنشئ نصوصاً وصوراً وفيديوهات إعلانية احترافية بالذكاء الاصطناعي،
          وانشرها مباشرة على فيسبوك، إنستغرام، تيك توك، واتساب، وتيليجرام —
          من لوحة تحكم واحدة.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand text-brand-foreground px-8 py-4 font-bold shadow-brand hover:scale-[1.02] transition"
          >
            ابدأ الإنشاء مجاناً
            <Wand2 className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-2xl bg-surface border border-border px-8 py-4 font-semibold text-brand hover:bg-surface-2 transition"
          >
            تعرّف على المزايا
          </a>
        </div>

        <div className="mt-20 relative">
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Wand2, label: "نصوص إعلانية" },
              { icon: ImageIcon, label: "صور احترافية" },
              { icon: Video, label: "فيديوهات قصيرة" },
              { icon: Send, label: "نشر تلقائي" },
            ].map((f) => (
              <div key={f.label} className="rounded-2xl bg-card border border-border p-6 shadow-soft hover:shadow-brand transition">
                <f.icon className="w-8 h-8 text-gold mb-3 mx-auto" />
                <div className="text-sm font-semibold text-brand">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Wand2, title: "توليد محتوى ذكي", desc: "GPT‑5.5 عبر Azure AI Foundry يكتب لك عناوين ونصوصاً موجهة لجمهورك المستهدف." },
    { icon: ImageIcon, title: "صور إعلانية فورية", desc: "أنشئ خلفيات وبانرات ومنتجات بأحجام جاهزة لكل منصة." },
    { icon: Video, title: "فيديوهات قصيرة", desc: "حوّل فكرتك إلى ريلز أو تيك توك بلمسة واحدة." },
    { icon: Layers, title: "مكتبة الأصول", desc: "احفظ حملاتك ونماذجك وأعد استخدامها في ثوانٍ." },
    { icon: Send, title: "جدولة ونشر", desc: "اربط حساباتك وانشر بضغطة زر أو جدول للأسبوع كاملاً." },
    { icon: BarChart3, title: "قياس الأداء", desc: "تابع مؤشرات كل إعلان في لوحة موحدة." },
  ];
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="text-sm font-bold text-gold mb-3">كل ما تحتاجه</div>
        <h2 className="text-4xl md:text-5xl font-black text-brand">أدواتك الإعلانية في مكان واحد</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((it) => (
          <div key={it.title} className="group rounded-3xl bg-card border border-border p-8 hover:border-brand/30 hover:shadow-brand transition-all">
            <div className="w-12 h-12 rounded-xl bg-brand/10 grid place-items-center mb-5 group-hover:bg-gradient-brand transition">
              <it.icon className="w-6 h-6 text-brand group-hover:text-brand-foreground transition" />
            </div>
            <h3 className="text-xl font-bold text-brand mb-2">{it.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Channels() {
  const channels = [
    { icon: Globe, name: "Globe" },
    { icon: Camera, name: "Camera" },
    { icon: Video, name: "TikTok" },
    { icon: MessageCircle, name: "WhatsApp" },
    { icon: Send, name: "Telegram" },
  ];
  return (
    <section id="channels" className="bg-brand text-brand-foreground py-24">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black mb-4">انشر على كل قنواتك</h2>
        <p className="text-brand-foreground/70 text-lg max-w-xl mx-auto mb-14">
          اربط حساباتك مرة واحدة، وأتمتة النشر لكل الحملات القادمة.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {channels.map((c) => (
            <div key={c.name} className="flex items-center gap-3 rounded-2xl bg-brand-foreground/5 border border-brand-foreground/10 backdrop-blur px-6 py-4 hover:bg-gold hover:text-gold-foreground transition">
              <c.icon className="w-5 h-5" />
              <span className="font-semibold">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="cta" className="max-w-5xl mx-auto px-6 py-24">
      <div className="rounded-4xl bg-gradient-brand p-12 md:p-20 text-center shadow-brand relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gold/30 rounded-full blur-3xl" />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-black text-brand-foreground mb-6">
            جاهز لإطلاق حملتك؟
          </h2>
          <p className="text-brand-foreground/80 text-lg mb-10 max-w-xl mx-auto">
            جرّب AdForge الآن — أنشئ أول إعلان بالذكاء الاصطناعي في أقل من دقيقة.
          </p>
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-2xl bg-gold text-gold-foreground px-10 py-5 font-bold text-lg shadow-gold hover:scale-[1.03] transition"
          >
            افتح الاستوديو الآن
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span>AdForge © {new Date().getFullYear()}</span>
        </div>
        <div>مدعوم بـ Azure AI Foundry</div>
      </div>
    </footer>
  );
}
