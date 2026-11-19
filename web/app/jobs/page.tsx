import { Suspense } from "react";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle, topicName } from "@/lib/format";
import { logoFor } from "@/lib/companies";
import JobsBrowser, { type JobRow } from "./JobsBrowser";

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            <Suspense fallback={<p className="text-muted-foreground">loading…</p>}>
                <Jobs searchParams={searchParams} />
            </Suspense>
        </main>
    );
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
    const { company } = await searchParams;
    const matches = await listJobMatches();
    const jobs: JobRow[] = matches.map((j) => ({
        id: j.id,
        company: j.company,
        logo: logoFor(j.company),
        title: jobTitle(j.title),
        location: j.location,
        topTopics: j.topics.slice(0, 3).map((t) => topicName(t.label)),
        matched: j.matched,
        needed: j.needed,
    }));
    const companies = new Set(jobs.map((j) => j.company)).size;
    return (
        <>
            <h1 className="text-4xl font-semibold tracking-tight">Roles</h1>
            <p className="mt-3 mb-6 max-w-2xl text-muted-foreground">
                {jobs.length} entry-level backend roles at {companies} companies. Each has a practice plan weighted to what the role depends on.
            </p>
            <JobsBrowser jobs={jobs} initialCompany={typeof company === "string" ? company : ""} />
        </>
    );
}
