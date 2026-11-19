"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

// Shared pieces of the filterable tables on the exercises and roles pages.

// Sticky bar above a table: a search field, filter controls (children), and a live "N of M" count.
export function FilterBar({ query, onQuery, placeholder, shown, total, noun, children, footer }: {
    query: string;
    onQuery: (q: string) => void;
    placeholder: string;
    shown: number;
    total: number;
    noun: string;      // "exercises", "roles"
    children?: ReactNode;
    footer?: ReactNode; // e.g. active-filter chips
}) {
    return (
        <div className="sticky top-0 z-20 -mx-6 border-b bg-background/90 px-6 py-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
                <InputGroup className="min-w-56 flex-1 sm:max-w-xs">
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder} />
                </InputGroup>
                {children}
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">{shown} of {total} {noun}</span>
            </div>
            {footer}
        </div>
    );
}

// The table frame and its column-header row; `cols` is the grid layout shared by every row.
export function DataTable({ label, cols, headers, children }: { label: string; cols: string; headers: ReactNode; children: ReactNode }) {
    return (
        <div className="mt-6 overflow-hidden rounded-xl border" role="table" aria-label={label}>
            <div role="row" className={cn(cols, "border-b bg-muted/30 py-2 text-xs font-medium text-muted-foreground")}>
                {headers}
            </div>
            {children}
        </div>
    );
}

// Chevron for a collapsible row: points down when open, right when closed.
export function ExpandChevron({ open, className }: { open: boolean; className?: string }) {
    return <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground", !open && "-rotate-90", className)} />;
}

// Arrow at the end of a link row; nudges right when the row (group/row) is hovered.
export function RowArrow() {
    return <ChevronRight className="size-4 justify-self-end text-muted-foreground transition-transform group-hover/row:translate-x-0.5 group-hover/row:text-foreground" />;
}
