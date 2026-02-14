import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getFullCourseData } from "@/lib/export/courseData";
import { toMarkdown } from "@/lib/export/toMarkdown";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { userId, error: authError } = await getAuthUser();
  if (authError) return authError;

  try {
    const { courseId } = await params;
    const { error: ownerError } = await verifyCourseOwnership(courseId, userId);
    if (ownerError) return ownerError;

    const courseData = await getFullCourseData(courseId);
    if (!courseData) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const markdown = toMarkdown(courseData);
    const filename = `${courseData.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export course as Markdown:", error);
    return NextResponse.json({ error: "Failed to export course" }, { status: 500 });
  }
}
