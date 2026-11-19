import { Suspense } from "react";
import { listExamples } from "@/lib/examples";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle } from "@/lib/format";
import { TableSkeleton } from "@/components/table-skeleton";
import ExampleBrowser, { type RoleOption } from "../ExampleBrowser";

export default function ExamplesPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            {/* the header needs no data, so it shows immediately */}
            <h1 className="text-4xl font-semibold tracking-tight">Backend code reading</h1>
            <p className="mt-3 mb-6 max-w-2xl text-muted-foreground">
                Real-shaped backend code, grouped by concept: read it, find what&apos;s wrong, and explain it.
            </p>
            <Suspense fallback={<TableSkeleton filters={3} />}>
                <ExampleList />
            </Suspense>
        </main>
    );
}

async function ExampleList() {
    const [examples, jobs] = await Promise.all([listExamples(), listJobMatches()]);
    if (examples.length === 0) return <p className="text-muted-foreground">No examples found (folders with a public.json).</p>;
    const roles: RoleOption[] = jobs.map((j) => ({
        id: j.id,
        label: `${j.company} · ${jobTitle(j.title)}`,
        topics: j.topics.map((t) => ({ label: t.label, weight: t.weight })),
    }));
    return (
        <div className="animate-in fade-in duration-500 ease-out">
            <ExampleBrowser examples={examples} roles={roles} />
        </div>
    );
}
