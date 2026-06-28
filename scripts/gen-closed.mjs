// Stamp each restaurant with its regular closing days (定休日), read from the
// cached Tabelog detail page. Local only — no network. Use this to backfill
// public/data/v4/<slug>.json files that were scraped before the scraper began
// capturing `closed`. New scrapes pick it up directly in scrape-hyakumeiten.mjs.
//
//   node scripts/gen-closed.mjs
//
// Rewrites public/data/v4/<slug>.json in place. Run gen-prefectures.mjs
// afterward to propagate `closed` into the per-prefecture files.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadSetCatalog } from "./lib/catalog.mjs";
import { extractClosed } from "./lib/closed.mjs";

const DATA_DIR = path.join(process.cwd(), "public", "data", "v4");
const CACHE_DIR = path.join(process.cwd(), ".scrape-cache");

const catalog = await loadSetCatalog();
let sets = 0;
let stamped = 0;
let missing = 0;

for (const { slug } of catalog) {
  const dataFile = path.join(DATA_DIR, `${slug}.json`);
  if (!existsSync(dataFile)) continue;
  sets++;

  const rows = JSON.parse(await readFile(dataFile, "utf8"));
  for (const r of rows) {
    const html = path.join(CACHE_DIR, slug, `${r.id}.html`);
    if (!existsSync(html)) {
      missing++;
      continue;
    }
    const closed = extractClosed(await readFile(html, "utf8"));
    if (closed) {
      r.closed = closed;
      stamped++;
    }
  }

  await writeFile(dataFile, JSON.stringify(rows, null, 2));
}

console.log(
  `Stamped 定休日 on ${stamped} restaurants across ${sets} sets ` +
    `(${missing} without a cached page).`,
);
