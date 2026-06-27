// Polite, resumable scraper for Tabelog 百名店 (hyakumeiten) award sets.
//
//   node scripts/scrape-hyakumeiten.mjs [set-slug]   (default: ramen_hokkaido)
//
// Pulls the restaurant list from the award set page, then visits each Tabelog
// detail page to read its JSON-LD (name, address, coordinates, rating).
// Raw HTML is cached under .scrape-cache/ so reruns are free and interrupted
// runs resume. Output: public/data/<set>.json
//
// Note: Tabelog's ToS restricts scraping. Keep the delay generous and the
// volume low; this is meant for a one-time, low-frequency collection.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const SET = process.argv[2] || "ramen_hokkaido";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";
const DELAY_MS = 1500;
const CACHE_DIR = path.join(process.cwd(), ".scrape-cache", SET);
const OUT_DIR = path.join(process.cwd(), "public", "data");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCached(url, key) {
  const file = path.join(CACHE_DIR, `${key}.html`);
  if (existsSync(file)) return readFile(file, "utf8");
  await mkdir(CACHE_DIR, { recursive: true });
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "ja" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await writeFile(file, html);
      await sleep(DELAY_MS); // only delay on a real network hit
      return html;
    } catch (err) {
      lastErr = err;
      await sleep(2000 * attempt);
    }
  }
  throw lastErr;
}

function extractDetailUrls(setHtml) {
  const re = /href="(https:\/\/tabelog\.com\/[a-z]+\/A\d+\/A\d+\/\d+\/)"/g;
  const seen = new Set();
  const urls = [];
  let m;
  while ((m = re.exec(setHtml))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      urls.push(m[1]);
    }
  }
  return urls;
}

function parseRestaurant(html, url) {
  const re =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) {
      if (node["@type"] !== "Restaurant") continue;
      const a = node.address || {};
      const r = node.aggregateRating;
      return {
        id: url.match(/(\d+)\/$/)?.[1] ?? url,
        name: node.name ?? null,
        url,
        image: node.image ?? null,
        address: [a.addressRegion, a.addressLocality, a.streetAddress]
          .filter(Boolean)
          .join(""),
        rating: r ? Number(r.ratingValue) : null,
        ratingCount: r ? Number(r.ratingCount) : null,
        lat: node.geo ? Number(node.geo.latitude) : null,
        lng: node.geo ? Number(node.geo.longitude) : null,
      };
    }
  }
  return null;
}

async function main() {
  console.log(`Scraping set: ${SET}`);
  const setHtml = await fetchCached(
    `https://award.tabelog.com/hyakumeiten/${SET}`,
    "_set",
  );
  const urls = extractDetailUrls(setHtml);
  console.log(`Found ${urls.length} restaurants`);

  const out = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const id = url.match(/(\d+)\/$/)?.[1] ?? String(i);
    try {
      const html = await fetchCached(url, id);
      const r = parseRestaurant(html, url);
      if (r && r.lat != null) {
        out.push({ rank: i + 1, ...r });
        console.log(`  [${i + 1}/${urls.length}] ${r.name} (${r.rating})`);
      } else {
        console.warn(`  ! no coords: ${url}`);
      }
    } catch (err) {
      console.warn(`  ! failed ${url}: ${err.message}`);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${SET}.json`);
  await writeFile(outFile, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} restaurants -> ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
