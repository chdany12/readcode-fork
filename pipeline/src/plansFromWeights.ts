// Build plans/NNN.json from externally produced classifications in plans/weights/NNN.json
// (format: {"weights": [{"label": "...", "weight": 0.0-1.0}, ...]}, same as the classifier's output schema).
//
// Usage: node pipeline/src/plansFromWeights.ts [plansDir]   (default: golden_list/plans)

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Taxonomy, type Classification } from "../../shared/types.ts";
import { planFromClassification } from "./pipeline.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TAXONOMY_VERSION = "0.1.0";

const plansDir = path.resolve(process.argv[2] ?? path.join(ROOT, "golden_list", "plans"));
const taxonomy = Taxonomy.parse(JSON.parse(readFileSync(path.join(ROOT, "pipeline", "taxonomy", `v${TAXONOMY_VERSION}.json`), "utf8")));

let n = 0;
for (const file of readdirSync(path.join(plansDir, "weights")).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(path.join(plansDir, "weights", file), "utf8")) as { weights: { label: string; weight: number }[] };
    const byLabel = new Map<string, number>();
    for (const { label, weight } of raw.weights) {
        if (!taxonomy.labels.includes(label)) throw new Error(`${file}: unknown label ${label}`);
        byLabel.set(label, Math.min(1, Math.max(0, weight)));
    }
    const classification: Classification = {
        taxonomyVersion: taxonomy.version,
        weights: taxonomy.labels.map((l) => byLabel.get(l) ?? 0),
    };
    const plan = planFromClassification(classification, taxonomy);
    writeFileSync(path.join(plansDir, file), JSON.stringify(plan, null, 2) + "\n");
    n++;
}
console.log(`wrote ${n} plans to ${plansDir}`);
