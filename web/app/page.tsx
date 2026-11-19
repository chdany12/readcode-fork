import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { listJobMatches } from "@/lib/jobs";
import { jobTitle } from "@/lib/format";
import OwnPosting from "./OwnPosting";
import { COMPANIES } from "@/lib/companies";
import RoleCard from "./RoleCard";
import CodeSweep from "./CodeSweep";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PER_COMPANY = 2;

export default function Home() {
    return (
        <main className="relative isolate mx-auto w-full max-w-5xl px-6 pb-12">
            <section className="relative py-16 text-center">
                {/* soft glow behind the hero */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-gradient-to-r from-hero-1/20 via-hero-2/20 to-hero-3/20 blur-3xl" />
                <CodeSweep
                    as="h1"
                    className="text-4xl font-semibold tracking-tight sm:text-5xl"
                    text="Practice reading code for the role you want"
                    markup="h1"
                    delay={300}
                />
                <CodeSweep
                    as="p"
                    className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
                    text="Paste a job posting. We weigh the concepts the role depends on and build a code-reading practice plan in that mix."
                    markup="p"
                    inline={{ phrase: "job posting", tag: "b" }}
                    delay={700}
                    restore={1000}
                />
                <div className="mt-8">
                    <OwnPosting />
                </div>
            </section>

            <h2 className="mt-6 text-lg font-semibold">Or start with a big tech role</h2>
            <p className="text-sm text-muted-foreground">Practice plans built from real {new Intl.ListFormat("en").format(COMPANIES.map((c) => c.name))} postings.</p>
            {/* the four tiles render right away; each fills in its roles when the data arrives */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {COMPANIES.map((c, i) => (
                    <CompanyTile key={c.name} name={c.name} logo={c.logo} index={i} />
                ))}
            </div>
        </main>
    );
}

function CompanyTile({ name, logo, index }: { name: string; logo: string; index: number }) {
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
                <Suspense fallback={<RolesSkeleton />}>
                    <CompanyRoles name={name} index={index} />
                </Suspense>
            </CardContent>
        </Card>
    );
}

// The company's first roles and a "+N more" row; streams in after the tile itself and fades in,
// staggered by the tile's position so the four tiles fill in as a cascade.
async function CompanyRoles({ name, index }: { name: string; index: number }) {
    const jobs = (await listJobMatches()).filter((j) => j.company === name);
    return (
        <div
            className="space-y-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 ease-out"
            style={{ animationDelay: `${index * 90}ms` }}
        >
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
        </div>
    );
}

// Placeholder shaped like two role cards and the "+N more" row.
function RolesSkeleton() {
    return (
        <>
            {[0, 1].map((i) => (
                <div key={i} className="space-y-3 rounded-lg border p-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <div className="space-y-2 pt-1">
                        {[0, 1, 2].map((r) => <Skeleton key={r} className="h-9 w-full" />)}
                    </div>
                </div>
            ))}
            <Skeleton className="h-9 w-full" />
        </>
    );
}

