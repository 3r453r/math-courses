import { requireOwner } from "@/lib/auth-utils";
import { getFullCourseData } from "@/lib/export/courseData";
import { toExportJson } from "@/lib/export/toJson";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/courses/[courseId]/export — Export any course as JSON (owner only)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { error: authError } = await requireOwner();
  if (authError) return authError;

  try {
    const { courseId } = await params;

    const data = await getFullCourseData(courseId);
    if (!data) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const exportJson = toExportJson(data);
    return NextResponse.json(exportJson);
  } catch (error) {
    console.error("Failed to export course:", error);
    return NextResponse.json({ error: "Failed to export course" }, { status: 500 });
  }
}
