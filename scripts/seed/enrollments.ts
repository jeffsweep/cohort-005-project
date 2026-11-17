import * as schema from "../../app/db/schema";
import { LessonProgressStatus } from "../../app/db/schema";
import { countRows, db, type Course, type User } from "./db";
import { daysAgo } from "./helpers";

// ─── Enrollments ───
// Varied enrollment patterns:
// - Emma: enrolled in both courses (nearly complete in course 1, mid-way in course 2)
// - James: enrolled in course 1 only (completed)
// - Olivia: enrolled in both courses (just started course 1, mid-way in course 2)
// - Liam: enrolled in course 2 only (just started, abandoned)
// - Sophia: enrolled in course 1 only (recently enrolled, barely started)

export function seedEnrollments(
  students: User[],
  course1: Course,
  course2: Course
) {
  db.insert(schema.enrollments)
    .values([
      { userId: students[0].id, courseId: course1.id, enrolledAt: daysAgo(50) },
      { userId: students[0].id, courseId: course2.id, enrolledAt: daysAgo(40) },
      {
        userId: students[1].id,
        courseId: course1.id,
        enrolledAt: daysAgo(45),
        completedAt: daysAgo(10),
      },
      { userId: students[2].id, courseId: course1.id, enrolledAt: daysAgo(35) },
      { userId: students[2].id, courseId: course2.id, enrolledAt: daysAgo(30) },
      { userId: students[3].id, courseId: course2.id, enrolledAt: daysAgo(25) },
      { userId: students[4].id, courseId: course1.id, enrolledAt: daysAgo(15) },
    ])
    .run();

  console.log(`Created ${countRows(schema.enrollments)} enrollments.`);
}

// ─── Lesson Progress ───

export function seedLessonProgress(
  students: User[],
  course1LessonIds: number[],
  course2LessonIds: number[]
) {
  // Helper to mark lessons as complete
  function markComplete(
    userId: number,
    lessonId: number,
    daysAgoCompleted: number
  ) {
    db.insert(schema.lessonProgress)
      .values({
        userId,
        lessonId,
        status: LessonProgressStatus.Completed,
        completedAt: daysAgo(daysAgoCompleted),
      })
      .run();
  }

  function markInProgress(userId: number, lessonId: number) {
    db.insert(schema.lessonProgress)
      .values({
        userId,
        lessonId,
        status: LessonProgressStatus.InProgress,
      })
      .run();
  }

  // Emma (students[0]) — nearly complete in course 1 (17 of 19 lessons done)
  for (let i = 0; i < 17; i++) {
    markComplete(students[0].id, course1LessonIds[i], 50 - i);
  }
  markInProgress(students[0].id, course1LessonIds[17]);

  // Emma — mid-way through course 2 (10 of 20 lessons done)
  for (let i = 0; i < 10; i++) {
    markComplete(students[0].id, course2LessonIds[i], 40 - i);
  }
  markInProgress(students[0].id, course2LessonIds[10]);

  // James (students[1]) — completed all of course 1
  for (let i = 0; i < course1LessonIds.length; i++) {
    markComplete(students[1].id, course1LessonIds[i], 45 - i);
  }

  // Olivia (students[2]) — just started course 1 (3 lessons done)
  for (let i = 0; i < 3; i++) {
    markComplete(students[2].id, course1LessonIds[i], 30 - i);
  }
  markInProgress(students[2].id, course1LessonIds[3]);

  // Olivia — mid-way through course 2 (8 lessons done)
  for (let i = 0; i < 8; i++) {
    markComplete(students[2].id, course2LessonIds[i], 28 - i);
  }

  // Liam (students[3]) — just started course 2, abandoned (2 lessons done)
  for (let i = 0; i < 2; i++) {
    markComplete(students[3].id, course2LessonIds[i], 22 - i);
  }

  // Sophia (students[4]) — barely started course 1 (1 lesson done)
  markComplete(students[4].id, course1LessonIds[0], 12);
  markInProgress(students[4].id, course1LessonIds[1]);

  console.log(
    `Created ${countRows(schema.lessonProgress)} lesson progress records.`
  );
}
