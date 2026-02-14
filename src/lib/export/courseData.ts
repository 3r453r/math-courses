import { prisma } from "@/lib/db";

/**
 * Fetch full course data for export, sharing, and cloning.
 * Returns all course content: lessons, edges, quizzes (with attempts),
 * notes, chat messages, diagnostic quiz, and completion summary.
 */
export async function getFullCourseData(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: { orderIndex: "asc" },
        include: {
          quizzes: {
            orderBy: { createdAt: "desc" },
            include: {
              attempts: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
          notes: {
            orderBy: { orderIndex: "asc" },
          },
          chatMessages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      edges: true,
      notes: {
        orderBy: { orderIndex: "asc" },
      },
      diagnosticQuiz: {
        include: {
          attempts: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
      completionSummary: true,
    },
  });

  return course;
}

export type FullCourseData = NonNullable<Awaited<ReturnType<typeof getFullCourseData>>>;
