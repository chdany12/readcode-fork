import { Suspense } from "react";
import { listExamples } from "@/lib/examples";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle } from "@/lib/format";
import ExampleBrowser, { type RoleOption } from "../ExampleBrowser";

export default function ExamplesPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            <Suspense fallback={<p className="text-muted-foreground">loading…</p>}>
                <ExampleList />
            </Suspense>
        </main>
    );
}

async function ExampleList() {
    const [examples, jobs] = await Promise.all([listExamples(), listJobMatches()]);
    if (examples.length === 0) return <p className="text-muted-foreground">No examples found (folders with a public.json).</p>;
    const topics = new Set(examples.map((e) => e.topic)).size;
    const areas = new Set(examples.map((e) => e.topic.split(".")[1])).size;
    const roles: RoleOption[] = jobs.map((j) => ({
        id: j.id,
        label: `${j.company} · ${jobTitle(j.title)}`,
        topics: j.topics.map((t) => ({ label: t.label, weight: t.weight })),
    }));
    return (
        <>
            <h1 className="text-4xl font-semibold tracking-tight">Backend code reading</h1>
            <p className="mt-3 mb-6 max-w-2xl text-muted-foreground">
                {areas} modules, {topics} units, {examples.length} exercises. Each exercise is real-shaped backend code: read it, find what&apos;s wrong, and explain it.
            </p>
            <ExampleBrowser examples={examples} roles={roles} />
        </>
    );
}
