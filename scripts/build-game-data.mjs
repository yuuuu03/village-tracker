// Builds public/game-data.json (upgrade levels, times, costs) from an open dataset.
// Run: node scripts/build-game-data.mjs   (Node 18+)
// Source can be changed with GAME_DATA_URL. Check the source's licence before publishing.
// The converter reads the dataset generically (any object with an id + a levels array),
// so it survives small format changes; check the printed sample after each run.
import { writeFile } from "node:fs/promises";

// Set GAME_DATA_URL (GitHub → Settings → Secrets and variables → Actions → Variables) to a JSON
// dataset you trust. Each item needs its game id (e.g. 1000008) and a levels array with the
// Town Hall required, upgrade time and cost per level.
const SRC = process.env.GAME_DATA_URL;
if (!SRC) { console.log("GAME_DATA_URL is not set, so there is nothing to build. Max levels are built into the app; this only adds times and costs."); process.exit(0); }

const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : undefined; };
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null) return o[k]; };
const secs = (t) => {
  if (t == null) return undefined;
  if (typeof t === "number" || /^\d+$/.test(String(t))) return Number(t);
  if (typeof t === "object") return (t.days || t.d || 0) * 86400 + (t.hours || t.h || 0) * 3600 + (t.minutes || t.m || 0) * 60 + (t.seconds || t.s || 0);
  const m = String(t).match(/(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : undefined;
};
const resOf = (r) => {
  const s = String(r || "").toLowerCase();
  if (s.includes("dark")) return "dark";
  if (s.includes("builder") && s.includes("elixir")) return "builder_elixir";
  if (s.includes("builder") && s.includes("gold")) return "builder_gold";
  if (s.includes("elixir")) return "elixir";
  if (s.includes("gold")) return "gold";
  if (s.includes("gem")) return "gems";
  return s || undefined;
};

const raw = await (await fetch(SRC)).json();
const items = {};
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  const id = num(pick(node, ["id", "dataId", "data", "_id"]));
  const levels = pick(node, ["levels", "levelData", "upgrades"]);
  if (id && id >= 1_000_000 && Array.isArray(levels) && levels.length && !items[id]) {
    const nodeRes = pick(node, ["upgradeResource", "resource", "buildResource", "costResource"]);
    const out = [];
    levels.forEach((L, i) => {
      if (!L || typeof L !== "object") return;
      out.push({
        lv: num(pick(L, ["level", "lvl", "lv"])) ?? i + 1,
        th: num(pick(L, ["townHall", "townHallLevel", "th", "requiredTownHall", "hallLevel", "thRequired", "requiredHall"])),
        sec: secs(pick(L, ["upgradeTime", "buildTime", "researchTime", "time", "upgradeTimeSeconds", "seconds", "duration"])),
        cost: num(pick(L, ["upgradeCost", "buildCost", "researchCost", "cost", "price"])),
        res: resOf(pick(L, ["upgradeResource", "buildResource", "resource", "costResource"]) ?? nodeRes),
      });
    });
    if (out.length) items[id] = { name: pick(node, ["name", "displayName"]), levels: out };
  }
  Object.values(node).forEach(walk);
};
walk(raw);

const ids = Object.keys(items);
await writeFile(new URL("../public/game-data.json", import.meta.url), JSON.stringify({ source: SRC, built: new Date().toISOString(), items }));
console.log(`game-data.json: ${ids.length} items`);
const sample = items[1000008] || items[ids[0]];
console.log("sample (Cannon):", JSON.stringify(sample && { ...sample, levels: sample.levels.slice(-3) }, null, 1));
if (!ids.length) { console.error("No items found: the source format changed. Ask for the converter to be updated."); process.exit(1); }
