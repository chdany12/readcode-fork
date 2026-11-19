"use client";

import { LogIn, UserPlus, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Account button for the top right of the nav. There are no accounts yet, so it always shows the
// signed-out state: a default user icon, and a menu whose sign-in items are placeholders.
export default function AccountMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger aria-label="Account" className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Avatar>
                    <AvatarFallback>
                        <UserRound className="size-4 text-muted-foreground" />
                    </AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Not signed in</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                    <LogIn /> Sign in
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                    <UserPlus /> Create account
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
