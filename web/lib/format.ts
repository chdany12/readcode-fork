// Display helpers: turn raw labels and scraped titles into readable text.

const WORDS: Record<string, string> = {
    api: "API", rest: "REST", sql: "SQL", nosql: "NoSQL", orm: "ORM", ttls: "TTLs", ci: "CI",
    n: "N", one: "1", plus: "+", vs: "vs.", and: "&", at: "at", in: "in", on: "on", of: "of",
};

// "backend.concurrency.locking_and_lock_ordering" -> "Locking & lock ordering"
export function topicName(label: string): string {
    const words = (label.split(".").pop() ?? label).split("_").map((w) => WORDS[w] ?? w);
    const text = words.join(" ").replace("N + 1", "N+1");
    return text.charAt(0).toUpperCase() + text.slice(1);
}

// "backend.concurrency.race_conditions" -> "Concurrency"
export function areaName(label: string): string {
    const a = label.split(".")[1] ?? label;
    return a.charAt(0).toUpperCase() + a.slice(1);
}

const SMALL = new Set(["and", "or", "of", "in", "for", "the", "to", "a", "at"]);

// "Software Engineer Ii Google Wallet Onboarding And Communications" -> "Software Engineer II Google Wallet Onboarding and Communications"
export function jobTitle(title: string): string {
    return title
        .split(/\s+/)
        .map((w, i) => {
            if (/^i{2,3}$/i.test(w)) return w.toUpperCase();
            if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
            return w;
        })
        .join(" ");
}
