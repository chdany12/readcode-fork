import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import { EXAMPLES_ROOT } from "@/lib/examples";

type W = { label: string; weight: number };
const SETS = [
    { name: "backend", dir: "golden_list/plans" },
    { name: "systems", dir: "golden_list/systems/plans" },
];

export default function WeightsPage() {
    return (
        <main className="p-6 text-sm">
            <p className="text-muted-foreground">classifier weights per posting · bold = got examples in the plan (count shown)</p>
            <hr className="my-3" />
            <Suspense fallback={<p>loading…</p>}>
                <All />
            </Suspense>
        </main>
    );
}

async function All() {
    const rows: { set: string; id: string; weights: W[]; counts: Map<string, number> }[] = [];
    for (const s of SETS) {
        const dir = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, s.dir);
        const files = (await readdir(path.join(dir, "weights")).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
        for (const f of files) {
            const weights = (JSON.parse(await readFile(path.join(dir, "weights", f), "utf8")).weights as W[]).sort((a, b) => b.weight - a.weight);
            const plan = JSON.parse(await readFile(path.join(dir, f), "utf8").catch(() => '{"targets":[]}'));
            rows.push({ set: s.name, id: f.replace(".json", ""), weights, counts: new Map(plan.targets.map((t: { label: string; count: number }) => [t.label, t.count])) });
        }
    }
    return (
        <div className="space-y-1">
            {rows.map((r) => (
                <details key={r.set + r.id} open={r.set === "systems"}>
                    <summary className="cursor-pointer">
                        {r.set} / {r.id} <span className="text-muted-foreground">({r.weights.length} weighted, {r.counts.size} planned)</span>
                    </summary>
                    <table className="ml-6 mt-1 mb-3">
                        <tbody>
                            {r.weights.map((w) => {
                                const c = r.counts.get(w.label);
                                return (
                                    <tr key={w.label} className={c ? "font-bold" : "text-muted-foreground"}>
                                        <td className="pr-3 whitespace-nowrap">{w.label.split(".").slice(1).join(".")}</td>
                                        <td className="w-64 pr-3">
                                            <div className={`h-3 rounded-sm ${c ? "bg-primary" : "bg-muted-foreground/30"}`} style={{ width: `${w.weight * 100}%` }} />
                                        </td>
                                        <td className="pr-3 text-right">{w.weight.toFixed(2)}</td>
                                        <td>{c ? `×${c}` : ""}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </details>
            ))}
        </div>
    );
}
