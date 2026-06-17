import type { TherapySet } from "@/lib/therapy-demo";
import type { LessonWorksheet } from "@/lib/types";

export function worksheetToTherapySets(worksheet: LessonWorksheet): TherapySet[] {
  const groupedQuestions = new Map<
    string,
    {
      bestTimeLabel: string;
      order: number;
      questions: LessonWorksheet["questions"];
      title: string;
    }
  >();

  worksheet.questions.forEach((question) => {
    const currentGroup = groupedQuestions.get(question.set_key);

    if (currentGroup) {
      currentGroup.questions.push(question);
      return;
    }

    groupedQuestions.set(question.set_key, {
      bestTimeLabel: question.best_time_label,
      order: question.set_order,
      questions: [question],
      title: question.set_title,
    });
  });

  return [...groupedQuestions.entries()]
    .sort(
      ([, leftGroup], [, rightGroup]) => leftGroup.order - rightGroup.order,
    )
    .map(([setId, group]) => {
      const sortedQuestions = [...group.questions].sort(
        (leftQuestion, rightQuestion) =>
          leftQuestion.position - rightQuestion.position,
      );
      const rowsPerColumn = Math.max(1, Math.ceil(sortedQuestions.length / 3));

      return {
        bestTimeLabel: group.bestTimeLabel,
        id: setId,
        questions: sortedQuestions.map((question, questionIndex) => ({
          augend: question.augend,
          expectedAnswer: question.expected_answer,
          gridCol: Math.min(2, Math.floor(questionIndex / rowsPerColumn)),
          gridRow: questionIndex % rowsPerColumn,
          id: `${setId}-q${questionIndex + 1}`,
          result: question.result,
          setId,
        })),
        title: group.title,
      };
    });
}

export function worksheetToUploadText(worksheet: LessonWorksheet | null) {
  if (!worksheet) {
    return "";
  }

  const groupedQuestions = new Map<
    string,
    {
      order: number;
      questions: LessonWorksheet["questions"];
      title: string;
    }
  >();

  worksheet.questions.forEach((question) => {
    const currentGroup = groupedQuestions.get(question.set_key);

    if (currentGroup) {
      currentGroup.questions.push(question);
      return;
    }

    groupedQuestions.set(question.set_key, {
      order: question.set_order,
      questions: [question],
      title: question.set_title,
    });
  });

  return [...groupedQuestions.values()]
    .sort((leftGroup, rightGroup) => leftGroup.order - rightGroup.order)
    .map((group) => {
      const questionLines = [...group.questions]
        .sort(
          (leftQuestion, rightQuestion) =>
            leftQuestion.position - rightQuestion.position,
        )
        .map((question) => `${question.augend} + ? = ${question.result}`);

      return [group.title, ...questionLines].join("\n");
    })
    .join("\n\n");
}
