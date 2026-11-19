import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { listJobMatches, type JobMatch } from "@/lib/jobs";
import { jobTitle } from "@/lib/format";
import OwnPosting from "./OwnPosting";
import RoleCard from "./RoleCard";
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
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Practice reading code the way your interview will test it</h1>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                    Paste a job posting. We weigh the concepts the role depends on and build a code-reading practice plan in that mix.
                </p>
                <div className="mt-8">
                    <OwnPosting />
                </div>
            </section>

            <h2 className="mt-6 text-lg font-semibold">Or start with a big tech role</h2>
            <p className="text-sm text-muted-foreground">Practice plans built from real Google, Amazon, Meta and Apple postings.</p>
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
                    <RoleCard key={j.id} job={j} />
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

