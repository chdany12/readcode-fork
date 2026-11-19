import Link from "next/link";
import { Suspense } from "react";
import { listJobMatches } from "@/lib/jobs";

export default function Home() {
    return (
        <main className="p-6 font-mono text-sm">
                        <p className="text-neutral-500">
                each posting's plan matched to bank examples
            </p>
            <hr className="my-3 border-neutral-400" />
            <Suspense fallback={<p>loading…</p>}>
                <JobList />
            </Suspense>
        </main>
    );
}

async function JobList() {
    const jobs = await listJobMatches();
    return (
            <ul className="space-y-1">
                {jobs.map((j) => (
                    <li key={j.id}>
                        <details>
                            <summary className="cursor-pointer">
                                <span className="text-neutral-500">{j.id}</span> <b>{j.company}</b> — {j.title}
                                {j.location && <span className="text-neutral-500"> ({j.location})</span>}{" "}
                                <span className={j.matched === j.needed ? "text-green-700" : "text-amber-700"}>
                                    [{j.matched}/{j.needed}]
                                </span>
                            </summary>
                            <div className="ml-6 mt-1 mb-3">
                                <a className="underline text-neutral-500" href={j.url} target="_blank" rel="noreferrer">posting ↗</a>
                                <table className="mt-1">
                                    <tbody>
                                        {j.topics.map((t) => (
                                            <tr key={t.label} className="align-top">
                                                <td className="pr-4 whitespace-nowrap">{t.label.replace(/^backend\./, "")}</td>
                                                <td className={`pr-4 ${t.examples.length < t.needed ? "text-amber-700" : ""}`}>{t.examples.length}/{t.needed}</td>
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
