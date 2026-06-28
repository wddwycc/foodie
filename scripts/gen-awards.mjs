// Stamp each restaurant with the award it won: year + 百名店 + genre + region,
// e.g. "2025 ・ 百名店 ラーメン 東日本". The year is read from the cached award
// set page (the `hyakumeiten_<slug>_<year>_restaurant` token); genre/region
// come from the index catalog. Local only — no network.
//
//   node scripts/gen-awards.mjs
//
// Rewrites public/data/v2/<slug>.json in place. Run gen-prefectures.mjs afterward
// to propagate the award into the per-prefecture files.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadSetCatalog } from "./lib/catalog.mjs";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v2");
const CACHE_DIR = path.join(process.cwd(), ".scrape-cache");

function awardLabel(year, genre, region) {
  return `${year} ・ 百名店 ${genre}${region ? ` ${region}` : ""}`;
}

const catalog = await loadSetCatalog();
let stamped = 0;

for (const { slug, genre, region } of catalog) {
  const dataFile = path.join(DATA_DIR, `${slug}.json`);
  const setHtml = path.join(CACHE_DIR, slug, "_set.html");
  if (!existsSync(dataFile) || !existsSync(setHtml)) continue;

  const html = await readFile(setHtml, "utf8");
  const yearMatch = html.match(
    new RegExp(`hyakumeiten_${slug}_(\\d{4})_restaurant`),
  );
  const year = yearMatch ? Number(yearMatch[1]) : null;
  if (!year) {
    console.warn(`  ! no year for ${slug}`);
    continue;
  }

  const label = awardLabel(year, genre, region);
  const rows = JSON.parse(await readFile(dataFile, "utf8"));
  for (const r of rows) {
    r.year = year;
    r.award = label;
  }
  await writeFile(dataFile, JSON.stringify(rows, null, 2));
  stamped += rows.length;
}

console.log(`Stamped award onto ${stamped} restaurants across set files.`);
console.log("Now run: node scripts/gen-prefectures.mjs");
