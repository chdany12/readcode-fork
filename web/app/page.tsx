import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, FileCode } from "lucide-react";
import { listJobMatches, type JobMatch } from "@/lib/jobs";
import { jobTitle, topicName } from "@/lib/format";
import OwnPosting from "./OwnPosting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Featured companies. Full-color logos in public/logos (from svgl.app; Amazon uses the AWS smile logo).
const COMPANIES = [
    { name: "Google", logo: "/logos/google.svg" },
    { name: "Amazon", logo: "/logos/amazon.svg" },
    { name: "Meta", logo: "/logos/meta.svg" },
    { name: "Apple", logo: "/logos/apple.svg" },
];
const PER_COMPANY = 2;

export default function Home() {
    return (
        <main className="relative isolate mx-auto w-full max-w-5xl px-6 pb-12">
            <section className="relative py-16 text-center">
                {/* soft glow behind the hero */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-gradient-to-r from-sky-500/20 via-violet-500/20 to-emerald-500/20 blur-3xl" />
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Practice reading code for the role you want</h1>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                    Paste a job posting. We weigh the concepts the role depends on and build a code-reading practice plan in that mix.
                </p>
                <div className="mt-8">
                    <OwnPosting />
                </div>
            </section>

            <h2 className="mt-6 text-lg font-semibold">Or start with a big tech role</h2>
            <p className="text-sm text-muted-foreground">Practice plans built from real Google, Amazon, Meta and Apple postings. Each bar shows what the role tests, by share of practice.</p>
            <Suspense fallback={<p className="mt-8 text-muted-foreground">loading…</p>}>
                <Companies />
            </Suspense>
        </main>
    );
}

async function Companies() {
    const jobs = await listJobMatches();
    return (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {COMPANIES.map((c) => (
                <CompanyTile key={c.name} name={c.name} logo={c.logo} jobs={jobs.filter((j) => j.company === c.name)} />
            ))}
        </div>
    );
}

function CompanyTile({ name, logo, jobs }: { name: string; logo: string; jobs: JobMatch[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logo} alt="" className="h-6 w-auto" />
                    {name}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {jobs.slice(0, PER_COMPANY).map((j) => (
                    <RoleRow key={j.id} job={j} />
                ))}
                {jobs.length === 0 && <p className="text-muted-foreground">No postings yet.</p>}
                {jobs.length > PER_COMPANY && (
                    <Link
                        href={`/jobs?company=${encodeURIComponent(name)}`}
                        className="group flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-solid hover:bg-muted/50 hover:text-foreground"
                    >
                        <span className="shrink-0 font-medium">+{jobs.length - PER_COMPANY} more roles</span>
                        <span className="min-w-0 flex-1 truncate text-xs">
                            {jobs.slice(PER_COMPANY).map((j) => jobTitle(j.title)).join(" · ")}
                        </span>
                        <ChevronRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}

// A role in a company tile: its first few exercises shown right away, and a link to the full plan.
const PREVIEW = 3;
function RoleRow({ job }: { job: JobMatch }) {
    const examples = job.topics.flatMap((t) => t.examples.map((e) => ({ ...e, topic: t.label })));
    const minutes = examples.reduce((s, e) => s + e.durationMinutes, 0);
    // one exercise from each of the top topics, so the preview shows the role's range
    const preview = job.topics
        .filter((t) => t.examples.length > 0)
        .slice(0, PREVIEW)
        .map((t) => ({ ...t.examples[0], topic: t.label }));
    return (
        <div className="rounded-lg border p-3">
            <Link href={`/jobs/${job.id}`} className="group block">
                <div className="truncate font-medium group-hover:underline" title={job.title}>{jobTitle(job.title)}</div>
                <div className="text-xs text-muted-foreground">
                    {job.location ? `${job.location} · ` : ""}{examples.length} exercises · ~{Math.round(minutes / 60)} h
                </div>
            </Link>
            <ConceptMix job={job} />
            <ul className="mt-2 text-sm">
                {preview.map((e, i) => (
                    <li key={e.name}>
                        <Link
                            href={`/examples/${encodeURIComponent(e.name)}`}
                            title={e.title}
                            className="group/row -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                        >
                            <FileCode className="size-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{e.shortName}</span>
                            <span className="size-2 shrink-0 rounded-full" style={{ background: TOPIC_COLORS[i] }} title={topicName(e.topic)} />
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground" />
                        </Link>
                    </li>
                ))}
            </ul>
            {examples.length > PREVIEW && (
                <Link href={`/jobs/${job.id}`} className="mt-1 inline-block text-xs text-muted-foreground hover:text-foreground">
                    +{examples.length - PREVIEW} more exercises →
                </Link>
            )}
        </div>
    );
}

// Distinct hues for a role's top topics; the rest of the plan is grey.
const TOPIC_COLORS = ["oklch(0.7 0.16 250)", "oklch(0.75 0.15 160)", "oklch(0.8 0.15 80)", "oklch(0.68 0.18 20)", "oklch(0.7 0.16 300)"];

// The role's concept mix as one segmented bar: each segment is a topic's share of the plan.
function ConceptMix({ job }: { job: JobMatch }) {
    const total = job.topics.reduce((s, t) => s + t.needed, 0) || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    // same order and filter as the preview rows, so a segment's color matches its row's dot
    const colored = job.topics.filter((t) => t.examples.length > 0).slice(0, PREVIEW);
    const isColored = (label: string) => colored.some((t) => t.label === label);
    const rest = job.topics.filter((t) => !isColored(t.label));
    return (
        <div className="mt-3">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {job.topics.map((t) => {
                    const c = colored.findIndex((x) => x.label === t.label);
                    return (
                        <span
                            key={t.label}
                            title={`${topicName(t.label)}: ${pct(t.needed)}%`}
                            style={{
                                width: `${(t.needed / total) * 100}%`,
                                background: c >= 0 ? TOPIC_COLORS[c] : "var(--muted-foreground)",
                                opacity: c >= 0 ? 1 : 0.35,
                            }}
                        />
                    );
                })}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {colored.map((t, c) => (
                    <li key={t.label} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: TOPIC_COLORS[c] }} />
                        <span className="text-foreground">{topicName(t.label)}</span> {pct(t.needed)}%
                    </li>
                ))}
                {rest.length > 0 && (
                    <li className="flex items-center gap-1.5" title={rest.map((t) => topicName(t.label)).join(", ")}>
                        <span className="size-2 rounded-full bg-muted-foreground/35" />
                        {rest.length} more topics {pct(rest.reduce((s, t) => s + t.needed, 0))}%
                    </li>
                )}
            </ul>
        </div>
    );
}
