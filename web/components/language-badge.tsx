import { cn } from "@/lib/utils";
import { codeFont } from "@/lib/fonts";

// Language logos in public/languages (Devicon v2.16.0, MIT). Keys are the names in pipeline/taxonomy/languages.json.
const LOGOS: Record<string, string> = {
    TypeScript: "typescript", JavaScript: "javascript", Java: "java", Kotlin: "kotlin", Go: "go", Python: "python",
    "C#": "csharp", Ruby: "ruby", Rust: "rust", C: "c", "C++": "cpp", Scala: "scala", PHP: "php",
};
// logos drawn in black, which disappear on the dark background
const MONOCHROME = new Set(["Rust"]);

// A programming language as a small pill: its logo, plus the name unless `iconOnly` (the name is then the tooltip).
export function LanguageBadge({ language, iconOnly, className }: { language: string; iconOnly?: boolean; className?: string }) {
    const logo = LOGOS[language];
    return (
        <span
            title={iconOnly ? language : undefined}
            className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] text-muted-foreground", codeFont.className, className)}
        >
            {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/languages/${logo}.svg`} alt={iconOnly ? language : ""} className={cn("size-3.5", MONOCHROME.has(language) && "invert")} />
            )}
            {(!iconOnly || !logo) && language}
        </span>
    );
}
