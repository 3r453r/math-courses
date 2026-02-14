import { getTestPrisma } from "./db";

function prisma() {
  return getTestPrisma();
}

export const TEST_USER_ID = "test-user-id";

export async function createTestUser(overrides?: {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  accessStatus?: string;
}) {
  return prisma().user.create({
    data: {
      id: overrides?.id ?? TEST_USER_ID,
      email: overrides?.email ?? "test@example.com",
      name: overrides?.name ?? "Test User",
      emailVerified: new Date(),
      role: overrides?.role ?? "user",
      accessStatus: overrides?.accessStatus ?? "active",
      accessGrantedAt: new Date(),
      accessSource: "admin_grant",
    },
  });
}

export async function createTestCourse(overrides?: {
  title?: string;
  topic?: string;
  status?: string;
  difficulty?: string;
  language?: string;
  userId?: string;
}) {
  return prisma().course.create({
    data: {
      userId: overrides?.userId ?? TEST_USER_ID,
      title: overrides?.title ?? "Test Course",
      description: "A test course for integration testing",
      topic: overrides?.topic ?? "Mathematics",
      focusAreas: JSON.stringify(["Algebra", "Calculus"]),
      targetLessonCount: 5,
      difficulty: overrides?.difficulty ?? "intermediate",
      language: overrides?.language ?? "en",
      status: overrides?.status ?? "draft",
    },
  });
}

export async function createTestLesson(
  courseId: string,
  overrides?: {
    title?: string;
    orderIndex?: number;
    status?: string;
    contentJson?: string;
  }
) {
  return prisma().lesson.create({
    data: {
      courseId,
      title: overrides?.title ?? "Test Lesson",
      summary: "A test lesson for integration testing",
      orderIndex: overrides?.orderIndex ?? 0,
      status: overrides?.status ?? "pending",
      contentJson: overrides?.contentJson ?? null,
    },
  });
}

export async function createTestEdge(
  courseId: string,
  fromLessonId: string,
  toLessonId: string,
  relationship = "prerequisite"
) {
  return prisma().courseEdge.create({
    data: {
      courseId,
      fromLessonId,
      toLessonId,
      relationship,
    },
  });
}

export async function createTestQuiz(
  lessonId: string,
  overrides?: {
    questionsJson?: string;
    status?: string;
    questionCount?: number;
  }
) {
  return prisma().quiz.create({
    data: {
      lessonId,
      questionsJson: overrides?.questionsJson ?? "[]",
      status: overrides?.status ?? "pending",
      questionCount: overrides?.questionCount ?? 0,
    },
  });
}

export async function createTestDiagnostic(
  courseId: string,
  overrides?: {
    questionsJson?: string;
    status?: string;
  }
) {
  return prisma().diagnosticQuiz.create({
    data: {
      courseId,
      questionsJson: overrides?.questionsJson ?? "{}",
      status: overrides?.status ?? "pending",
    },
  });
}

export async function createTestNote(
  lessonId: string,
  overrides?: {
    content?: string;
    isScratchpad?: boolean;
  }
) {
  return prisma().note.create({
    data: {
      lessonId,
      content: overrides?.content ?? "",
      isScratchpad: overrides?.isScratchpad ?? false,
    },
  });
}
