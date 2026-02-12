export interface QuizQuestion {
  id: string;
  questionText: string; // Markdown+LaTeX
  choices: QuizChoice[];
  topic: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuizChoice {
  id: string;
  text: string; // Markdown+LaTeX
  correct: boolean;
  explanation: string;
}

export interface QuizResult {
  score: number; // 0.0 to 1.0
  recommendation: "advance" | "supplement" | "regenerate";
  weakTopics: string[];
  topicScores: Record<string, number>;
}

export interface QuizAnswers {
  [questionId: string]: string[]; // selected choice IDs
}
