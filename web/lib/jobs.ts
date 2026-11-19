// Server-only: job postings (postings/jobs.json) with their plans (postings/plans/NNN.json,
// NNN = 1-based position in the postings list), matched against the example bank.
import { readFile } from "node:fs/promises";
import { cache } from "react";
import path from "node:path";
import type { Plan } from "../../shared/types";
import { EXAMPLES_ROOT, listExamples, type ExampleSummary } from "./examples";

const GOLDEN = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "postings");

type Posting = { company: string; title: string; location?: string | null; url: string; level_signal?: string };

// One topic of a posting's plan. `needed`/`examples` add up over the topic's languages; `languages` says how many
// the plan asks for in each language and how many the bank has. weight: the classifier's 0-1 relevance.
export type TopicMatch = {
    label: string;
    weight: number;
    needed: number;
    examples: ExampleSummary[]; // at most `needed`, in the plan's languages
    languages: { language: string; needed: number; have: number }[];
};
export type JobMatch = {
    id: string;          // "001"
    company: string;
    title: string;
    location: string | null;
    url: string;
    needed: number;      // examples in the posting's plan
    matched: number;     // of those, available in the bank
    topics: TopicMatch[];
    languages: string[];  // the plan's languages, most examples first
    profile: { label: string; weight: number }[]; // every taxonomy label in taxonomy order, 0 if unweighted
};

// cached per request: the home page tiles, role pages and the exercises page all use it
export const listJobMatches = cache(loadJobMatches);

async function loadJobMatches(): Promise<JobMatch[]> {
    const [postingsRaw, taxonomyRaw, examples] = await Promise.all([
        readFile(path.join(GOLDEN, "jobs.json"), "utf8"),
        readFile(path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "pipeline", "taxonomy", "v0.1.0.json"), "utf8"),
        listExamples(),
    ]);
    const postings = JSON.parse(postingsRaw) as Posting[];
    const taxonomy = JSON.parse(taxonomyRaw) as { labels: string[] };
    const byPair = Map.groupBy(examples, (e) => `${e.topic}|${e.language}`);

    return Promise.all(
        postings.map(async (p, i) => {
            const id = String(i + 1).padStart(3, "0");
            const [planRaw, raw] = await Promise.all([
                readFile(path.join(GOLDEN, "plans", `${id}.json`), "utf8").catch(() => '{"targets":[]}'),
                readFile(path.join(GOLDEN, "plans", "weights", `${id}.json`), "utf8").catch(() => '{"weights":[]}'),
            ]);
            const plan = JSON.parse(planRaw) as Plan;
            const weights = new Map((JSON.parse(raw).weights as { label: string; weight: number }[]).map((w) => [w.label, w.weight]));
            // targets are per (topic, language); group them back into topics, keeping the plan's order
            const topics: TopicMatch[] = [...Map.groupBy(plan.targets, (t) => t.label).entries()].map(([label, targets]) => {
                const languages = targets.map((t) => {
                    const pool = byPair.get(`${label}|${t.language}`) ?? [];
                    return { language: t.language, needed: t.count, have: Math.min(pool.length, t.count), pool };
                });
                return {
                    label,
                    weight: weights.get(label) ?? 0,
                    needed: languages.reduce((s, l) => s + l.needed, 0),
                    examples: languages.flatMap((l) => l.pool.slice(0, l.needed)),
                    languages: languages.map(({ language, needed, have }) => ({ language, needed, have })),
                };
            });
            const perLanguage = new Map<string, number>();
            for (const t of plan.targets) perLanguage.set(t.language, (perLanguage.get(t.language) ?? 0) + t.count);
            return {
                id,
                company: p.company,
                title: p.title,
                location: p.location && p.location !== "None" ? p.location : null,
                url: p.url,
                needed: topics.reduce((s, t) => s + t.needed, 0),
                matched: topics.reduce((s, t) => s + t.examples.length, 0),
                topics,
                languages: [...perLanguage.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l),
                profile: taxonomy.labels.map((label) => ({ label, weight: weights.get(label) ?? 0 })),
            };
        }),
    );
}
