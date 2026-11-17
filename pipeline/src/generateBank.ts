// Generate the example bank from a master plan: one folder per example, examples/NNN-<topic>/.
// Numbering follows the plan's order (each target's count, in sequence). Existing examples are
// skipped, so an interrupted run resumes where it left off.
//
// Two ways to produce the model's part (the "draft"):
//   --mode api       call the Claude API directly (needs ANTHROPIC_API_KEY)
//   --mode prepare   write one job file per example to <out>/.work/jobs/NNN-<topic>.json with the
//                    system prompt, user message, and defect decision. Run the prompt elsewhere
//                    (e.g. Claude Code subagents) and save its JSON output to
//                    <out>/.work/drafts/NNN-<topic>.json, in the draftSchema shape.
//   --mode assemble  validate each draft and write the example, exactly as the API path does.
//
// Usage: node --env-file-if-exists=.env pipeline/src/generateBank.ts --mode <api|prepare|assemble>
//            [--plan <master.json>] [--out <dir>] [--limit <n>] [--concurrency <n>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { Plan, Taxonomy, type LabelId } from "../../shared/types.ts";
import { SYSTEM_PROMPT, exampleFromDraft, generateExample, prepareRequest, writeExample } from "./exampleGenerator.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_ATTEMPTS = 3; // api mode: generation can fail validation (e.g. a defect snippet that doesn't match)

const { values } = parseArgs({
    options: {
        mode: { type: "string", default: "api" },
        plan: { type: "string", default: path.join(ROOT, "golden_list", "plans", "master.json") },
        out: { type: "string", default: path.join(ROOT, "examples") },
        limit: { type: "string" },
        concurrency: { type: "string", default: "4" },
    },
});

const plan = Plan.parse(JSON.parse(readFileSync(values.plan!, "utf8")));
const taxonomy = Taxonomy.parse(JSON.parse(readFileSync(path.join(ROOT, "pipeline", "taxonomy", `v${plan.taxonomyVersion}.json`), "utf8")));
const out = values.out!;
const jobsDir = path.join(out, ".work", "jobs");
const draftsDir = path.join(out, ".work", "drafts");

// Expand the plan into numbered jobs: 001-<topic>, 002-<topic>, ...
const all = plan.targets.flatMap((t) => Array.from({ length: t.count }, () => t.label));
const width = Math.max(3, String(all.length).length);
const pending = all
    .map((label, i) => {
        const name = `${String(i + 1).padStart(width, "0")}-${label.replace(/^backend\./, "").replaceAll(".", "-")}`;
        return { label, name, index: i, dir: path.join(out, name) };
    })
    .filter((j) => !existsSync(path.join(j.dir, "public.json")));
const limit = values.limit ? Number(values.limit) : undefined;

type Job = { label: LabelId; withDefect: boolean; scenario: string; system: string; user: string };

// Business domains, rotated within each topic so examples of the same concept differ.
const SCENARIOS = [
    "payments and billing", "e-commerce orders and inventory", "ride sharing and dispatch", "food delivery",
    "messaging and notifications", "social feed and content", "video streaming", "file storage and sync",
    "search and indexing", "ads and analytics", "healthcare scheduling", "banking and ledgers",
    "logistics and shipping", "developer platform and CI", "identity and access", "IoT telemetry",
    "travel booking", "multiplayer game backend", "customer support ticketing", "HR and payroll",
];

if (values.mode === "prepare") {
    mkdirSync(jobsDir, { recursive: true });
    const todo = pending.filter((j) => !existsSync(path.join(jobsDir, `${j.name}.json`))).slice(0, limit);
    for (const j of todo) {
        // nth example of this topic gets the nth scenario, offset by topic so topics don't all start alike
        const nth = all.slice(0, j.index).filter((l) => l === j.label).length;
        const offset = plan.targets.findIndex((t) => t.label === j.label);
        const scenario = SCENARIOS[(nth + offset * 7) % SCENARIOS.length];
        const { withDefect, userContent } = prepareRequest(j.label, taxonomy, { scenario });
        const job: Job = { label: j.label, withDefect, scenario, system: SYSTEM_PROMPT, user: userContent };
        writeFileSync(path.join(jobsDir, `${j.name}.json`), JSON.stringify(job, null, 2) + "\n");
    }
    console.log(`${all.length} examples in plan; wrote ${todo.length} job files to ${jobsDir}`);
} else if (values.mode === "assemble") {
    let ok = 0;
    const failed: string[] = [];
    for (const j of pending.slice(0, limit)) {
        const draftFile = path.join(draftsDir, `${j.name}.json`);
        const jobFile = path.join(jobsDir, `${j.name}.json`);
        if (!existsSync(draftFile) || !existsSync(jobFile)) continue;
        try {
            const job: Job = JSON.parse(readFileSync(jobFile, "utf8"));
            const example = exampleFromDraft(JSON.parse(readFileSync(draftFile, "utf8")), job.label, taxonomy, job.withDefect);
            await writeExample(example, j.dir);
            ok++;
            console.log(`✓ ${j.name}`);
        } catch (err) {
            failed.push(j.name);
            console.warn(`✗ ${j.name}: ${(err as Error).message}`);
        }
    }
    console.log(`assembled ${ok}, failed ${failed.length}${failed.length ? ": " + failed.join(", ") : ""}`);
} else if (values.mode === "api") {
    const todo = pending.slice(0, limit);
    console.log(`${all.length} examples in plan, ${todo.length} to generate this run`);
    let next = 0;
    let ok = 0;
    const failed: string[] = [];
    const worker = async () => {
        while (next < todo.length) {
            const j = todo[next++];
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    await writeExample(await generateExample(j.label, taxonomy), j.dir);
                    ok++;
                    console.log(`✓ ${j.name}`);
                    break;
                } catch (err) {
                    const msg = (err as Error).message;
                    console.warn(`✗ ${j.name} attempt ${attempt}: ${msg}`);
                    if (/authentication|api key|apiKey/i.test(msg)) throw err; // retrying can't fix missing credentials
                    if (attempt === MAX_ATTEMPTS) failed.push(j.name);
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Number(values.concurrency)) }, worker));
    console.log(`done: ${ok} written, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
} else {
    throw new Error(`Unknown --mode ${values.mode} (api, prepare, assemble)`);
}
