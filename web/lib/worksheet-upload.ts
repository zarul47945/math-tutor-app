import type { TherapySet } from "@/lib/therapy-demo";

const DEFAULT_BEST_TIME = "00:30";

type ParsedQuestion = {
  augend: number;
  result: number;
};

function parseQuestionLine(line: string): ParsedQuestion | null {
  const equationMatch = line.match(
    /^\s*(-?\d+)\s*\+\s*(?:\?|\[\s*\]|\[\s*\?\s*\]|_|x)\s*=\s*(-?\d+)\s*$/i,
  );

  if (equationMatch) {
    return {
      augend: Number(equationMatch[1]),
      result: Number(equationMatch[2]),
    };
  }

  const csvMatch = line.match(/^\s*(-?\d+)\s*[,;\t]\s*(-?\d+)\s*$/);

  if (csvMatch) {
    return {
      augend: Number(csvMatch[1]),
      result: Number(csvMatch[2]),
    };
  }

  return null;
}

function makeSet(
  setIndex: number,
  title: string,
  questions: ParsedQuestion[],
): TherapySet {
  const rowsPerColumn = Math.max(1, Math.ceil(questions.length / 3));
  const setId = `set-${setIndex + 1}`;

  return {
    bestTimeLabel: DEFAULT_BEST_TIME,
    id: setId,
    questions: questions.map((question, questionIndex) => ({
      augend: question.augend,
      expectedAnswer: question.result - question.augend,
      gridCol: Math.min(2, Math.floor(questionIndex / rowsPerColumn)),
      gridRow: questionIndex % rowsPerColumn,
      id: `${setId}-q${questionIndex + 1}`,
      result: question.result,
      setId,
    })),
    title,
  };
}

export function parseWorksheetUpload(rawInput: string) {
  const blocks = rawInput
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    throw new Error("Add at least one question before uploading a worksheet.");
  }

  const sets = blocks.map((block, blockIndex) => {
    const lines = block
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsedLines = lines.map((line) => ({
      line,
      question: parseQuestionLine(line),
    }));
    const firstQuestionIndex = parsedLines.findIndex((item) => item.question);
    const title =
      firstQuestionIndex > 0
        ? lines.slice(0, firstQuestionIndex).join(" ")
        : `Exercise ${blockIndex + 1}`;
    const questions = parsedLines
      .map((item) => item.question)
      .filter((question): question is ParsedQuestion => Boolean(question));

    if (questions.length === 0) {
      throw new Error(
        `Exercise ${blockIndex + 1} has no valid questions. Use lines like "1 + ? = 6" or "1,6".`,
      );
    }

    return makeSet(blockIndex, title, questions);
  });

  return {
    instructions: "Type the missing number, or use the writing pad for working.",
    sets,
    title: "Uploaded skills practice",
  };
}

export const WORKSHEET_UPLOAD_EXAMPLE = `Set 1 TR
1 + ? = 6
4 + ? = 9
5 + ? = 5
5 + ? = 10

Set 2 TR
2,7
5,6
3,8
5,9`;
