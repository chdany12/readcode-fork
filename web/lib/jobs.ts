// Server-only: job postings (golden_list/backend_jobs.json) with their plans (golden_list/plans/NNN.json,
// NNN = 1-based position in the postings list), matched against the example bank.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plan } from "../../shared/types";
import { EXAMPLES_ROOT, listExamples, type ExampleSummary } from "./examples";

const GOLDEN = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "golden_list");

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

export async function listJobMatches(): Promise<JobMatch[]> {
    const postings = JSON.parse(await readFile(path.join(GOLDEN, "backend_jobs.json"), "utf8")) as Posting[];
    const taxonomy = JSON.parse(await readFile(path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "pipeline", "taxonomy", "v0.1.0.json"), "utf8")) as { labels: string[] };
    const byTopic = new Map<string, ExampleSummary[]>();
    for (const e of await listExamples()) byTopic.set(e.topic, [...(byTopic.get(e.topic) ?? []), e]);

    return Promise.all(
        postings.map(async (p, i) => {
            const id = String(i + 1).padStart(3, "0");
            const plan = JSON.parse(await readFile(path.join(GOLDEN, "plans", `${id}.json`), "utf8").catch(() => '{"targets":[]}')) as Plan;
            const raw = await readFile(path.join(GOLDEN, "plans", "weights", `${id}.json`), "utf8").catch(() => '{"weights":[]}');
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
