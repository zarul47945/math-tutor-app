export type TherapySetId = "set-1" | "set-2";

export type TherapyQuestion = {
  augend: number;
  expectedAnswer: number;
  gridCol: number;
  gridRow: number;
  id: string;
  result: number;
  setId: TherapySetId;
};

export type TherapySet = {
  bestTimeLabel: string;
  id: TherapySetId;
  questions: TherapyQuestion[];
  title: string;
};

export type TherapyAnswerMap = Record<string, string>;

export type TherapyInkPoint = {
  x: number;
  y: number;
};

export type TherapyInkStroke = {
  author: string;
  color: string;
  id: string;
  points: TherapyInkPoint[];
  size: number;
};

function buildSet(
  id: TherapySetId,
  rowOffset: number,
  title: string,
  prompts: Array<{
    augend: number;
    col: number;
    result: number;
    row: number;
  }>,
): TherapySet {
  return {
    bestTimeLabel: "00:30",
    id,
    questions: prompts.map((prompt, index) => ({
      augend: prompt.augend,
      expectedAnswer: prompt.result - prompt.augend,
      gridCol: prompt.col,
      gridRow: rowOffset + prompt.row,
      id: `${id}-q${index + 1}`,
      result: prompt.result,
      setId: id,
    })),
    title,
  };
}

export const THERAPY_DEMO_SETS: TherapySet[] = [
  buildSet("set-1", 0, "Set 1 TR", [
    { augend: 1, col: 0, result: 6, row: 0 },
    { augend: 4, col: 0, result: 9, row: 1 },
    { augend: 5, col: 0, result: 5, row: 2 },
    { augend: 5, col: 0, result: 10, row: 3 },
    { augend: 2, col: 1, result: 7, row: 0 },
    { augend: 5, col: 1, result: 6, row: 1 },
    { augend: 3, col: 1, result: 8, row: 2 },
    { augend: 5, col: 1, result: 9, row: 3 },
    { augend: 0, col: 2, result: 5, row: 0 },
    { augend: 5, col: 2, result: 8, row: 1 },
    { augend: 5, col: 2, result: 7, row: 2 },
  ]),
  buildSet("set-2", 6, "Set 2 TR", [
    { augend: 1, col: 0, result: 6, row: 0 },
    { augend: 4, col: 0, result: 9, row: 1 },
    { augend: 5, col: 0, result: 5, row: 2 },
    { augend: 5, col: 0, result: 10, row: 3 },
    { augend: 2, col: 1, result: 7, row: 0 },
    { augend: 5, col: 1, result: 6, row: 1 },
    { augend: 3, col: 1, result: 8, row: 2 },
    { augend: 5, col: 1, result: 9, row: 3 },
    { augend: 0, col: 2, result: 5, row: 0 },
    { augend: 5, col: 2, result: 8, row: 1 },
    { augend: 5, col: 2, result: 7, row: 2 },
  ]),
];

export const THERAPY_DEMO_QUESTIONS = THERAPY_DEMO_SETS.flatMap(
  (set) => set.questions,
);

export const THERAPY_DEMO_QUESTION_BY_ID = new Map(
  THERAPY_DEMO_QUESTIONS.map((question) => [question.id, question]),
);

export const THERAPY_DEMO_QUESTION_ORDER = THERAPY_DEMO_QUESTIONS.map(
  (question) => question.id,
);

function findQuestionAtPosition(gridRow: number, gridCol: number) {
  return THERAPY_DEMO_QUESTIONS.find(
    (question) => question.gridRow === gridRow && question.gridCol === gridCol,
  );
}

export function getNextTherapyQuestionId(currentQuestionId: string) {
  const currentIndex = THERAPY_DEMO_QUESTION_ORDER.indexOf(currentQuestionId);

  if (currentIndex === -1) {
    return THERAPY_DEMO_QUESTION_ORDER[0] ?? null;
  }

  return (
    THERAPY_DEMO_QUESTION_ORDER[currentIndex + 1] ??
    THERAPY_DEMO_QUESTION_ORDER[currentIndex] ??
    null
  );
}

export function getTherapyQuestionIdInDirection(
  currentQuestionId: string,
  direction: "down" | "left" | "right" | "up",
) {
  const currentQuestion = THERAPY_DEMO_QUESTION_BY_ID.get(currentQuestionId);

  if (!currentQuestion) {
    return THERAPY_DEMO_QUESTION_ORDER[0] ?? null;
  }

  if (direction === "left" || direction === "right") {
    const colStep = direction === "left" ? -1 : 1;
    let nextCol = currentQuestion.gridCol + colStep;

    while (nextCol >= 0 && nextCol <= 2) {
      const nextQuestion = findQuestionAtPosition(
        currentQuestion.gridRow,
        nextCol,
      );

      if (nextQuestion) {
        return nextQuestion.id;
      }

      nextCol += colStep;
    }

    return currentQuestionId;
  }

  const rowStep = direction === "up" ? -1 : 1;
  let nextRow = currentQuestion.gridRow + rowStep;

  while (nextRow >= 0 && nextRow <= 9) {
    const nextQuestion = findQuestionAtPosition(nextRow, currentQuestion.gridCol);

    if (nextQuestion) {
      return nextQuestion.id;
    }

    nextRow += rowStep;
  }

  return currentQuestionId;
}

export function getCorrectAnswerCountForSet(
  answers: TherapyAnswerMap,
  setId: TherapySetId,
) {
  const set = THERAPY_DEMO_SETS.find((candidateSet) => candidateSet.id === setId);

  if (!set) {
    return 0;
  }

  return set.questions.filter((question) => {
    const rawValue = answers[question.id]?.trim();

    return rawValue !== "" && Number(rawValue) === question.expectedAnswer;
  }).length;
}
