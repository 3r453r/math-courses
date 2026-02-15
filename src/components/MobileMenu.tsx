"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileMenuProps {
  isAdmin?: boolean;
  showProgress?: boolean;
}

export function MobileMenu({ isAdmin, showProgress }: MobileMenuProps) {
  const router = useRouter();
  const { t } = useTranslation(["dashboard", "common", "login"]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8 p-0 md:hidden">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            Admin
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push("/gallery")}>
          {t("dashboard:gallery")}
        </DropdownMenuItem>
        {process.env.NEXT_PUBLIC_DISCORD_INVITE_URL && (
          <DropdownMenuItem asChild>
            <a
              href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("dashboard:joinDiscord")}
            </a>
          </DropdownMenuItem>
        )}
        {showProgress && (
          <DropdownMenuItem onClick={() => router.push("/progress")}>
            {t("dashboard:viewProgress")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push("/setup")}>
          {t("common:settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/courses/new")}>
          {t("dashboard:newCourse")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          {t("login:signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
