// The Pipeline
// pre-step:
// have an example bank with discrete counts (concepts covered from example: +1)
// steps:
// 1. take job posting as input
// 2. classify weights for the job posting
// 3. coverage test, proceed if not covered
// 4. rank concepts by shortfall
// 5. choose highest shortfall concept to create an example with
// 6. Anchor file is chosen from out of our open-source repo pool that scores best with the shortfall concept. The LLM picks supporting files that the file needs. score takes into account file reuse count (use example bank)
// 7. scrape the files needed to create the example
// 8. self-contain the example (no function references to files not selected)
// 9. inject bugs if relevant
// 10. Verify through compiling
// 11. generate a rubric
// 12. human review
// 13. add to the bank and update the counts.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { LanguageList, Plan, Taxonomy, type Classification } from "../../shared/types.ts";
import { classify } from "./classifier.ts";
import { generateExample, writeExample } from "./exampleGenerator.ts";

const EXAMPLES_PER_POSTING = 20;
const MIN_PER_TOPIC = 2;
const SHARE_POWER = 2;
const DEFAULT_LANGUAGE = "TypeScript"; // when a posting names no language


// use a job description file to create a plan file
async function plan(jobDescription: string, taxonomy: Taxonomy, languages: LanguageList): Promise<Plan> {
    // 1. classify
    const classification = await classify(jobDescription, taxonomy, languages);
    return planFromClassification(classification, taxonomy);
}

// steps 2-6: turn a classification (weights per label) into example counts
export function planFromClassification(classification: Classification, taxonomy: Taxonomy): Plan {
    // 1. rank concepts
    const ranked = taxonomy.labels
        .map((label, i) => ({ label, weight: classification.weights[i], i }))
        .filter((r) => r.weight > 0)
        .sort((a, b) => b.weight - a.weight || a.i - b.i);

    // 2. Keep only the topics that will get examples, and split the examples across them by squared weight
    //    (0.6 is worth four times 0.3, not twice). If any topic would get fewer than MIN_PER_TOPIC, drop the
    //    weakest and split again (like an electoral threshold).
    const shares = (rs: typeof ranked) => normalize(rs.map((r) => r.weight ** SHARE_POWER));
    let chosen = ranked.slice(0, Math.floor(EXAMPLES_PER_POSTING / MIN_PER_TOPIC));
    let counts = largestRemainder(EXAMPLES_PER_POSTING, shares(chosen));
    while (chosen.length > 1 && Math.min(...counts) < MIN_PER_TOPIC) {
        chosen = chosen.slice(0, -1);
        counts = largestRemainder(EXAMPLES_PER_POSTING, shares(chosen));
    }

    // 3. Split the plan's examples across the posting's languages by their weights, then hand each secondary
    //    language's examples to topics strongest-first, one per topic per pass, never taking a topic's last
    //    example of the primary language. The primary language gets the rest. No languages named -> DEFAULT_LANGUAGE.
    const langs = Object.entries(classification.languages)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1]);
    const languages = langs.length ? langs.map(([l]) => l) : [DEFAULT_LANGUAGE];
    const langTotals = langs.length ? largestRemainder(EXAMPLES_PER_POSTING, normalize(langs.map(([, w]) => w))) : [EXAMPLES_PER_POSTING];

    const primary = [...counts]; // per topic, examples still in the primary language
    const byLanguage: number[][] = languages.map(() => chosen.map(() => 0)); // [language][topic]
    for (let k = 1; k < languages.length; k++) {
        let left = langTotals[k];
        while (left > 0) {
            let given = 0;
            for (let j = 0; j < chosen.length && left > 0; j++) {
                if (primary[j] > 1) {
                    primary[j]--;
                    byLanguage[k][j]++;
                    left--;
                    given++;
                }
            }
            if (given === 0) break; // every topic is down to one primary example; the rest stays primary
        }
    }
    byLanguage[0] = primary;

    return {
        taxonomyVersion: taxonomy.version,
        targets: chosen.flatMap((r, j) =>
            languages
                .map((language, k) => ({ label: r.label, language, count: byLanguage[k][j] }))
                .filter((t) => t.count > 0),
        ),
    };
}

function normalize(values: number[]): number[] {
    const total = values.reduce((s, x) => s + x, 0);
    return values.map((x) => x / total); // sums to 1
}

// Split `total` items by `shares` (summing to 1) into whole numbers: round each ideal amount down, then
// give the leftover items to the largest fractional parts (largest remainder / Hamilton method).
// e.g. ideal = 2.8, 3.7, 3.5 -> floors 2, 3, 3 -> leftover 2 -> 3, 4, 3
function largestRemainder(total: number, shares: number[]): number[] {
    const ideal = shares.map((s) => s * total);
    const counts = ideal.map(Math.floor);
    const leftover = total - counts.reduce((s, c) => s + c, 0);
    ideal
        .map((q, i) => ({ i, remainder: q - Math.floor(q) }))
        .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
        .slice(0, leftover)
        .forEach(({ i }) => counts[i]++);
    return counts;
}

// exampleOut: folder to write the generated example to. Without it, only report the topic.
async function pipeline(plan: Plan, taxonomy: Taxonomy, exampleOut?: string) {
    // TODO: count bank, compute shortfall; for now take the top target
    const topic = plan.targets[0].label;
    console.log(`going to create an example for ${topic}`);
    if (!exampleOut) return;

    const example = await generateExample(topic, taxonomy);
    await writeExample(example, exampleOut);
    console.log(`Example written to ${exampleOut}`);
}

// Every mode needs --taxonomy <taxonomy.json>; classifying (standard, --create_plan) also needs --languages <languages.json>.
// standard:     node pipeline/src/pipeline.ts <job_description_file.txt>                          plan → pipeline
// plan only:    node pipeline/src/pipeline.ts <job_description_file.txt> --create_plan <out.json>  plan → write file
// reuse a plan: node pipeline/src/pipeline.ts --use_plan <plan.json>                               read file → pipeline
// add --example_out <dir> to standard or --use_plan to generate the example into <dir> (public.json, key.json, src/)
async function main() {
    const { values, positionals } = parseArgs({
        options: { taxonomy:    { type: "string" },
                   languages:   { type: "string" },
                   create_plan: { type: "string" },
                   use_plan:    { type: "string" },
                   example_out: { type: "string" } },
        allowPositionals: true,
    });
    const usage = "Usage: node pipeline/src/pipeline.ts --taxonomy <taxonomy.json> (--languages <languages.json> <job_description_file.txt> [--create_plan <out.json>] | --use_plan <plan.json>) [--example_out <dir>]";
    if (!values.taxonomy) {
        console.error(usage);
        process.exit(1);
    }
    const taxonomy = Taxonomy.parse(JSON.parse(await readFile(values.taxonomy, "utf8")));

    if (values.create_plan && values.use_plan) {
        console.error("--create_plan and --use_plan can't be used together.\n" + usage);
        process.exit(1);
    }
    if (values.create_plan && values.example_out) {
        console.error("--example_out does nothing with --create_plan (no pipeline run).\n" + usage);
        process.exit(1);
    }

    // --use_plan: skip planning, run the pipeline on a saved plan
    if (values.use_plan) {
        const saved = Plan.parse(JSON.parse(await readFile(values.use_plan, "utf8")));
        await pipeline(saved, taxonomy, values.example_out);
        return;
    }

    const jobDescriptionFile = positionals[0];
    if (!jobDescriptionFile || !values.languages) {
        console.error(usage);
        process.exit(1);
    }
    const description = await readFile(jobDescriptionFile, "utf8");
    const languages = LanguageList.parse(JSON.parse(await readFile(values.languages, "utf8")));
    const result = await plan(description, taxonomy, languages);

    // --create_plan: save the plan and stop
    if (values.create_plan) {
        await writeFile(values.create_plan, JSON.stringify(result, null, 2) + "\n");
        console.log(`Plan written to ${values.create_plan}`);
        return;
    }

    // standard: plan, then pipeline
    await pipeline(result, taxonomy, values.example_out);
}

// run only when executed directly, not when imported
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
