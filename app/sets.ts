// Registry of available 百名店 award sets. Each entry maps to a scraped
// /public/data/<slug>.json file. Add more as they're scraped.

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
};

// The registry is generated from the index + scraped data files.
// Run `node scripts/gen-sets.mjs` (or scripts/scrape-all.mjs) to update it.
import { GENERATED_SETS } from "./sets.generated";

export const SETS: AwardSet[] = GENERATED_SETS;
