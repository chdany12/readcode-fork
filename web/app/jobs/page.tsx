import Link from "next/link";
import { Suspense } from "react";
import { listJobMatches } from "@/lib/jobs";
import { Badge } from "@/components/ui/badge";

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
    return (
        <main className="p-6 text-sm">
                        <p className="text-muted-foreground">
                each posting&apos;s plan matched to bank examples
            </p>
            <hr className="my-3" />
            <Suspense fallback={<p>loading…</p>}>
                <JobList searchParams={searchParams} />
            </Suspense>
        </main>
    );
}

async function JobList({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
    const { company, open } = await searchParams;
    const jobs = (await listJobMatches()).filter((j) => !company || j.company === company);
    return (
            <ul className="space-y-1">
                {jobs.map((j) => (
                    <li key={j.id} id={j.id}>
                        <details open={open === j.id}>
                            <summary className="cursor-pointer">
                                <span className="text-muted-foreground">{j.id}</span> <b>{j.company}</b> — {j.title}
                                {j.location && <span className="text-muted-foreground"> ({j.location})</span>}{" "}
                                <Badge variant={j.matched === j.needed ? "default" : "outline"}>
                                    {j.matched}/{j.needed}
                                </Badge>
                            </summary>
                            <div className="ml-6 mt-1 mb-3">
                                <a className="underline text-muted-foreground" href={j.url} target="_blank" rel="noreferrer">posting ↗</a>
                                <table className="mt-1">
                                    <tbody>
                                        {j.topics.map((t) => (
                                            <tr key={t.label} className="align-top">
                                                <td className="pr-4 whitespace-nowrap">{t.label.replace(/^backend\./, "")}</td>
                                                <td className={`pr-4 ${t.examples.length < t.needed ? "text-destructive" : ""}`}>{t.examples.length}/{t.needed}</td>
                                                <td>
                                                    {t.examples.map((e, k) => (
                                                        <span key={e.name}>
                                                            {k > 0 && ", "}
                                                            <Link className="underline" href={`/examples/${encodeURIComponent(e.name)}`} title={e.title}>{e.shortName}</Link>
                                                        </span>
                                                    ))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    </li>
                ))}
            </ul>
    );
}
