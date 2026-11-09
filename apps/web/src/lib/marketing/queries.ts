import 'server-only';
import type { BlurRegion, MarketingCaptions, MarketingTone } from '@preuvio/shared';
import { supabaseServer } from '../supabase/server';

// Contenus marketing lus avec la session (RLS : admin et dirigeant seulement).

export type MarketingRow = {
  id: string;
  company_id: string;
  jobsite_id: string;
  status: 'to_review' | 'published' | 'ignored';
  city: string | null;
  captions: Partial<MarketingCaptions>;
  tone: MarketingTone | null;
  generated_text: string | null;
  before_regions: BlurRegion[];
  after_regions: BlurRegion[];
  square_path: string | null;
  story_path: string | null;
  reviewed_at: string | null;
  created_at: string;
  jobsites: { reference: string | null } | null;
};

const COLUMNS = `id, company_id, jobsite_id, status, city, captions, tone, generated_text, before_regions,
  after_regions, square_path, story_path, reviewed_at, created_at, jobsites ( reference )`;

export async function loadMarketingQueue() {
  const supabase = await supabaseServer();
  const [toReview, published] = await Promise.all([
    supabase
      .from('marketing_assets')
      .select(COLUMNS)
      .eq('status', 'to_review')
      .order('created_at', { ascending: false })
      .returns<MarketingRow[]>(),
    supabase
      .from('marketing_assets')
      .select(COLUMNS)
      .eq('status', 'published')
      .order('reviewed_at', { ascending: false })
      .limit(12)
      .returns<MarketingRow[]>(),
  ]);
  return { toReview: toReview.data ?? [], published: published.data ?? [] };
}

/** Contenu et ce qu'il faut pour composer ses visuels (photos, logo, couleur, nom). */
export async function loadMarketingAsset(id: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('marketing_assets')
    .select(
      `id, company_id, city, square_path, story_path, before_regions, after_regions,
       before:photos!marketing_assets_before_photo_id_company_id_fkey ( original_path, thumbnail_path ),
       after:photos!marketing_assets_after_photo_id_company_id_fkey ( original_path, thumbnail_path ),
       companies ( name, logo_path, brand_color )`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  type Photo = { original_path: string; thumbnail_path: string | null };
  return data as unknown as {
    id: string;
    company_id: string;
    city: string | null;
    square_path: string | null;
    story_path: string | null;
    before_regions: BlurRegion[];
    after_regions: BlurRegion[];
    before: Photo;
    after: Photo;
    companies: { name: string; logo_path: string | null; brand_color: string | null };
  };
}
