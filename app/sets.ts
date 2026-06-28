// Registry of available 百名店 award sets. Each entry maps to a scraped
// /public/data/v4/<slug>.json file. Add more as they're scraped.

export type AwardSet = {
  slug: string;
  label: string; // display name
  genre: string; // cuisine genre, for grouping later
};

export type Restaurant = {
  rank: number;
  id: string;
  name: string;
  url: string;
  image: string | null;
  address: string;
  rating: number | null;
  ratingCount: number | null;
  lat: number;
  lng: number;
  genre?: string; // present in prefecture-aggregated data
  year?: number; // award year
  award?: string; // e.g. "2025 ・ 百名店 ラーメン 東日本"
  // Regular closing days. `days` are canonical weekday chars (月火水木金土日,
  // plus 祝 for holidays); `irregular` flags 不定休; `note` keeps free-text the
  // weekday list can't capture. Open every day → { days: [], note: "無休" }.
  closed?: { days: string[]; irregular: boolean; note: string | null };
};

// The registry is generated from the index + scraped data files.
// Run `node scripts/gen-sets.mjs` (or scripts/scrape-all.mjs) to update it.
import { GENERATED_SETS } from "./sets.generated";

export const SETS: AwardSet[] = GENERATED_SETS;
