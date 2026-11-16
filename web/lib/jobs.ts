// Server-only: job postings (golden_list/backend_jobs.json) with their plans (golden_list/plans/NNN.json,
// NNN = 1-based position in the postings list), matched against the example bank.
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plan } from "../../shared/types";
import { EXAMPLES_ROOT, listExamples, type ExampleSummary } from "./examples";

const GOLDEN = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "golden_list");

type Posting = { company: string; title: string; location?: string | null; url: string; level_signal?: string };

export type TopicMatch = { label: string; needed: number; examples: ExampleSummary[] }; // examples: at most `needed`
export type JobMatch = {
    id: string;          // "001"
    company: string;
    title: string;
    location: string | null;
    url: string;
    needed: number;      // examples in the posting's plan
    matched: number;     // of those, available in the bank
    topics: TopicMatch[];
};

export async function listJobMatches(): Promise<JobMatch[]> {
    const postings = JSON.parse(await readFile(path.join(GOLDEN, "backend_jobs.json"), "utf8")) as Posting[];
    const byTopic = new Map<string, ExampleSummary[]>();
    for (const e of await listExamples()) byTopic.set(e.topic, [...(byTopic.get(e.topic) ?? []), e]);

    return Promise.all(
        postings.map(async (p, i) => {
            const id = String(i + 1).padStart(3, "0");
            const plan = JSON.parse(await readFile(path.join(GOLDEN, "plans", `${id}.json`), "utf8").catch(() => '{"targets":[]}')) as Plan;
            const topics = plan.targets.map((t) => ({ label: t.label, needed: t.count, examples: (byTopic.get(t.label) ?? []).slice(0, t.count) }));
            return {
                id,
                company: p.company,
                title: p.title,
                location: p.location && p.location !== "None" ? p.location : null,
                url: p.url,
                needed: topics.reduce((s, t) => s + t.needed, 0),
                matched: topics.reduce((s, t) => s + t.examples.length, 0),
                topics,
            };
        }),
    );
}
