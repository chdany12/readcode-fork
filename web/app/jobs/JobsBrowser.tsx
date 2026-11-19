"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useToggleSet } from "@/lib/useToggleSet";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DataTable, ExpandChevron, FilterBar, RowArrow } from "@/components/data-table";
import { LanguageBadge } from "@/components/language-badge";

// One posting as the jobs table needs it (built on the server from JobMatch).
export type JobRow = {
    id: string;
    company: string;
    logo?: string;
    title: string;          // display title
    location: string | null;
    languages: string[];    // the plan's languages, most examples first
    topTopics: string[];    // display names of the plan's top topics
    matched: number;        // exercises available for the plan
    needed: number;         // exercises the plan asks for
};

const SORTS = [
    { id: "company", label: "Sort: company" },
    { id: "coverage", label: "Sort: coverage" },
];

// Shared column layout: [toggle] [role] [top topics] [coverage] [arrow]
const ROW = "grid grid-cols-[1rem_minmax(0,1fr)_4.5rem_1rem] md:grid-cols-[1rem_minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_1rem] items-center gap-x-4 px-4";

// Share of the plan's exercises available in the bank, 0-1.
const coverage = (j: JobRow) => Math.min(1, j.matched / (j.needed || 1));

// Jobs as a filterable table grouped by company; each row opens the role's practice plan.
export default function JobsBrowser({ jobs, initialCompany = "" }: { jobs: JobRow[]; initialCompany?: string }) {
    const [query, setQuery] = useState("");
    const [company, setCompany] = useState(initialCompany);
    const [sort, setSort] = useState("company");
    const [language, setLanguage] = useState("");
    const [collapsed, toggle] = useToggleSet();

    const companies = useMemo(() => [...new Set(jobs.map((j) => j.company))], [jobs]);
    // languages across all plans, by how many roles use them
    const languages = useMemo(
        () => [...Map.groupBy(jobs.flatMap((j) => j.languages), (l) => l).entries()].sort((a, b) => b[1].length - a[1].length).map(([l, n]) => ({ l, n: n.length })),
        [jobs],
    );
    const searchKey = useMemo(
        () => new Map(jobs.map((j) => [j.id, `${j.title} ${j.company} ${j.location ?? ""} ${j.topTopics.join(" ")} ${j.languages.join(" ")}`.toLowerCase()])),
        [jobs],
    );

    const q = query.trim().toLowerCase();
    const shown = jobs.filter((j) => (!company || j.company === company) && (!language || j.languages.includes(language)) && (!q || searchKey.get(j.id)!.includes(q)));
    // groups: by company (in posting order), or a single flat group sorted by coverage
    const groups: [string | null, JobRow[]][] =
        sort === "coverage"
            ? [[null, [...shown].sort((a, b) => coverage(a) - coverage(b))]]
            : [...Map.groupBy(shown, (j) => j.company).entries()];

    return (
        <div>
            <FilterBar query={query} onQuery={setQuery} placeholder="Search roles, languages or topics" shown={shown.length} total={jobs.length} noun="roles">
                <NativeSelect aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)}>
                    <NativeSelectOption value="">All companies</NativeSelectOption>
                    {companies.map((c) => <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <NativeSelectOption value="">All languages</NativeSelectOption>
                    {languages.map(({ l, n }) => <NativeSelectOption key={l} value={l}>{l} ({n})</NativeSelectOption>)}
                </NativeSelect>
                <NativeSelect aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                    {SORTS.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.label}</NativeSelectOption>)}
                </NativeSelect>
            </FilterBar>

            {shown.length === 0 ? (
                <p className="mt-16 text-center text-muted-foreground">No roles match.</p>
            ) : (
                <DataTable
                    label="Roles"
                    cols={ROW}
                    headers={
                        <>
                            <span />
                            <span role="columnheader">Role</span>
                            <span role="columnheader" className="hidden md:block">Top topics</span>
                            <span role="columnheader" className="text-right">Coverage</span>
                            <span />
                        </>
                    }
                >
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
                                        <ExpandChevron open={open} />
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
                </DataTable>
            )}
        </div>
    );
}

function JobRowLink({ job: j, showCompany }: { job: JobRow; showCompany: boolean }) {
    const full = j.matched >= j.needed;
    return (
        <Link href={`/jobs/${j.id}`} role="row" className={cn(ROW, "group/row border-b py-2.5 text-sm last:border-b-0 hover:bg-muted/30")}>
            <span />
            <span className="min-w-0">
                <span className="block truncate">{showCompany ? `${j.company} · ${j.title}` : j.title}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {j.languages.slice(0, 3).map((l) => <LanguageBadge key={l} language={l} />)}
                    {j.location && <span className="truncate">{j.location}</span>}
                </span>
            </span>
            <span className="hidden truncate text-xs text-muted-foreground md:block">{j.topTopics.join(" · ")}</span>
            <span className="flex flex-col items-end gap-1" title={`${j.matched} of ${j.needed} exercises available`}>
                <span className={cn("tabular-nums", full ? "text-foreground" : "text-muted-foreground")}>{j.matched}/{j.needed}</span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", full ? "bg-foreground" : "bg-muted-foreground")} style={{ width: `${coverage(j) * 100}%` }} />
                </span>
            </span>
            <RowArrow />
        </Link>
    );
}
