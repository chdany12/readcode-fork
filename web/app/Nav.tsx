"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import Logo from "./Logo";

const TABS = [
    { href: "/jobs", label: "jobs", active: (p: string) => p.startsWith("/jobs") },
    { href: "/examples", label: "examples", active: (p: string) => p.startsWith("/examples") },
];

export default function Nav() {
    const pathname = usePathname();
    return (
        <nav className="flex items-center gap-1 border-b px-6 py-3">
            <Link href="/" className="mr-6" aria-label="ReadCode home"><Logo /></Link>
            {TABS.map((t) => (
                <Link key={t.href} href={t.href} className={buttonVariants({ variant: t.active(pathname) ? "secondary" : "ghost", size: "sm" })}>
                    {t.label}
                </Link>
            ))}
        </nav>
    );
}
