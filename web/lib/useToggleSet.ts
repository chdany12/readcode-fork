import { useState } from "react";

// A Set of keys in React state, with a toggle (add if missing, remove if present).
export function useToggleSet(): [Set<string>, (key: string) => void] {
    const [set, setSet] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setSet((s) => {
            const n = new Set(s);
            if (n.has(key)) n.delete(key);
            else n.add(key);
            return n;
        });
    return [set, toggle];
}
