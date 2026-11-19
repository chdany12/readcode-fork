"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import Logo from "./Logo";

const TABS = [
    { href: "/jobs", label: "jobs", active: (p: string) => p.startsWith("/jobs") },
    { href: "/examples", label: "exercises", active: (p: string) => p.startsWith("/examples") },
];

// The bar itself; `pathname` is null while the URL isn't known yet (prerender), so no tab is highlighted.
export function NavBar({ pathname }: { pathname: string | null }) {
    return (
        <nav className="flex items-center gap-1 border-b px-6 py-3">
            <Link href="/" className="mr-6" aria-label="ReadCode home"><Logo /></Link>
            {TABS.map((t) => (
                <Link key={t.href} href={t.href} className={buttonVariants({ variant: pathname && t.active(pathname) ? "secondary" : "ghost", size: "sm" })}>
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}

// Reads the URL to highlight the current tab; render inside <Suspense> (see layout.tsx).
export default function Nav() {
    return <NavBar pathname={usePathname()} />;
}
