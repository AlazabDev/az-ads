import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — AdForge" },
      { name: "description", content: "سجّل الدخول أو أنشئ حساباً لحفظ حملاتك الإعلانية." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/campaigns" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/campaigns" },
        });
        if (error) throw error;
        setInfo("تم إنشاء الحساب. إن كنت مطالباً بتأكيد البريد فتحقّق من بريدك، وإلا يمكنك تسجيل الدخول الآن.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/campaigns" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center bg-background bg-gradient-mesh p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
            <Sparkles className="w-5 h-5 text-brand-foreground" />
          </div>
          <span className="font-display font-bold text-2xl text-brand">AdForge</span>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h1 className="text-2xl font-black text-brand mb-1">
            {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "ادخل لمتابعة حملاتك المحفوظة." : "أنشئ حساباً لحفظ حملاتك."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-brand mb-1 block">البريد الإلكتروني</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-brand mb-1 block">كلمة المرور</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] outline-none focus:border-brand"
              />
            </div>

            {error && <div className="text-xs text-destructive bg-destructive/5 border border-destructive/30 rounded-lg p-3">{error}</div>}
            {info && <div className="text-xs text-brand bg-brand/5 border border-brand/30 rounded-lg p-3">{info}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground py-3 font-bold shadow-brand disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {mode === "signin" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
            className="mt-5 text-sm text-muted-foreground hover:text-brand w-full text-center"
          >
            {mode === "signin" ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </div>

        <Link to="/" className="mt-6 flex items-center gap-1 justify-center text-sm text-muted-foreground hover:text-brand">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}