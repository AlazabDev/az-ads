import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Sparkles, Plus, Trash2, MessageSquare, LogOut, Loader2, ArrowLeft } from "lucide-react";
import { listCampaigns, createCampaign, deleteCampaign } from "@/lib/campaigns.functions";
import { supabase } from "@/integrations/supabase/client";

const campaignsKey = ["campaigns"] as const;

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "حملاتي — AdForge" },
      { name: "description", content: "قائمة الحملات الإعلانية المحفوظة." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "حملاتي — AdForge" },
      { property: "og:description", content: "استعرض حملاتك الإعلانية المحفوظة وتابع العمل عليها." },
    ],
  }),
  component: CampaignsPage,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-destructive">{error.message}</div>
  ),
});

function CampaignsPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listCampaigns);
  const createFn = useServerFn(createCampaign);
  const deleteFn = useServerFn(deleteCampaign);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: campaignsKey,
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: campaignsKey });
      if (row?.id) navigate({ to: "/campaigns/$campaignId", params: { campaignId: row.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignsKey }),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    router.invalidate();
    navigate({ to: "/auth" });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand grid place-items-center shadow-brand">
              <Sparkles className="w-5 h-5 text-brand-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-brand leading-none">AdForge</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">حملاتي</div>
            </div>
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            تسجيل الخروج
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-brand">حملاتي</h1>
            <p className="text-sm text-muted-foreground mt-1">افتح حملة قديمة أو ابدأ حملة جديدة.</p>
          </div>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand text-brand-foreground px-5 py-3 text-sm font-bold shadow-brand disabled:opacity-60"
          >
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            حملة جديدة
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin inline mb-2" />
            <div>جاري التحميل…</div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <MessageSquare className="w-10 h-10 text-gold mx-auto mb-3" />
            <h3 className="font-bold text-brand text-lg mb-1">لا توجد حملات بعد</h3>
            <p className="text-sm text-muted-foreground mb-5">أنشئ حملة جديدة لتبدأ محادثة مع Copilot.</p>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand text-brand-foreground px-5 py-2.5 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              ابدأ الآن
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <div key={c.id} className="group rounded-2xl border border-border bg-card p-5 hover:border-brand/40 hover:shadow-brand transition">
                <Link
                  to="/campaigns/$campaignId"
                  params={{ campaignId: c.id }}
                  className="block"
                >
                  <div className="flex items-start gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-gold shrink-0 mt-1" />
                    <h3 className="font-bold text-brand line-clamp-2 leading-snug">{c.title}</h3>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    آخر تحديث: {new Date(c.updated_at).toLocaleString("ar")}
                  </div>
                </Link>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <Link
                    to="/campaigns/$campaignId"
                    params={{ campaignId: c.id }}
                    className="text-xs font-semibold text-brand inline-flex items-center gap-1"
                  >
                    فتح
                    <ArrowLeft className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm("حذف هذه الحملة؟")) deleteMut.mutate(c.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// suppress unused imports (kept for future)
void queryOptions;
void useSuspenseQuery;