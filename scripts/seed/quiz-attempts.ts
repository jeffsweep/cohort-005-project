import * as schema from "../../app/db/schema";
import { countRows, db, type User } from "./db";
import { daysAgo } from "./helpers";
import type { SeededQuizzes } from "./quizzes";

// ─── Quiz Attempts ───

export function seedQuizAttempts(
  students: User[],
  {
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
  }: SeededQuizzes
) {
  // Helper to record a quiz attempt with answers
  function recordQuizAttempt(
    userId: number,
    quizId: number,
    optionIds: { questionId: number; optionId: number; correct: boolean }[],
    selectedCorrectIndices: number[], // which questions (0-based) the student got right
    attemptDaysAgo: number
  ) {
    const totalQuestions = new Set(optionIds.map((o) => o.questionId)).size;
    const correctCount = selectedCorrectIndices.length;
    const score = correctCount / totalQuestions;

    // Determine passing based on quiz passingScore (we'll just use 0.7 as default)
    const passed = score >= 0.7;

    const [attempt] = db
      .insert(schema.quizAttempts)
      .values({
        userId,
        quizId,
        score,
        passed,
        attemptedAt: daysAgo(attemptDaysAgo),
      })
      .returning()
      .all();

    // Build answer selections
    const questionIds = [...new Set(optionIds.map((o) => o.questionId))];
    for (let qi = 0; qi < questionIds.length; qi++) {
      const qId = questionIds[qi];
      const qOptions = optionIds.filter((o) => o.questionId === qId);
      let selectedOption: (typeof qOptions)[0];

      if (selectedCorrectIndices.includes(qi)) {
        // Pick correct answer
        selectedOption = qOptions.find((o) => o.correct)!;
      } else {
        // Pick wrong answer
        selectedOption = qOptions.find((o) => !o.correct)!;
      }

      db.insert(schema.quizAnswers)
        .values({
          attemptId: attempt.id,
          questionId: qId,
          selectedOptionId: selectedOption.optionId,
        })
        .run();
    }
  }

  // Emma — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[0].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 35);

  // Emma — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[0].id, quiz2.id, quiz2OptionIds, [0, 1], 30);

  // Emma — passed quiz 3 (2/3 correct, just barely at 67% with 70% passing = fail, then retake)
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 2], 28);
  // Retake — all correct
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 27);

  // James — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[1].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 40);

  // James — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[1].id, quiz2.id, quiz2OptionIds, [0, 1], 35);

  // Olivia — failed quiz 1 first attempt (1/3 correct), then passed on retry (3/3)
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0], 25);
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 24);

  // Olivia — passed quiz 3 (3/3 correct)
  recordQuizAttempt(students[2].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 20);

  // Sophia — failed quiz 1 (1/3 correct, hasn't retaken yet)
  recordQuizAttempt(students[4].id, quiz1.id, quiz1OptionIds, [1], 10);

  console.log(
    `Created ${countRows(schema.quizAttempts)} quiz attempts and ${countRows(schema.quizAnswers)} answers.`
  );
}
