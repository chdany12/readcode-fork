"use client";

import { useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

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
                className="group rounded-2xl bg-gradient-to-r from-hero-1/60 via-hero-2/60 to-hero-3/60 p-px shadow-[0_0_60px_-15px] shadow-hero-2/40 transition-shadow focus-within:from-hero-1 focus-within:via-hero-2 focus-within:to-hero-3 focus-within:shadow-hero-2/60"
            >
                <div className="rounded-2xl bg-background">
                <InputGroup className="h-auto rounded-2xl border-0 p-2 pl-2">
                    <InputGroupAddon>
                        <Link2 className="size-5" />
                    </InputGroupAddon>
                    <InputGroupInput
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setSent(false); }}
                        placeholder="Paste a job posting URL"
                        aria-label="Job posting URL"
                        className="h-11 text-base md:text-base"
                    />
                    <InputGroupAddon align="inline-end">
                        <Button type="submit" size="lg" disabled={!valid} className="h-11 rounded-xl px-5">
                            Build my plan <ArrowRight />
                        </Button>
                    </InputGroupAddon>
                </InputGroup>
                </div>
            </form>
            <p className="mt-3 text-center text-sm text-muted-foreground">
                {sent ? "Coming soon: custom plans aren’t available yet." : "For example, a Greenhouse, Lever or company careers page link."}
            </p>
        </div>
    );
}
