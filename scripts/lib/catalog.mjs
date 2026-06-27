// Parse the 百名店 index page into a catalog of award sets.
// Each entry: { slug, genre (JP), region (JP, "" for national), label }.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const INDEX_URL = "https://award.tabelog.com/hyakumeiten";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

// English region key (from the slug suffix) → Japanese label.
const REGION_JP = {
  hokkaido: "北海道",
  tokyo: "東京",
  kanagawa: "神奈川",
  aichi: "愛知",
  osaka: "大阪",
  kagawa: "香川",
  east: "東日本",
  west: "西日本",
};
const REGION_RE = new RegExp(`_(${Object.keys(REGION_JP).join("|")})$`);

async function fetchIndexHtml() {
  const file = path.join(process.cwd(), ".scrape-cache", "_index.html");
  if (existsSync(file)) return readFile(file, "utf8");
  const res = await fetch(INDEX_URL, {
    headers: { "User-Agent": UA, "Accept-Language": "ja" },
  });
  if (!res.ok) throw new Error(`index HTTP ${res.status}`);
  const html = await res.text();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  return html;
}

export async function loadSetCatalog() {
  const html = await fetchIndexHtml();

  // The "cassette" section groups each genre's title with its area links.
  const chunks = html.split("hyakumeiten-cassette__item").slice(1);
  const out = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const titleMatch = chunk.match(
      /hyakumeiten-cassette__title">\s*([^<]+?)\s*<\/p>/,
    );
    if (!titleMatch) continue;
    const genre = titleMatch[1].replace(/\s*百名店\s*$/, "").trim();

    const slugs = [
      ...chunk.matchAll(/href="\/hyakumeiten\/([a-z0-9_]+)"/g),
    ].map((m) => m[1]);

    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const regionMatch = slug.match(REGION_RE);
      const region = regionMatch ? REGION_JP[regionMatch[1]] : "";
      out.push({
        slug,
        genre,
        region,
        label: region ? `${genre} ${region}` : genre,
      });
    }
  }

  return out;
}

// Allow `node scripts/lib/catalog.mjs` for a quick dump.
if (import.meta.url === `file://${process.argv[1]}`) {
  const catalog = await loadSetCatalog();
  console.log(`${catalog.length} sets`);
  for (const c of catalog) console.log(`  ${c.slug.padEnd(24)} ${c.label}`);
}
