-- =========================================================
-- Phase 1: Ads platform schema expansion
-- =========================================================

-- 1) Extend campaigns with campaign-level metadata
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT 'awareness'
    CHECK (objective IN ('awareness','traffic','engagement','leads','sales','app_promotion')),
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'both'
    CHECK (platform IN ('facebook','instagram','both')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','scheduled','completed','archived')),
  ADD COLUMN IF NOT EXISTS budget NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2) media_assets: images/videos tied to a campaign (uploads, library, AI-enhanced)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  original_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image','video')),
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','library','ai_enhanced')),
  storage_path TEXT,
  url TEXT NOT NULL,
  title TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','processing','failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own media_assets" ON public.media_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX media_assets_user_created_idx ON public.media_assets(user_id, created_at DESC);
CREATE INDEX media_assets_campaign_idx ON public.media_assets(campaign_id);
CREATE TRIGGER update_media_assets_updated_at BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ad_creatives: final ad unit (copy + media + platform + format)
CREATE TABLE IF NOT EXISTS public.ad_creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'عنصر إعلاني',
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  call_to_action TEXT,
  platform TEXT NOT NULL DEFAULT 'facebook' CHECK (platform IN ('facebook','instagram')),
  format TEXT NOT NULL DEFAULT 'feed_square'
    CHECK (format IN ('feed_square','feed_portrait','feed_landscape','story','reel','carousel')),
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;
GRANT ALL ON public.ad_creatives TO service_role;
ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ad_creatives" ON public.ad_creatives FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ad_creatives_campaign_idx ON public.ad_creatives(campaign_id, created_at DESC);
CREATE INDEX ad_creatives_user_idx ON public.ad_creatives(user_id);
CREATE TRIGGER update_ad_creatives_updated_at BEFORE UPDATE ON public.ad_creatives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) social_accounts: connected Meta pages / IG business accounts
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'facebook' CHECK (provider IN ('facebook','instagram')),
  account_type TEXT NOT NULL DEFAULT 'page' CHECK (account_type IN ('page','ig_business')),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','expired','revoked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, external_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own social_accounts" ON public.social_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX social_accounts_user_idx ON public.social_accounts(user_id);
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) social_account_secrets: access tokens, service_role ONLY (no authenticated grant, RLS on)
CREATE TABLE IF NOT EXISTS public.social_account_secrets (
  social_account_id UUID NOT NULL PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.social_account_secrets TO service_role;
ALTER TABLE public.social_account_secrets ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policy for authenticated: only service_role (which bypasses RLS) can access.

-- 6) scheduled_posts: scheduling of ad creatives to social accounts
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ad_creative_id UUID REFERENCES public.ad_creatives(id) ON DELETE SET NULL,
  social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','publishing','published','failed','canceled')),
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_posts TO authenticated;
GRANT ALL ON public.scheduled_posts TO service_role;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled_posts" ON public.scheduled_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX scheduled_posts_user_idx ON public.scheduled_posts(user_id, scheduled_at DESC);
CREATE INDEX scheduled_posts_campaign_idx ON public.scheduled_posts(campaign_id);
CREATE INDEX scheduled_posts_due_idx ON public.scheduled_posts(status, scheduled_at);
CREATE TRIGGER update_scheduled_posts_updated_at BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) campaign_insights: performance metrics pulled from Meta
CREATE TABLE IF NOT EXISTS public.campaign_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  scheduled_post_id UUID REFERENCES public.scheduled_posts(id) ON DELETE SET NULL,
  external_post_id TEXT,
  platform TEXT NOT NULL DEFAULT 'facebook' CHECK (platform IN ('facebook','instagram')),
  impressions BIGINT NOT NULL DEFAULT 0,
  reach BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  engagements BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_insights TO authenticated;
GRANT ALL ON public.campaign_insights TO service_role;
ALTER TABLE public.campaign_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign_insights" ON public.campaign_insights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX campaign_insights_campaign_idx ON public.campaign_insights(campaign_id, captured_at DESC);
CREATE INDEX campaign_insights_user_idx ON public.campaign_insights(user_id);
