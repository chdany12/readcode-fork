import { codeFont } from "@/lib/fonts";

// ReadCode wordmark: "Read" in the UI font, "Code" in monospace and a softer tone,
// set inside faint angle brackets so the name itself reads like code. Inside a `group/logo` link,
// hovering brightens the dimmed parts.
export default function Logo() {
    return (
        <span className="flex items-baseline text-xl font-semibold tracking-tight select-none">
            <span className={`${codeFont.className} text-base font-normal text-muted-foreground transition-colors group-hover/logo:text-foreground`}>&lt;</span>
            <span>Read</span>
            <span className={`${codeFont.className} font-normal tracking-tighter text-foreground/70 transition-colors group-hover/logo:text-foreground`}>Code</span>
            <span className={`${codeFont.className} text-base font-normal text-muted-foreground transition-colors group-hover/logo:text-foreground`}>/&gt;</span>
        </span>
    );
}
