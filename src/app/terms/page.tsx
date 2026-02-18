import fs from "fs";
import path from "path";
import { TermsContent } from "./TermsContent";

function loadTermsMarkdown(locale: string): string {
  const filePath = path.join(process.cwd(), "src", "content", "terms", `${locale}.md`);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    // Fallback to English
    const enPath = path.join(process.cwd(), "src", "content", "terms", "en.md");
    return fs.readFileSync(enPath, "utf-8");
  }
}

export default function TermsPage() {
  // Pre-load both locales at build/request time
  const terms = {
    en: loadTermsMarkdown("en"),
    pl: loadTermsMarkdown("pl"),
  };

  return <TermsContent terms={terms} />;
}
