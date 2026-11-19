"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";

// The home page's main input: paste a job posting URL to get a practice plan for it.
// Not wired up yet: classifying a new posting needs the classifier to run on demand.
export default function OwnPosting() {
    const [url, setUrl] = useState("");
    const [sent, setSent] = useState(false);
    const valid = /^https?:\/\/\S+\.\S+/.test(url.trim());

    return (
        <div className="mx-auto w-full max-w-2xl">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (valid) setSent(true);
                }}
                // gradient ring around the field; brighter on focus
                className="group rounded-2xl bg-gradient-to-r from-sky-500/60 via-violet-500/60 to-emerald-500/60 p-px shadow-[0_0_60px_-15px] shadow-violet-500/40 transition-shadow focus-within:from-sky-400 focus-within:via-violet-400 focus-within:to-emerald-400 focus-within:shadow-violet-500/60"
            >
                <div className="flex items-center gap-2 rounded-2xl bg-background p-2 pl-4">
                    <Link2 className="size-5 shrink-0 text-muted-foreground" />
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setSent(false); }}
                        placeholder="Paste a job posting URL"
                        aria-label="Job posting URL"
                        className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="submit"
                        disabled={!valid}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-foreground px-5 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                        Build my plan <ArrowRight className="size-4" />
                    </button>
                </div>
            </form>
            <p className="mt-3 text-center text-sm text-muted-foreground">
                {sent ? "Coming soon: custom plans aren’t available yet." : "For example, a Greenhouse, Lever or company careers page link."}
            </p>
        </div>
    );
}
