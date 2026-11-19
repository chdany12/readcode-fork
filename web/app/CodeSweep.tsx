"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { codeFont } from "@/lib/fonts";

// Text that briefly shows as its own markup, then renders, once, after `delay` ms:
//   1. the text switches to monospace with its HTML tags showing, e.g. <h1>Practice <code>code</code></h1>,
//   2. holds for `hold` ms,
//   3. over `restore` ms the tag pairs disappear (inner, then outer), and at the end the whole text
//      returns to the normal font at once, as if the page finished rendering.
// `markup` names the element tag shown around the whole text; `inline` wraps one phrase in another tag.
// Skipped when the viewer prefers reduced motion; screen readers always get the plain text.
const MONO_SIZE = 0.88;
const MIN_SIZE = 0.8;

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
    inline?: { phrase: string; tag: string }; // e.g. { phrase: "code", tag: "code" } -> <code>code</code>
    delay?: number;
    hold?: number;
    restore?: number;
}) {
    // ms since the restore began (negative while holding); null = idle (plain text)
    const [elapsed, setElapsed] = useState<number | null>(null);
    // when each character, and each of the four tags (outer open/close, inline open/close), goes back to normal
    const [settle, setSettle] = useState<{ chars: number[]; tags: number[] }>({ chars: [], tags: [] });
    // Mono size in em: ~0.88 optically matches the UI font (mono glyphs are wider); shrunk only a little if needed.
    const [monoSize, setMonoSize] = useState(MONO_SIZE);
    const [oneLine, setOneLine] = useState(false); // a single-line text stays on one line (tags may extend past its edges)
    const overlayRef = useRef<HTMLSpanElement>(null);
    const animating = elapsed !== null;

    // When the effect starts: keep a one-line text on one line; for multi-line text, shrink the mono font
    // a little (never below MIN_SIZE) so it fits the plain text's box.
    useLayoutEffect(() => {
        if (!animating || !overlayRef.current) return;
        const overlay = overlayRef.current; // absolutely positioned over the plain text, so clientHeight = the plain text's height
        const lineHeight = parseFloat(getComputedStyle(overlay).lineHeight) || 0;
        if (lineHeight && overlay.clientHeight < lineHeight * 1.5) {
            // one line: stay on one line, shrinking only if it would be wider than the element's full width
            const available = overlay.parentElement?.clientWidth ?? Infinity;
            overlay.style.whiteSpace = "nowrap";
            let size = MONO_SIZE;
            overlay.style.setProperty("--mono-size", `${size}em`);
            while (overlay.scrollWidth > available && size > 0.6) {
                size -= 0.02;
                overlay.style.setProperty("--mono-size", `${size}em`);
            }
            setMonoSize(size);
            setOneLine(true);
            return;
        }
        let size = MONO_SIZE;
        overlay.style.setProperty("--mono-size", `${size}em`);
        while (overlay.scrollHeight > overlay.clientHeight + 1 && size > MIN_SIZE) {
            size -= 0.02;
            overlay.style.setProperty("--mono-size", `${size}em`);
        }
        setMonoSize(size);
    }, [animating]);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        let holdTimer: ReturnType<typeof setTimeout>;
        let ticker: ReturnType<typeof setInterval>;
        const startTimer = setTimeout(() => {
            setSettle({
                chars: [...text].map(() => restore), // all at once, when the restore ends
                // tags go a little early, so the text is briefly bare mono before it finishes rendering
                // each tag pair (outer, inline) disappears together, so a tag is never left without its partner
                tags: (() => {
                    const outer = restore * (0.25 + Math.random() * 0.35);
                    const inner = restore * (0.1 + Math.random() * 0.35);
                    return [outer, outer, inner, inner];
                })(),
            });
            setElapsed(-1);
            holdTimer = setTimeout(() => {
                const start = Date.now();
                ticker = setInterval(() => {
                    const t = Date.now() - start;
                    if (t < restore) setElapsed(t);
                    else {
                        clearInterval(ticker);
                        setElapsed(null);
                    }
                }, 30);
            }, hold);
        }, delay);
        return () => {
            clearTimeout(startTimer);
            clearTimeout(holdTimer);
            clearInterval(ticker);
        };
    }, [text, delay, hold, restore]);

    if (elapsed === null) return <Tag className={className}>{text}</Tag>;

    const monoStyle = { fontSize: "var(--mono-size)" };
    const tag = (k: number, s: string) =>
        elapsed < (settle.tags[k] ?? 0) ? (
            <span key={`t${k}`} className={`${codeFont.className} text-muted-foreground/70`} style={monoStyle}>{s}</span>
        ) : null;
    const char = (ch: string, i: number) =>
        elapsed < (settle.chars[i] ?? 0) ? <span key={i} className={codeFont.className} style={monoStyle}>{ch}</span> : ch;

    // split around the inline phrase (first occurrence), keeping character indexes for the settle times
    const chars = [...text];
    const at = inline ? text.indexOf(inline.phrase) : -1;
    const run = (from: number, to: number) => chars.slice(from, to).map((ch, j) => char(ch, from + j));

    // The plain text stays in the layout (invisible) so the page doesn't move; the animated copy is drawn on top.
    return (
        <Tag className={`relative ${className ?? ""}`} aria-label={text}>
            <span aria-hidden className="invisible">{text}</span>
            <span
                ref={overlayRef}
                aria-hidden
                className={oneLine ? "absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap" : "absolute inset-0"}
                style={{ ["--mono-size" as string]: `${monoSize}em` }}
            >
                {markup && tag(0, `<${markup}>`)}
                {at < 0 || !inline ? (
                    run(0, chars.length)
                ) : (
                    <>
                        {run(0, at)}
                        {tag(2, `<${inline.tag}>`)}
                        {run(at, at + inline.phrase.length)}
                        {tag(3, `</${inline.tag}>`)}
                        {run(at + inline.phrase.length, chars.length)}
                    </>
                )}
                {markup && tag(1, `</${markup}>`)}
            </span>
        </Tag>
    );
}
