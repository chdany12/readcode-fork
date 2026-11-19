"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, FileSearch, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExampleSummary } from "@/lib/examples";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { areaName, topicName } from "@/lib/format";

// A one-line description per module. Modules are listed alphabetically (no implied sequence).
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
    // modules start open and units start closed (open while filtering); a click flips that default
    const [flippedModules, setFlippedModules] = useState<Set<string>>(new Set());
    const [flippedUnits, setFlippedUnits] = useState<Set<string>>(new Set());
    const flip = (set: (f: (s: Set<string>) => Set<string>) => void, key: string) =>
        set((s) => {
            const n = new Set(s);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });

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
    const modules = [...known, ...extra].sort((a, b) => areaName(`x.${a.area}`).localeCompare(areaName(`x.${b.area}`))).map((m) => {
        const all = byArea.get(m.area)!;
        // with a role, units follow the role's weights; otherwise the biggest units come first
        const units = [...Map.groupBy(all, (e) => e.topic).entries()]
            .map(([topic, list]) => ({ topic, list, shown: list.filter(matches) }))
            .sort((a, b) => (role ? (roleWeight.get(b.topic) ?? 0) - (roleWeight.get(a.topic) ?? 0) : 0) || b.list.length - a.list.length);
        return { ...m, all, units, shown: units.reduce((s, x) => s + x.shown.length, 0) };
    });
    const visible = modules.filter((m) => m.shown > 0);
    const filtering = Boolean(q || moduleFilter || roleId || length);
    const moduleOpen = (area: string) => !flippedModules.has(area);
    const unitOpen = (topic: string) => filtering !== flippedUnits.has(topic);
    const total = visible.reduce((s, m) => s + m.shown, 0);
    const active = [
        q && { key: "q", label: `"${query.trim()}"`, clear: () => setQuery("") },
        moduleFilter && { key: "m", label: areaName(`x.${moduleFilter}`), clear: () => setModuleFilter("") },
        role && { key: "r", label: role.label, clear: () => setRoleId("") },
        length && { key: "l", label: LENGTHS.find((l) => l.id === length)!.label, clear: () => setLength("") },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

    return (
        <div>
            {/* sticky filter bar */}
            <div className="sticky top-0 z-20 -mx-6 border-b bg-background/90 px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                    <InputGroup className="min-w-56 flex-1 sm:max-w-xs">
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises or topics" />
                    </InputGroup>
                    <NativeSelect aria-label="Module" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                        <NativeSelectOption value="">All modules</NativeSelectOption>
                        {modules.map((m) => <NativeSelectOption key={m.area} value={m.area}>{areaName(`x.${m.area}`)}</NativeSelectOption>)}
                    </NativeSelect>
                    <NativeSelect aria-label="Role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className="max-w-60">
                        <NativeSelectOption value="">Any role</NativeSelectOption>
                        {roles.map((r) => <NativeSelectOption key={r.id} value={r.id}>{r.label}</NativeSelectOption>)}
                    </NativeSelect>
                    <NativeSelect aria-label="Length" value={length} onChange={(e) => setLength(e.target.value)}>
                        {LENGTHS.map((l) => <NativeSelectOption key={l.id} value={l.id}>{l.label}</NativeSelectOption>)}
                    </NativeSelect>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">{total} of {examples.length} exercises</span>
                </div>
                {active.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {active.map((f) => (
                            <Button key={f.key} variant="outline" size="xs" onClick={f.clear} className="max-w-72 rounded-full">
                                <span className="truncate">{f.label}</span> <X data-icon="inline-end" />
                            </Button>
                        ))}
                        <Button variant="link" size="xs" onClick={() => { setQuery(""); setModuleFilter(""); setRoleId(""); setLength(""); }} className="text-muted-foreground">
                            Clear all
                        </Button>
                    </div>
                )}
            </div>

            {visible.length === 0 && <p className="mt-16 text-center text-muted-foreground">No exercises match these filters.</p>}

            {visible.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-xl border" role="table" aria-label="Exercises">
                    {/* column headers */}
                    <div role="row" className={cn(ROW, "border-b bg-muted/30 py-2 text-xs font-medium text-muted-foreground")}>
                        <span />
                        <span role="columnheader">Topic</span>
                        <span role="columnheader" className="text-right">{role ? "Match" : ""}</span>
                        <span role="columnheader" className="text-right">Exercises</span>
                        <span role="columnheader" className="text-right">Time</span>
                        <span />
                    </div>
                    {visible.map((m) => {
                        const units = m.units.filter((x) => x.shown.length > 0);
                        const minutes = m.all.reduce((s, e) => s + e.durationMinutes, 0);
                        const open = moduleOpen(m.area);
                        return (
                            <div key={m.area} role="rowgroup" id={`module-${m.area}`}>
                                {/* module: a shaded group row */}
                                <button
                                    type="button"
                                    role="row"
                                    onClick={() => flip(setFlippedModules, m.area)}
                                    aria-expanded={open}
                                    className={cn(ROW, "group w-full border-b bg-muted/50 py-3 text-left hover:bg-muted/70")}
                                >
                                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground", !open && "-rotate-90")} />
                                    <span className="min-w-0">
                                        <span className="block font-semibold">{areaName(`x.${m.area}`)}</span>
                                        {m.blurb && <span className="block truncate text-xs text-muted-foreground">{m.blurb}</span>}
                                    </span>
                                    <span />
                                    <span className="text-right text-sm tabular-nums">{m.shown < m.all.length ? `${m.shown} / ${m.all.length}` : m.all.length}</span>
                                    <span className="text-right text-sm text-muted-foreground tabular-nums">~{Math.max(1, Math.round(minutes / 60))} h</span>
                                    <span />
                                </button>

                                {open && units.map(({ topic, list, shown }) => {
                                    const unitIsOpen = unitOpen(topic);
                                    return (
                                        <div key={topic} role="rowgroup">
                                            {/* unit row */}
                                            <button
                                                type="button"
                                                role="row"
                                                onClick={() => flip(setFlippedUnits, topic)}
                                                aria-expanded={unitIsOpen}
                                                className={cn(ROW, "group w-full border-b py-2 text-left text-sm hover:bg-muted/30")}
                                            >
                                                <span />
                                                <span className="flex min-w-0 items-center gap-2 pl-1">
                                                    <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", !unitIsOpen && "-rotate-90")} />
                                                    <span className="truncate">{topicName(topic)}</span>
                                                </span>
                                                <span className="text-right text-xs text-muted-foreground tabular-nums">
                                                    {role && roleWeight.has(topic) ? `${Math.round(roleWeight.get(topic)! * 100)}%` : ""}
                                                </span>
                                                <span className="text-right tabular-nums">{shown.length < list.length ? `${shown.length} / ${list.length}` : list.length}</span>
                                                <span className="text-right text-muted-foreground tabular-nums">{list.reduce((s, e) => s + e.durationMinutes, 0)} min</span>
                                                <span />
                                            </button>
                                            {/* exercise rows */}
                                            {unitIsOpen && shown.map((e) => <ExampleRow key={e.name} example={e} />)}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Shared column layout for every row of the table: [toggle] [topic] [match] [exercises] [time] [action]
const ROW = "grid grid-cols-[1rem_minmax(0,1fr)_3.5rem_4.5rem_4rem_2rem] items-center gap-x-3 px-4";

function ExampleRow({ example: e }: { example: ExampleSummary }) {
    return (
        <Link
            href={`/examples/${encodeURIComponent(e.name)}`}
            title={e.title}
            role="row"
            className={cn(ROW, "group/row border-b bg-muted/10 py-1.5 text-sm last:border-b-0 hover:bg-muted/40")}
        >
            <span />
            <span className="flex min-w-0 items-center gap-2 pl-7">
                <FileSearch className="size-4 shrink-0 text-muted-foreground group-hover/row:text-foreground" />
                <span className="truncate">{e.shortName}</span>
            </span>
            <span />
            <span className="text-right text-xs text-muted-foreground tabular-nums">{e.questionCount} questions</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{e.durationMinutes} min</span>
            <ChevronRight className="size-4 justify-self-end text-muted-foreground transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground" />
        </Link>
    );
}

// "backend.concurrency.race_conditions" -> "concurrency"
function areaOf(label: string): string {
    return label.split(".")[1] ?? label;
}
