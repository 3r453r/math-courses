import { getAuthUser, verifyCourseOwnership } from "@/lib/auth-utils";
import { getFullCourseData } from "@/lib/export/courseData";
import { toExportJson } from "@/lib/export/toJson";
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

    const exportData = toExportJson(courseData);
    const filename = `${courseData.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export course as JSON:", error);
    return NextResponse.json({ error: "Failed to export course" }, { status: 500 });
  }
}
