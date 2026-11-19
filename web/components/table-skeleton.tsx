import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for a filter bar + grouped table (exercises, roles) while its data loads.
export function TableSkeleton({ filters = 2, groups = 3, rows = 4 }: { filters?: number; groups?: number; rows?: number }) {
    return (
        <div aria-busy aria-label="Loading">
            <div className="-mx-6 border-b px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-8 w-full max-w-xs" />
                    {Array.from({ length: filters }, (_, i) => <Skeleton key={i} className="h-8 w-32" />)}
                    <Skeleton className="ml-auto h-4 w-24" />
                </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border">
                <div className="border-b bg-muted/30 px-4 py-2.5">
                    <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: groups }, (_, g) => (
                    <div key={g}>
                        <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-3">
                            <Skeleton className="size-4" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                        {Array.from({ length: rows }, (_, r) => (
                            <div key={r} className="flex items-center gap-3 border-b px-4 py-3 pl-11 last:border-b-0">
                                <Skeleton className="h-3.5" style={{ width: `${40 + ((g * 7 + r * 13) % 35)}%` }} />
                                <Skeleton className="ml-auto h-3.5 w-12" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
