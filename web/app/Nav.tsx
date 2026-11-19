"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import Logo from "./Logo";
import AccountMenu from "./AccountMenu";
import { codeFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";

const TABS = [
    { href: "/jobs", label: "jobs", active: (p: string) => p.startsWith("/jobs") },
    { href: "/examples", label: "exercises", active: (p: string) => p.startsWith("/examples") },
];

// The bar itself; `pathname` is null while the URL isn't known yet (prerender), so no tab is highlighted.
export function NavBar({ pathname }: { pathname: string | null }) {
    return (
        <nav className="flex items-center gap-1 border-b px-6 py-3">
            <Link
                href="/"
                aria-label="ReadCode home"
                className="group/logo mr-4 -ml-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
            >
                <Logo />
            </Link>
            {TABS.map((t) => (
                // tabs read like function calls: jobs(), exercises()
                <Link
                    key={t.href}
                    href={t.href}
                    className={cn(buttonVariants({ variant: pathname && t.active(pathname) ? "secondary" : "ghost", size: "sm" }), codeFont.className, "gap-0 font-normal")}
                >
                    {t.label}
                    <span className="text-muted-foreground">()</span>
                </Link>
            ))}
            <div className="ml-auto">
                <AccountMenu />
            </div>
        </nav>
    );
}

// Reads the URL to highlight the current tab; render inside <Suspense> (see layout.tsx).
export default function Nav() {
    return <NavBar pathname={usePathname()} />;
}
