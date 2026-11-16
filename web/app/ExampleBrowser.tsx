"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExampleSummary } from "@/lib/examples";

// Example list with filters: area (e.g. "concurrency"), topic within it, and a text search on names.
export default function ExampleBrowser({ examples }: { examples: ExampleSummary[] }) {
    const [area, setArea] = useState("");
    const [topic, setTopic] = useState("");
    const [query, setQuery] = useState("");
    const [includeRelated, setIncludeRelated] = useState(false);

    const areas = useMemo(() => countBy(examples.map((e) => areaOf(e.topic))), [examples]);
    const topics = useMemo(
        () => countBy(examples.map((e) => e.topic).filter((t) => !area || areaOf(t) === area)),
        [examples, area],
    );

    const q = query.trim().toLowerCase();
    const shown = examples.filter((e) => {
        const candidates = includeRelated ? e.concepts : [e.topic];
        if (area && !candidates.some((c) => areaOf(c) === area)) return false;
        if (topic && !candidates.includes(topic)) return false;
        if (q && !`${e.shortName} ${e.title} ${e.name}`.toLowerCase().includes(q)) return false;
        return true;
    });

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
                <label>
                    area{" "}
                    <select className={input} value={area} onChange={(e) => { setArea(e.target.value); setTopic(""); }}>
                        <option value="">all ({examples.length})</option>
                        {areas.map(([a, n]) => (
                            <option key={a} value={a}>{a} ({n})</option>
                        ))}
                    </select>
                </label>
                <label>
                    topic{" "}
                    <select className={input} value={topic} onChange={(e) => setTopic(e.target.value)}>
                        <option value="">all</option>
                        {topics.map(([t, n]) => (
                            <option key={t} value={t}>{short(t)} ({n})</option>
                        ))}
                    </select>
                </label>
                <label>
                    search <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="name…" />
                </label>
                <label title="also match examples where this is a secondary concept">
                    <input type="checkbox" checked={includeRelated} onChange={(e) => setIncludeRelated(e.target.checked)} /> include related
                </label>
                {(area || topic || query) && (
                    <button className="underline" onClick={() => { setArea(""); setTopic(""); setQuery(""); }}>clear</button>
                )}
            </div>
            <p className="mb-2 text-neutral-500">{shown.length} of {examples.length} examples</p>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-neutral-400 text-left text-neutral-500">
                        <th className="py-1 pr-3">#</th>
                        <th className="py-1 pr-3">name</th>
                        <th className="py-1 pr-3">topic</th>
                    </tr>
                </thead>
                <tbody>
                    {shown.map((e) => (
                        <tr key={e.name} className="border-b border-neutral-300 align-top">
                            <td className="py-1 pr-3 text-neutral-500">{numberOf(e.name)}</td>
                            <td className="py-1 pr-3">
                                <Link className="underline" href={`/examples/${encodeURIComponent(e.name)}`} title={e.title}>
                                    {e.shortName}
                                </Link>
                            </td>
                            <td className="py-1 pr-3">
                                <button className="hover:underline" onClick={() => { setArea(areaOf(e.topic)); setTopic(e.topic); }}>
                                    {short(e.topic)}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const input = "border border-neutral-400 bg-transparent px-1";

// "backend.concurrency.race_conditions" -> area "concurrency", short "concurrency.race_conditions"
function areaOf(label: string): string {
    return label.split(".")[1] ?? label;
}
function short(label: string): string {
    return label.replace(/^backend\./, "");
}
function numberOf(folder: string): string {
    return folder.split("/").pop()?.match(/^\d+/)?.[0] ?? "";
}
function countBy(values: string[]): [string, number][] {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
