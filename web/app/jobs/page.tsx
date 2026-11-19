import { Suspense } from "react";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle, topicName } from "@/lib/format";
import { logoFor } from "@/lib/companies";
import { TableSkeleton } from "@/components/table-skeleton";
import JobsBrowser, { type JobRow } from "./JobsBrowser";

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            {/* the header needs no data, so it shows immediately */}
            <h1 className="text-4xl font-semibold tracking-tight">Roles</h1>
            <p className="mt-3 mb-6 max-w-2xl text-muted-foreground">
                Entry-level backend roles, each with a practice plan weighted to what the role depends on.
            </p>
            <Suspense fallback={<TableSkeleton filters={2} rows={5} />}>
                <Jobs searchParams={searchParams} />
            </Suspense>
        </main>
    );
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
    const [{ company }, matches] = await Promise.all([searchParams, listJobMatches()]);
    const jobs: JobRow[] = matches.map((j) => ({
        id: j.id,
        company: j.company,
        logo: logoFor(j.company),
        title: jobTitle(j.title),
        location: j.location,
        languages: j.languages,
        topTopics: j.topics.slice(0, 3).map((t) => topicName(t.label)),
        matched: j.matched,
        needed: j.needed,
    }));
    return (
        <div className="animate-in fade-in duration-500 ease-out">
            <JobsBrowser jobs={jobs} initialCompany={typeof company === "string" ? company : ""} />
        </div>
    );
}
