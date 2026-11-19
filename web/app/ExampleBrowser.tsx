"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExampleSummary } from "@/lib/examples";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
                <NativeSelect aria-label="area" value={area} onChange={(e) => { setArea(e.target.value); setTopic(""); }}>
                    <NativeSelectOption value="">all areas ({examples.length})</NativeSelectOption>
                    {areas.map(([a, n]) => (
                        <NativeSelectOption key={a} value={a}>{a} ({n})</NativeSelectOption>
                    ))}
                </NativeSelect>
                <NativeSelect aria-label="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <NativeSelectOption value="">all topics</NativeSelectOption>
                    {topics.map(([t, n]) => (
                        <NativeSelectOption key={t} value={t}>{short(t)} ({n})</NativeSelectOption>
                    ))}
                </NativeSelect>
                <Input className="w-48" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names…" />
                <label className="flex items-center gap-2" title="also match examples where this is a secondary concept">
                    <Checkbox checked={includeRelated} onCheckedChange={(v) => setIncludeRelated(v === true)} /> include related
                </label>
                {(area || topic || query) && (
                    <Button variant="ghost" size="sm" onClick={() => { setArea(""); setTopic(""); setQuery(""); }}>Clear</Button>
                )}
            </div>
            <p className="mb-2 text-muted-foreground">{shown.length} of {examples.length} examples</p>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Topic</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {shown.map((e) => (
                        <TableRow key={e.name}>
                            <TableCell className="text-muted-foreground">{numberOf(e.name)}</TableCell>
                            <TableCell>
                                <Link className="font-medium hover:underline" href={`/examples/${encodeURIComponent(e.name)}`} title={e.title}>
                                    {e.shortName}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <button className="text-muted-foreground hover:underline" onClick={() => { setArea(areaOf(e.topic)); setTopic(e.topic); }}>
                                    {short(e.topic)}
                                </button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

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
