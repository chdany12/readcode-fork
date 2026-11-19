// Combine per-posting plans into one master plan: for each (topic, language), the largest count any plan
// asks for. A bank built from it fully covers every input plan.
// e.g. plans  [1, 3, 5, 1] and [1, 3, 2, 0]  ->  master [1, 3, 5, 1]
//
// Usage: node pipeline/src/combinePlans.ts --out <master.json> <plan.json>...
//   e.g. node pipeline/src/combinePlans.ts --out postings/master.json postings/plans/[0-9]*.json

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { Plan } from "../../shared/types.ts";

export function combinePlans(plans: Plan[]): Plan {
    const versions = new Set(plans.map((p) => p.taxonomyVersion));
    if (versions.size !== 1) throw new Error(`plans use different taxonomy versions: ${[...versions].join(", ")}`);

    const max = new Map<string, Plan["targets"][number]>(); // key: label + language
    for (const plan of plans) {
        for (const t of plan.targets) {
            const key = `${t.label}|${t.language}`;
            if ((max.get(key)?.count ?? 0) < t.count) max.set(key, { ...t });
        }
    }
    return {
        taxonomyVersion: [...versions][0],
        targets: [...max.values()].sort((a, b) => a.label.localeCompare(b.label) || a.language.localeCompare(b.language)),
    };
}

const USAGE = "Usage: node pipeline/src/combinePlans.ts --out <master.json> <plan.json>...";

function main() {
    const { values, positionals } = parseArgs({ options: { out: { type: "string" } }, allowPositionals: true });
    if (!values.out || positionals.length === 0) {
        console.error(USAGE);
        process.exit(1);
    }
    const master = combinePlans(positionals.map((f) => Plan.parse(JSON.parse(readFileSync(f, "utf8")))));
    writeFileSync(values.out, JSON.stringify(master, null, 2) + "\n");
    const total = master.targets.reduce((s, t) => s + t.count, 0);
    console.log(`combined ${positionals.length} plans -> ${master.targets.length} targets, ${total} examples -> ${values.out}`);
}

// run only when executed directly, not when imported
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
