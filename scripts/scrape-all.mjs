// Scrape every 百名店 set, sequentially and resumably. Sets that already have
// a public/data/<slug>.json are skipped, so this can be re-run / resumed any
// time. Regenerates app/sets.generated.ts when done.
//
//   node scripts/scrape-all.mjs
//
// Be mindful: this visits ~7000 detail pages. Keep it sequential (one set at a
// time) — do not parallelize against Tabelog.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadSetCatalog } from "./lib/catalog.mjs";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
    );
  });
}

const catalog = await loadSetCatalog();
console.log(`Catalog: ${catalog.length} sets`);

let done = 0;
let scraped = 0;
for (const { slug, label } of catalog) {
  done++;
  if (existsSync(path.join(DATA_DIR, `${slug}.json`))) {
    console.log(`[${done}/${catalog.length}] skip ${slug} (already scraped)`);
    continue;
  }
  console.log(`[${done}/${catalog.length}] scraping ${slug} — ${label}`);
  await run("node", ["scripts/scrape-hyakumeiten.mjs", slug]);
  scraped++;
}

console.log(`\nScraped ${scraped} new set(s). Regenerating registry…`);
await run("node", ["scripts/gen-sets.mjs"]);
console.log("Done.");
