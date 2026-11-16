import { Suspense } from "react";
import { EXAMPLES_ROOT, listExamples } from "@/lib/examples";
import ExampleBrowser from "../ExampleBrowser";

export default function ExamplesPage() {
    return (
        <main className="p-6 font-mono text-sm">
                        <p className="text-neutral-500">reading from {EXAMPLES_ROOT}</p>
            <hr className="my-3 border-neutral-400" />
            <Suspense fallback={<p>loading…</p>}>
                <ExampleList />
            </Suspense>
        </main>
    );
}

async function ExampleList() {
    const examples = await listExamples();
    if (examples.length === 0) return <p>no examples found (folders with a public.json)</p>;
    return <ExampleBrowser examples={examples} />;
}
