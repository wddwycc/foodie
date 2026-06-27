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

export const SETS: AwardSet[] = [
  { slug: "ramen_hokkaido", label: "ラーメン 北海道", genre: "ラーメン" },
  { slug: "sushi_east", label: "寿司 東日本", genre: "寿司" },
];
