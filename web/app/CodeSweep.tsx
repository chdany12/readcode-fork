"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { codeFont } from "@/lib/fonts";

const MONO_SIZE = 0.88; // em; optically matches the UI font (mono glyphs are wider)
const MIN_SIZE = 0.6;

// Phases of the reveal: the text as markup (both tag pairs), then without the inline pair, then without any
// tags, then the plain rendered text.
type Phase = "markup" | "outer" | "bare" | "done";

// Text that briefly shows as its own markup, then renders, once, after `delay` ms:
//   <p>Paste a <b>job posting</b>…</p>  ->  <p>Paste a job posting…</p>  ->  Paste a job posting…  (mono)  ->  normal font
// `markup` is the tag shown around the whole text; `inline` wraps one phrase in another tag.
// The tag pairs drop at slightly random moments so it feels like rendering, not a slideshow.
// Skipped when the viewer prefers reduced motion; screen readers always get the plain text.
export default function CodeSweep({
    text,
    as: Tag = "span",
    className,
    markup,
    inline,
    delay = 0,
    hold = 600,
    restore = 800,
}: {
    text: string;
    as?: ElementType;
    className?: string;
    markup?: string;                          // e.g. "h1" -> <h1>…</h1>
    inline?: { phrase: string; tag: string }; // e.g. { phrase: "job posting", tag: "b" } -> <b>job posting</b>
    delay?: number;
    hold?: number;                            // ms showing the full markup
    restore?: number;                         // ms from the first tag dropping to the plain text
}) {
    const [phase, setPhase] = useState<Phase>("done");
    const [oneLine, setOneLine] = useState(false);
    const overlayRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const start = delay + hold;
        const innerOff = start + restore * (0.1 + Math.random() * 0.3);
        const outerOff = innerOff + restore * (0.15 + Math.random() * 0.25);
        const timers = [
            setTimeout(() => setPhase("markup"), delay),
            setTimeout(() => setPhase("outer"), innerOff),
            setTimeout(() => setPhase("bare"), outerOff),
            setTimeout(() => setPhase("done"), start + restore),
        ];
        return () => timers.forEach(clearTimeout);
    }, [text, delay, hold, restore]);

    // When the markup appears, size the mono copy to fit: a one-line text stays on one line within its
    // element's width; a multi-line text stays within the plain text's box.
    const showing = phase !== "done";
    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        if (!showing || !overlay) return;
        const lineHeight = parseFloat(getComputedStyle(overlay).lineHeight) || 0;
        const single = lineHeight > 0 && overlay.clientHeight < lineHeight * 1.5;
        overlay.style.whiteSpace = single ? "nowrap" : "";
        const fits = single
            ? () => overlay.scrollWidth <= (overlay.parentElement?.clientWidth ?? Infinity)
            : () => overlay.scrollHeight <= overlay.clientHeight + 1;
        let size = MONO_SIZE;
        overlay.style.fontSize = `${size}em`;
        while (!fits() && size > MIN_SIZE) {
            size -= 0.02;
            overlay.style.fontSize = `${size}em`;
        }
        setOneLine(single);
    }, [showing]);

    if (!showing) return <Tag className={className}>{text}</Tag>;

    const tag = (s: string) => <span className="text-muted-foreground/70">{s}</span>;
    const at = inline ? text.indexOf(inline.phrase) : -1;
    const body =
        inline && at >= 0 && phase === "markup" ? (
            <>
                {text.slice(0, at)}
                {tag(`<${inline.tag}>`)}
                {inline.phrase}
                {tag(`</${inline.tag}>`)}
                {text.slice(at + inline.phrase.length)}
            </>
        ) : (
            text
        );
    const withOuter = markup && phase !== "bare";

    // The plain text stays in the layout (invisible) so the page doesn't move; the mono copy is drawn on top.
    return (
        <Tag className={`relative ${className ?? ""}`} aria-label={text}>
            <span aria-hidden className="invisible">{text}</span>
            <span
                ref={overlayRef}
                aria-hidden
                className={`${codeFont.className} ${oneLine ? "absolute top-0 left-1/2 -translate-x-1/2" : "absolute inset-0"}`}
            >
                {withOuter && tag(`<${markup}>`)}
                {body}
                {withOuter && tag(`</${markup}>`)}
            </span>
        </Tag>
    );
}
