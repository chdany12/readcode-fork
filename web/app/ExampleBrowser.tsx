"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, FileSearch, Search, X } from "lucide-react";
import type { ExampleSummary } from "@/lib/examples";
import { areaName, topicName } from "@/lib/format";

// Curriculum order (fundamentals first) and a one-line description per module.
const MODULES: { area: string; blurb: string }[] = [
    { area: "design", blurb: "Interfaces, layering and coupling: whether code is shaped to change safely." },
    { area: "testing", blurb: "What a test proves, what it misses, and why it flakes." },
    { area: "errors", blurb: "How failures travel: propagation, context, cleanup, and errors that vanish." },
    { area: "api", blurb: "Contracts with callers: validation, idempotency, versioning and status codes." },
    { area: "data", blurb: "Transactions, queries and schemas, where correctness and money live." },
    { area: "config", blurb: "Settings, flags and environments that change behaviour without a deploy." },
    { area: "concurrency", blurb: "Races, locks and async pitfalls when work overlaps." },
    { area: "resources", blurb: "Memory, handles, buffers and cancellation: what leaks under load." },
    { area: "caching", blurb: "Freshness, expiry and stampedes when you keep copies of data." },
    { area: "messaging", blurb: "Queues and consumers: delivery guarantees, ordering and backpressure." },
    { area: "resilience", blurb: "Timeouts, retries and limits that keep failures contained." },
    { area: "integrations", blurb: "Talking to systems you don't own: adapters and webhooks." },
    { area: "security", blurb: "Who can do what: auth, injection, secrets and tenant isolation." },
    { area: "observability", blurb: "Logs, metrics and traces that let you see what happened." },
    { area: "performance", blurb: "Finding the hot path and the work that doesn't need doing." },
    { area: "distributed", blurb: "Sharding, replication and consistency across services." },
    { area: "realtime", blurb: "Fan-out to many live connections." },
];

// A role the curriculum can be narrowed to: its plan's topics with their weights.
export type RoleOption = { id: string; label: string; topics: { label: string; weight: number }[] };

const LENGTHS = [
    { id: "", label: "Any length", test: () => true },
    { id: "short", label: "Up to 12 min", test: (m: number) => m <= 12 },
    { id: "long", label: "13 min or more", test: (m: number) => m >= 13 },
];

// The exercise bank as a curriculum: numbered modules (top-level areas), each with unit cards (topics)
// listing their exercises. Filters prune the tree: modules and units with no matches are hidden.
export default function ExampleBrowser({ examples, roles }: { examples: ExampleSummary[]; roles: RoleOption[] }) {
    const [query, setQuery] = useState("");
    const [moduleFilter, setModuleFilter] = useState("");
    const [roleId, setRoleId] = useState("");
    const [length, setLength] = useState("");

    const role = roles.find((r) => r.id === roleId);
    const roleWeight = new Map(role?.topics.map((t) => [t.label, t.weight]));
    const q = query.trim().toLowerCase();
    const lengthTest = LENGTHS.find((l) => l.id === length)!.test;
    const matches = (e: ExampleSummary) =>
        (!q || `${e.shortName} ${e.title} ${topicName(e.topic)} ${areaOf(e.topic)}`.toLowerCase().includes(q)) &&
        (!moduleFilter || areaOf(e.topic) === moduleFilter) &&
        (!role || roleWeight.has(e.topic)) &&
        lengthTest(e.durationMinutes);

    const byArea = Map.groupBy(examples, (e) => areaOf(e.topic));
    const known = MODULES.filter((m) => byArea.has(m.area));
    const extra = [...byArea.keys()].filter((a) => !MODULES.some((m) => m.area === a)).map((area) => ({ area, blurb: "" }));
    const modules = [...known, ...extra].map((m, i) => {
        const all = byArea.get(m.area)!;
        // with a role, units follow the role's weights; otherwise the biggest units come first
        const units = [...Map.groupBy(all, (e) => e.topic).entries()]
            .map(([topic, list], u) => ({ topic, list, shown: list.filter(matches), u }))
            .sort((a, b) => (role ? (roleWeight.get(b.topic) ?? 0) - (roleWeight.get(a.topic) ?? 0) : 0) || b.list.length - a.list.length);
        return { ...m, n: i + 1, all, units, shown: units.reduce((s, x) => s + x.shown.length, 0) };
    });
    const visible = modules.filter((m) => m.shown > 0);
    const total = visible.reduce((s, m) => s + m.shown, 0);
    const active = [
        q && { key: "q", label: `"${query.trim()}"`, clear: () => setQuery("") },
        moduleFilter && { key: "m", label: areaName(`x.${moduleFilter}`), clear: () => setModuleFilter("") },
        role && { key: "r", label: role.label, clear: () => setRoleId("") },
        length && { key: "l", label: LENGTHS.find((l) => l.id === length)!.label, clear: () => setLength("") },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

    const select = "h-9 rounded-lg border bg-background px-2.5 text-sm outline-none hover:border-foreground/30 focus:border-foreground/40";

    return (
        <div>
            {/* sticky filter bar */}
            <div className="sticky top-0 z-20 -mx-6 border-b bg-background/90 px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border bg-muted/30 px-3 focus-within:border-foreground/40 sm:max-w-xs">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search exercises or topics"
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </label>
                    <select aria-label="Module" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={select}>
                        <option value="">All modules</option>
                        {modules.map((m) => <option key={m.area} value={m.area}>{String(m.n).padStart(2, "0")} {areaName(`x.${m.area}`)}</option>)}
                    </select>
                    <select aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className={`${select} max-w-60`}>
                        <option value="">Any role</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <select aria-label="Length" value={length} onChange={(e) => setLength(e.target.value)} className={select}>
                        {LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">{total} of {examples.length} exercises</span>
                </div>
                {active.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {active.map((f) => (
                            <button key={f.key} type="button" onClick={f.clear} className="flex h-7 max-w-72 items-center gap-1.5 rounded-full border px-2.5 text-xs hover:border-foreground/40">
                                <span className="truncate">{f.label}</span> <X className="size-3 shrink-0" />
                            </button>
                        ))}
                        <button type="button" onClick={() => { setQuery(""); setModuleFilter(""); setRoleId(""); setLength(""); }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {visible.length === 0 && <p className="mt-16 text-center text-muted-foreground">No exercises match these filters.</p>}

            <ol className="mt-6 divide-y">
                {visible.map((m) => {
                    const filtered = m.shown < m.all.length;
                    const units = m.units.filter((x) => x.shown.length > 0);
                    const minutes = m.all.reduce((s, e) => s + e.durationMinutes, 0);
                    return (
                        <li key={m.area} id={`module-${m.area}`}>
                            {/* module header */}
                            <div className="flex w-full items-center gap-6 py-6">
                                <span className="w-8 shrink-0 font-mono text-sm text-muted-foreground">{String(m.n).padStart(2, "0")}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-xl font-semibold tracking-tight">{areaName(`x.${m.area}`)}</span>
                                    {m.blurb && <span className="mt-1 block text-sm text-muted-foreground">{m.blurb}</span>}
                                </span>
                                <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                                    {filtered ? `${m.shown} of ${m.all.length} exercises` : `${m.units.length} ${m.units.length === 1 ? "unit" : "units"} · ${m.all.length} exercises`}
                                    {!filtered && <span className="block">~{Math.max(1, Math.round(minutes / 60))} h</span>}
                                </span>
                            </div>

                            {/* units */}
                            <div className="space-y-3 pb-8 pl-14">
                                {units.map(({ topic, list, shown, u }) => (
                                    <section key={topic} className="rounded-xl border bg-muted/20 p-4">
                                        <h3 className="flex items-baseline gap-3">
                                            <span className="font-mono text-xs text-muted-foreground">{m.n}.{u + 1}</span>
                                            <span className="flex-1 font-medium">{topicName(topic)}</span>
                                            {role && roleWeight.has(topic) && (
                                                <span className="text-xs text-muted-foreground">{Math.round(roleWeight.get(topic)! * 100)}% match</span>
                                            )}
                                            <span className="text-xs text-muted-foreground">{shown.length < list.length ? `${shown.length} of ${list.length}` : list.length}</span>
                                        </h3>
                                        <ul className="mt-2 -mx-2 grid gap-x-4 sm:grid-cols-2">
                                            {shown.map((e) => <li key={e.name}><ExampleRow example={e} /></li>)}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

function ExampleRow({ example: e }: { example: ExampleSummary }) {
    return (
        <Link
            href={`/examples/${encodeURIComponent(e.name)}`}
            title={e.title}
            className="group/row flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
        >
            <FileSearch className="size-5 shrink-0 text-muted-foreground group-hover/row:text-foreground" />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{e.shortName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                    {e.questionCount} questions · {e.durationMinutes} min
                </span>
            </span>
            {/* a round chevron that widens into "Practice" on hover */}
            <span className="flex h-7 shrink-0 items-center rounded-full border px-1.5 text-foreground transition-all duration-200 group-hover/row:border-foreground/40 group-hover/row:pl-3">
                <span className="max-w-0 overflow-hidden text-xs font-medium whitespace-nowrap opacity-0 transition-all duration-200 group-hover/row:mr-1 group-hover/row:max-w-20 group-hover/row:opacity-100">
                    Practice
                </span>
                <ChevronRight className="size-4" />
            </span>
        </Link>
    );
}

// "backend.concurrency.race_conditions" -> "concurrency"
function areaOf(label: string): string {
    return label.split(".")[1] ?? label;
}
