// ReadCode wordmark: "Read" in the UI font, "Code" in monospace and a softer tone,
// set inside faint angle brackets so the name itself reads like code.
export default function Logo() {
    return (
        <span className="flex items-baseline text-xl font-semibold tracking-tight select-none">
            <span className="font-mono text-base font-normal text-muted-foreground">&lt;</span>
            <span>Read</span>
            <span className="font-mono font-normal text-foreground/70">Code</span>
            <span className="font-mono text-base font-normal text-muted-foreground">/&gt;</span>
        </span>
    );
}
