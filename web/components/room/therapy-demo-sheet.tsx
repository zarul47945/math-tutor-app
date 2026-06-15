"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCorrectAnswerCountForSet,
  getNextTherapyQuestionId,
  getTherapyQuestionIdInDirection,
  THERAPY_DEMO_QUESTION_BY_ID,
  THERAPY_DEMO_QUESTION_ORDER,
  THERAPY_DEMO_SETS,
  type TherapyAnswerMap,
  type TherapyInkPoint,
  type TherapyInkStroke,
  type TherapySetId,
  type TherapySubmittedSetMap,
} from "@/lib/therapy-demo";
import type { LiveKitRole } from "@/lib/types";
import { formatSeconds } from "@/lib/utils";

const TEACHER_INK = "#165dff";
const STUDENT_INK = "#ea580c";

function drawStroke(
  context: CanvasRenderingContext2D,
  height: number,
  stroke: TherapyInkStroke,
  width: number,
) {
  if (stroke.points.length === 0) {
    return;
  }

  context.strokeStyle = stroke.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = stroke.size;

  const [firstPoint, ...restPoints] = stroke.points;
  context.beginPath();
  context.moveTo(firstPoint.x * width, firstPoint.y * height);

  restPoints.forEach((point) => {
    context.lineTo(point.x * width, point.y * height);
  });

  if (restPoints.length === 0) {
    context.lineTo(firstPoint.x * width + 0.5, firstPoint.y * height + 0.5);
  }

  context.stroke();
}

export function TherapyDemoSheet({
  answers,
  elapsedSeconds,
  inkStrokes,
  isSubmitting,
  isTimerRunning,
  onAnswerChange,
  onClearInk,
  onResetWorksheet,
  onStrokeComplete,
  onSubmitSet,
  role,
  submittedSets,
}: {
  answers: TherapyAnswerMap;
  elapsedSeconds: number;
  inkStrokes: TherapyInkStroke[];
  isSubmitting: boolean;
  isTimerRunning: boolean;
  onAnswerChange: (questionId: string, value: string) => void;
  onClearInk: () => void;
  onResetWorksheet: () => void;
  onStrokeComplete: (stroke: TherapyInkStroke) => void;
  onSubmitSet: (setId: TherapySetId) => void;
  role: LiveKitRole;
  submittedSets: TherapySubmittedSetMap;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<TherapyInkStroke | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState(
    THERAPY_DEMO_QUESTION_ORDER[0] ?? "",
  );
  const [canvasSize, setCanvasSize] = useState({ height: 0, width: 0 });
  const [draftPoints, setDraftPoints] = useState<TherapyInkPoint[]>([]);
  const [inputMode, setInputMode] = useState<"keyboard" | "pen">("keyboard");
  const strokeColor = role === "teacher" ? TEACHER_INK : STUDENT_INK;
  const isStudentEditor = role === "student";
  const allSetsSubmitted = THERAPY_DEMO_SETS.every(
    (set) => submittedSets[set.id],
  );
  const setWorkflow = useMemo(
    () =>
      Object.fromEntries(
        THERAPY_DEMO_SETS.map((set, setIndex) => {
          const previousSet = THERAPY_DEMO_SETS[setIndex - 1];
          const unlocked = !previousSet || submittedSets[previousSet.id];
          const submitted = submittedSets[set.id];

          return [
            set.id,
            {
              editable: isStudentEditor && unlocked && !submitted,
              submitted,
              unlocked,
            },
          ];
        }),
      ) as Record<
        TherapySetId,
        { editable: boolean; submitted: boolean; unlocked: boolean }
      >,
    [isStudentEditor, submittedSets],
  );
  const canEdit = isStudentEditor && !allSetsSubmitted;
  const visibleAnswers = useMemo(() => answers, [answers]);
  const visibleInkStrokes = useMemo(() => inkStrokes, [inkStrokes]);
  const setScores = useMemo(
    () =>
      Object.fromEntries(
        THERAPY_DEMO_SETS.map((set) => [
          set.id,
          getCorrectAnswerCountForSet(answers, set.id),
        ]),
      ) as Record<(typeof THERAPY_DEMO_SETS)[number]["id"], number>,
    [answers],
  );
  const activeQuestion = THERAPY_DEMO_QUESTION_BY_ID.get(activeQuestionId);
  const canEditActiveQuestion = Boolean(
    activeQuestion && setWorkflow[activeQuestion.setId].editable,
  );
  const submittedSetCount = THERAPY_DEMO_SETS.filter(
    (set) => submittedSets[set.id],
  ).length;
  const progressLabel = allSetsSubmitted
    ? "All submitted"
    : submittedSetCount > 0
      ? `Set ${submittedSetCount + 1} ready`
      : isTimerRunning
        ? "Student answering"
        : "Waiting to begin";

  useEffect(() => {
    const wrapper = wrapperRef.current;

    if (!wrapper) {
      return;
    }

    const syncCanvasSize = () => {
      setCanvasSize({
        height: wrapper.clientHeight,
        width: wrapper.clientWidth,
      });
    };

    syncCanvasSize();

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canEditActiveQuestion || inputMode !== "keyboard" || !activeQuestionId) {
      return;
    }

    const activeInput = inputRefs.current[activeQuestionId];
    activeInput?.focus();
    activeInput?.select();
  }, [activeQuestionId, canEditActiveQuestion, inputMode]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    visibleInkStrokes.forEach((stroke) =>
      drawStroke(context, canvas.height, stroke, canvas.width),
    );

    if (currentStrokeRef.current) {
      drawStroke(context, canvas.height, currentStrokeRef.current, canvas.width);
    }
  }, [canvasSize.height, canvasSize.width, draftPoints, visibleInkStrokes]);

  const makePoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return null;
    }

    return {
      x: Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1),
      y: Math.min(Math.max((clientY - bounds.top) / bounds.height, 0), 1),
    };
  };

  const finishStroke = () => {
    if (!currentStrokeRef.current) {
      return;
    }

    const completedStroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setDraftPoints([]);
    onStrokeComplete(completedStroke);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || inputMode !== "pen") {
      return;
    }

    const point = makePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    const nextStroke: TherapyInkStroke = {
      author: role,
      color: strokeColor,
      id: crypto.randomUUID(),
      points: [point],
      size: 3.5,
    };

    currentStrokeRef.current = nextStroke;
    setDraftPoints([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || inputMode !== "pen" || !currentStrokeRef.current) {
      return;
    }

    const point = makePoint(event.clientX, event.clientY);

    if (!point) {
      return;
    }

    currentStrokeRef.current = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, point],
    };
    setDraftPoints([...currentStrokeRef.current.points]);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || inputMode !== "pen") {
      return;
    }

    finishStroke();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const moveFocus = (direction: "down" | "left" | "right" | "up") => {
    const nextQuestionId = getTherapyQuestionIdInDirection(
      activeQuestionId,
      direction,
    );
    const nextQuestion = nextQuestionId
      ? THERAPY_DEMO_QUESTION_BY_ID.get(nextQuestionId)
      : null;

    if (nextQuestion && setWorkflow[nextQuestion.setId].editable) {
      setActiveQuestionId(nextQuestion.id);
      return;
    }

    setActiveQuestionId(activeQuestionId);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    questionId: string,
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus("up");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus("down");
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus("left");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus("right");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const nextQuestionId = getNextTherapyQuestionId(questionId);
      const nextQuestion = nextQuestionId
        ? THERAPY_DEMO_QUESTION_BY_ID.get(nextQuestionId)
        : null;

      setActiveQuestionId(
        nextQuestion && setWorkflow[nextQuestion.setId].editable
          ? nextQuestion.id
          : questionId,
      );
    }
  };

  const handleSubmitSetClick = (setId: TherapySetId) => {
    onSubmitSet(setId);

    const currentSetIndex = THERAPY_DEMO_SETS.findIndex((set) => set.id === setId);
    const nextSet = THERAPY_DEMO_SETS[currentSetIndex + 1];

    if (nextSet) {
      setActiveQuestionId(nextSet.questions[0]?.id ?? activeQuestionId);
    }
  };

  return (
    <Card className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Badge>Skills practice</Badge>
            <Badge className="bg-[var(--color-surface-soft)] text-[var(--color-text-soft)]">
              {progressLabel}
            </Badge>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tight text-[var(--color-text)]">
              Fasa 2 Tanduk Rusa 1 / Phase 2 Tanduk Rusa 1
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-soft)]">
              {isStudentEditor
                ? (
                    <>
                      Students can answer by keyboard, press{" "}
                      <span className="font-semibold text-[var(--color-text)]">
                        Enter
                      </span>{" "}
                      to move on, use the arrow keys to jump between boxes, or
                      switch to pen mode and write directly on the worksheet
                      with a stylus or mouse.
                    </>
                  )
                : "Teacher view is read-only. The teacher can watch the student answer live, while marks stay hidden until final submission."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {isStudentEditor ? (
            <>
              <Button
                disabled={allSetsSubmitted}
                onClick={() => setInputMode("keyboard")}
                variant={inputMode === "keyboard" ? "primary" : "secondary"}
              >
                Type answers
              </Button>
              <Button
                disabled={allSetsSubmitted}
                onClick={() => setInputMode("pen")}
                variant={inputMode === "pen" ? "primary" : "secondary"}
              >
                Writing pad
              </Button>
              <Button
                disabled={allSetsSubmitted}
                onClick={onClearInk}
                variant="secondary"
              >
                Clear writing
              </Button>
              <Button onClick={onResetWorksheet} variant="secondary">
                Reset worksheet
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div
        className="relative rounded-[28px] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-card)]"
        ref={wrapperRef}
      >
        <div className="border-t-4 border-dashed border-[var(--color-text)] pt-6">
          <div className="space-y-8">
            {THERAPY_DEMO_SETS.map((set) => {
              const lastQuestionId = set.questions[set.questions.length - 1]?.id;
              const { editable, submitted, unlocked } = setWorkflow[set.id];

              return (
                <section
                  key={set.id}
                  className={`space-y-5 ${unlocked ? "" : "opacity-45"}`}
                >
                  <div className="space-y-1">
                    <p className="text-3xl font-black text-[var(--color-text)]">
                      {set.title}
                    </p>
                    <p className="text-lg text-[var(--color-text-soft)]">
                      Selesaikan / Solve
                    </p>
                  </div>

                <div className="grid gap-5 md:grid-cols-3">
                  {[0, 1, 2].map((column) => (
                    <div className="space-y-4" key={`${set.id}-col-${column}`}>
                      {set.questions
                        .filter((question) => question.gridCol === column)
                        .sort(
                          (leftQuestion, rightQuestion) =>
                            leftQuestion.gridRow - rightQuestion.gridRow,
                        )
                        .map((question) => {
                          const rawValue = answers[question.id]?.trim() ?? "";
                          const isCorrect =
                            rawValue !== "" &&
                            Number(rawValue) === question.expectedAnswer;
                          const isWrong = rawValue !== "" && !isCorrect;
                          const canEditQuestion =
                            editable && inputMode === "keyboard";
                          const isLastQuestion = question.id === lastQuestionId;

                          return (
                            <div
                              className="flex flex-wrap items-center gap-3 text-2xl font-black text-[var(--color-text)]"
                              key={question.id}
                            >
                              <span className="w-7 text-right">{question.augend}</span>
                              <span>+</span>
                              <input
                                autoComplete="off"
                                className={`h-12 w-16 rounded-none border-2 bg-white px-1 text-center text-2xl font-black text-[var(--color-text)] outline-none transition ${
                                  submitted && isCorrect
                                    ? "border-emerald-500 bg-emerald-50"
                                    : submitted && isWrong
                                      ? "border-rose-400 bg-rose-50"
                                      : activeQuestionId === question.id
                                        ? "border-[var(--color-primary)]"
                                        : "border-[var(--color-border-strong)]"
                                } ${
                                  inputMode === "pen" || !editable
                                    ? "pointer-events-none opacity-75"
                                    : ""
                                }`}
                                inputMode="numeric"
                                onChange={(event) => {
                                  if (!canEditQuestion) {
                                    return;
                                  }

                                  const sanitizedValue = event.target.value
                                    .replace(/[^\d]/g, "")
                                    .slice(0, 2);
                                  onAnswerChange(question.id, sanitizedValue);
                                }}
                                onFocus={() => {
                                  if (!editable) {
                                    return;
                                  }

                                  setActiveQuestionId(question.id);
                                  if (inputMode !== "keyboard") {
                                    setInputMode("keyboard");
                                  }
                                }}
                                onKeyDown={(event) => handleKeyDown(event, question.id)}
                                placeholder="?"
                                readOnly={!canEditQuestion}
                                ref={(element) => {
                                  inputRefs.current[question.id] = element;
                                }}
                                value={visibleAnswers[question.id] ?? ""}
                              />
                              <span>=</span>
                              <span className="w-9">{question.result}</span>
                              {isStudentEditor && isLastQuestion ? (
                                <Button
                                  className="min-h-10 px-4 text-xs"
                                  disabled={!unlocked || submitted || isSubmitting}
                                  onClick={() => handleSubmitSetClick(set.id)}
                                  variant={submitted ? "secondary" : "primary"}
                                >
                                  {submitted
                                    ? "Submitted"
                                    : isSubmitting
                                      ? "Submitting..."
                                      : "Submit"}
                                </Button>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 border-t border-dashed border-[var(--color-border)] pt-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-[20px] bg-[var(--color-surface-soft)] px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                      Masa / Time
                    </p>
                    <p className="font-mono text-2xl font-bold text-[var(--color-text)]">
                      {formatSeconds(elapsedSeconds)}
                    </p>
                    <p className="text-sm text-[var(--color-text-soft)]">
                      Masa terbaik / Best time: {set.bestTimeLabel}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[20px] bg-[var(--color-surface-soft)] px-4 py-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">
                      Markah / Marks
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text)]">
                      {submitted
                        ? `${setScores[set.id]}/${set.questions.length}`
                        : "--/--"}
                    </p>
                    <p className="text-sm text-[var(--color-text-soft)]">
                      {submitted
                        ? "Final marks are now visible to both teacher and student."
                        : "Marks stay hidden until this exercise is submitted."}
                    </p>
                  </div>
                </div>
                </section>
              );
            })}
          </div>
        </div>

        <canvas
          className={`absolute inset-0 h-full w-full rounded-[28px] ${
            canEdit && inputMode === "pen"
              ? "pointer-events-auto cursor-crosshair"
              : "pointer-events-none"
          }`}
          onPointerDown={handlePointerDown}
          onPointerLeave={finishStroke}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={canvasRef}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)]">
          {!isStudentEditor
            ? "The teacher can watch live typed answers and handwriting as the student works, but the teacher cannot edit the worksheet."
            : allSetsSubmitted
            ? "All exercise sets have been submitted. Reset the worksheet to try a fresh timed attempt."
            : inputMode === "keyboard"
              ? "Keyboard mode is active. Type a number, press Enter to move to the next box, and use the arrow keys to jump around the worksheet."
              : "Writing pad mode is active. Use a stylus, pen tablet, touch screen, or mouse to handwrite directly on the worksheet."}
        </div>
        <div className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-4 text-sm leading-6 text-[var(--color-text-soft)]">
          {allSetsSubmitted
            ? "All marks are now visible to both teacher and student, and the timer has stopped for both sides."
            : "Each exercise set is submitted separately. Marks appear only for submitted sets, while the next set stays locked until the previous one is submitted."}
        </div>
      </div>
    </Card>
  );
}
