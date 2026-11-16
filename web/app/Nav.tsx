"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    { href: "/", label: "jobs", active: (p: string) => p === "/" },
    { href: "/examples", label: "examples", active: (p: string) => p.startsWith("/examples") },
];

export default function Nav() {
    const pathname = usePathname();
    return (
        <nav className="flex items-center gap-5 border-b border-neutral-300 px-6 py-2 font-mono text-sm">
            <Link href="/" className="font-bold">readcode</Link>
            {TABS.map((t) => (
                <Link key={t.href} href={t.href} className={t.active(pathname) ? "underline underline-offset-4" : "text-neutral-500 hover:text-inherit"}>
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
