
-- Studio generated assets (images/videos)
CREATE TABLE public.studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  prompt TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  model TEXT,
  width INT,
  height INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_assets TO authenticated;
GRANT ALL ON public.studio_assets TO service_role;
ALTER TABLE public.studio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own studio assets" ON public.studio_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX studio_assets_user_created_idx ON public.studio_assets (user_id, created_at DESC);

-- Social account connections (WhatsApp/Telegram/Meta ...)
CREATE TABLE public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  account_label TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, account_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connections" ON public.social_connections FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies on Alazab-Ads bucket: allow authenticated users to upload/delete
-- their own uploads (raw_images/) and read all (bucket is public anyway).
CREATE POLICY "auth upload alazab" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'Alazab-Ads');
CREATE POLICY "auth update alazab" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'Alazab-Ads' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'Alazab-Ads' AND owner = auth.uid());
CREATE POLICY "auth delete alazab" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'Alazab-Ads' AND owner = auth.uid());
