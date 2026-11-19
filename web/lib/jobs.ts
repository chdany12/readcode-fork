// Server-only: job postings (postings/jobs.json) with their plans (postings/plans/NNN.json,
// NNN = 1-based position in the postings list), matched against the example bank.
import { readFile } from "node:fs/promises";
import { cache } from "react";
import path from "node:path";
import type { Plan } from "../../shared/types";
import { EXAMPLES_ROOT, listExamples, type ExampleSummary } from "./examples";

const GOLDEN = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "postings");

type Posting = { company: string; title: string; location?: string | null; url: string; level_signal?: string };

// weight: the classifier's 0-1 relevance of this topic to the posting. examples: at most `needed`.
export type TopicMatch = { label: string; weight: number; needed: number; examples: ExampleSummary[] };
export type JobMatch = {
    id: string;          // "001"
    company: string;
    title: string;
    location: string | null;
    url: string;
    needed: number;      // examples in the posting's plan
    matched: number;     // of those, available in the bank
    topics: TopicMatch[];
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
    const byTopic = Map.groupBy(examples, (e) => e.topic);

    return Promise.all(
        postings.map(async (p, i) => {
            const id = String(i + 1).padStart(3, "0");
            const [planRaw, raw] = await Promise.all([
                readFile(path.join(GOLDEN, "plans", `${id}.json`), "utf8").catch(() => '{"targets":[]}'),
                readFile(path.join(GOLDEN, "plans", "weights", `${id}.json`), "utf8").catch(() => '{"weights":[]}'),
            ]);
            const plan = JSON.parse(planRaw) as Plan;
            const weights = new Map((JSON.parse(raw).weights as { label: string; weight: number }[]).map((w) => [w.label, w.weight]));
            const topics = plan.targets.map((t) => ({
                label: t.label,
                weight: weights.get(t.label) ?? 0,
                needed: t.count,
                examples: (byTopic.get(t.label) ?? []).slice(0, t.count),
            }));
            return {
                id,
                company: p.company,
                title: p.title,
                location: p.location && p.location !== "None" ? p.location : null,
                url: p.url,
                needed: topics.reduce((s, t) => s + t.needed, 0),
                matched: topics.reduce((s, t) => s + t.examples.length, 0),
                topics,
                profile: taxonomy.labels.map((label) => ({ label, weight: weights.get(label) ?? 0 })),
            };
        }),
    );
}
