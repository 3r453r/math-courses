/**
 * Canonical list of academic subjects for course classification.
 * Courses can have 1-3 subjects from this list.
 * Stored as a JSON array string in the database (e.g. '["Biology","Chemistry"]').
 */
export const SUBJECTS = [
  // Mathematics & Logic
  "Mathematics",
  "Statistics",
  "Logic",

  // Physical Sciences
  "Physics",
  "Chemistry",
  "Astronomy",
  "Materials Science",

  // Life Sciences
  "Biology",
  "Biochemistry",
  "Neuroscience",
  "Ecology",
  "Genetics",
  "Anatomy & Physiology",

  // Earth & Environmental
  "Earth Science",
  "Environmental Science",
  "Oceanography",
  "Meteorology",
  "Geography",

  // Engineering
  "Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Chemical Engineering",
  "Aerospace Engineering",
  "Robotics",

  // Computer Science & IT
  "Computer Science",
  "Data Science",
  "Artificial Intelligence",
  "Cybersecurity",
  "Software Engineering",

  // Medicine & Health
  "Medicine",
  "Public Health",
  "Nutrition",
  "Pharmacology",
  "Psychology",

  // Social Sciences
  "Economics",
  "Political Science",
  "Sociology",
  "Anthropology",
  "Linguistics",
  "Archaeology",
  "Criminology",

  // Business & Finance
  "Business",
  "Finance",
  "Accounting",
  "Marketing",
  "Management",

  // Humanities
  "Philosophy",
  "History",
  "Literature",
  "Religious Studies",
  "Ethics",
  "Cultural Studies",

  // Arts & Design
  "Music",
  "Visual Arts",
  "Film Studies",
  "Architecture",
  "Graphic Design",
  "Photography",

  // Communication & Media
  "Journalism",
  "Communications",
  "Media Studies",

  // Education
  "Education",

  // Law
  "Law",

  // Agriculture & Food
  "Agriculture",
  "Food Science",

  // Other
  "Other",
] as const;

export type Subject = (typeof SUBJECTS)[number];

/**
 * Parse a subject field from the database.
 * Handles both legacy single-string format ("Mathematics") and
 * new JSON array format ('["Mathematics","Physics"]').
 */
export function parseSubjects(raw: string): string[] {
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  // Legacy single-string value
  return [raw];
}

/**
 * Serialize subjects array to JSON string for database storage.
 */
export function serializeSubjects(subjects: string[]): string {
  return JSON.stringify(subjects);
}
