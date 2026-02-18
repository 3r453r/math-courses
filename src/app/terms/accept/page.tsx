import fs from "fs";
import path from "path";
import { AcceptTermsContent } from "./AcceptTermsContent";

function loadTermsMarkdown(locale: string): string {
  const filePath = path.join(process.cwd(), "src", "content", "terms", `${locale}.md`);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    const enPath = path.join(process.cwd(), "src", "content", "terms", "en.md");
    return fs.readFileSync(enPath, "utf-8");
  }
}

export default function AcceptTermsPage() {
  const terms = {
    en: loadTermsMarkdown("en"),
    pl: loadTermsMarkdown("pl"),
  };

  return <AcceptTermsContent terms={terms} />;
}
