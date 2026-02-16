"use client";

import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";

export function LandingFooter() {
  const { t } = useTranslation(["login"]);
  const discordUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

  return (
    <footer className="py-8">
      <Separator className="mb-8" />
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <a href="/gallery" className="hover:text-foreground transition-colors">
            {t("login:footer.gallery")}
          </a>
          <span className="hidden sm:inline">·</span>
          <a href="/pricing" className="hover:text-foreground transition-colors">
            {t("login:footer.pricing")}
          </a>
          {discordUrl && (
            <>
              <span className="hidden sm:inline">·</span>
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Discord
              </a>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
