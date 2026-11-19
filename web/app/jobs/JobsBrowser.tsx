"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

// One posting as the jobs table needs it (built on the server from JobMatch).
export type JobRow = {
    id: string;
    company: string;
    logo?: string;
    title: string;          // display title
    location: string | null;
    topTopics: string[];    // display names of the plan's top topics
    matched: number;        // exercises available for the plan
    needed: number;         // exercises the plan asks for
};

const SORTS = [
    { id: "company", label: "Sort: company" },
    { id: "coverage", label: "Sort: coverage" },
];

// Jobs as a filterable table grouped by company; each row opens the role's practice plan.
export default function JobsBrowser({ jobs, initialCompany = "" }: { jobs: JobRow[]; initialCompany?: string }) {
    const [query, setQuery] = useState("");
    const [company, setCompany] = useState(initialCompany);
    const [sort, setSort] = useState("company");
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const q = query.trim().toLowerCase();
    const shown = jobs.filter(
        (j) =>
            (!company || j.company === company) &&
            (!q || `${j.title} ${j.company} ${j.location ?? ""} ${j.topTopics.join(" ")}`.toLowerCase().includes(q)),
    );
    const companies = [...new Set(jobs.map((j) => j.company))];
    const coverage = (j: JobRow) => j.matched / (j.needed || 1);

    // groups: by company (in posting order), or a single flat group sorted by coverage
    const groups: [string | null, JobRow[]][] =
        sort === "coverage"
            ? [[null, [...shown].sort((a, b) => coverage(a) - coverage(b))]]
            : [...Map.groupBy(shown, (j) => j.company).entries()];

    const toggle = (c: string) =>
        setCollapsed((s) => {
            const n = new Set(s);
            if (n.has(c)) n.delete(c);
            else n.add(c);
            return n;
        });

    return (
        <div>
            {/* sticky filter bar */}
            <div className="sticky top-0 z-20 -mx-6 border-b bg-background/90 px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                    <InputGroup className="min-w-56 flex-1 sm:max-w-xs">
                        <InputGroupAddon>
                            <Search />
                        </InputGroupAddon>
                        <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles, locations or topics" />
                    </InputGroup>
                    <NativeSelect aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)}>
                        <NativeSelectOption value="">All companies</NativeSelectOption>
                        {companies.map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
                    </NativeSelect>
                    <NativeSelect aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                        {SORTS.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.label}</NativeSelectOption>)}
                    </NativeSelect>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">{shown.length} of {jobs.length} roles</span>
                </div>
            </div>

            {shown.length === 0 ? (
                <p className="mt-16 text-center text-muted-foreground">No roles match.</p>
            ) : (
                <div className="mt-6 overflow-hidden rounded-xl border" role="table" aria-label="Roles">
                    <div role="row" className={cn(ROW, "border-b bg-muted/30 py-2 text-xs font-medium text-muted-foreground")}>
                        <span />
                        <span role="columnheader">Role</span>
                        <span role="columnheader" className="hidden md:block">Top topics</span>
                        <span role="columnheader" className="text-right">Coverage</span>
                        <span />
                    </div>
                    {groups.map(([name, rows]) => {
                        const open = !name || !collapsed.has(name);
                        const logo = rows[0]?.logo;
                        return (
                            <div key={name ?? "all"} role="rowgroup">
                                {name && (
                                    <button
                                        type="button"
                                        role="row"
                                        onClick={() => toggle(name)}
                                        aria-expanded={open}
                                        className={cn(ROW, "group w-full border-b bg-muted/50 py-2.5 text-left hover:bg-muted/70")}
                                    >
                                        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground", !open && "-rotate-90")} />
                                        <span className="flex items-center gap-2 font-semibold">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            {logo && <img src={logo} alt="" className="h-4 w-auto" />}
                                            {name}
                                            <span className="font-normal text-muted-foreground">{rows.length}</span>
                                        </span>
                                        <span className="hidden md:block" />
                                        <span />
                                        <span />
                                    </button>
                                )}
                                {open && rows.map((j) => <JobRowLink key={j.id} job={j} showCompany={!name} />)}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Shared column layout: [toggle] [role] [top topics] [coverage] [arrow]
const ROW = "grid grid-cols-[1rem_minmax(0,1fr)_4.5rem_1rem] md:grid-cols-[1rem_minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_1rem] items-center gap-x-4 px-4";

function JobRowLink({ job: j, showCompany }: { job: JobRow; showCompany: boolean }) {
    const full = j.matched >= j.needed;
    return (
        <Link href={`/jobs/${j.id}`} role="row" className={cn(ROW, "group/row border-b py-2.5 text-sm last:border-b-0 hover:bg-muted/30")}>
            <span />
            <span className="min-w-0">
                <span className="block truncate">{showCompany ? `${j.company} · ${j.title}` : j.title}</span>
                {j.location && <span className="block truncate text-xs text-muted-foreground">{j.location}</span>}
            </span>
            <span className="hidden truncate text-xs text-muted-foreground md:block">{j.topTopics.join(" · ")}</span>
            <span className="flex flex-col items-end gap-1" title={`${j.matched} of ${j.needed} exercises available`}>
                <span className={cn("tabular-nums", full ? "text-foreground" : "text-muted-foreground")}>{j.matched}/{j.needed}</span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", full ? "bg-foreground" : "bg-muted-foreground")} style={{ width: `${Math.min(100, (j.matched / (j.needed || 1)) * 100)}%` }} />
                </span>
            </span>
            <ChevronRight className="size-4 justify-self-end text-muted-foreground transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground" />
        </Link>
    );
}
