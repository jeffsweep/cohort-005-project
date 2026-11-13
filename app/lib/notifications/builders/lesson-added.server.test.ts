import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { buildLessonAdded } from "./lesson-added.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

function addUser(name: string, role: UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role })
    .returning()
    .get();
}

function enroll(userId: number, courseId = base.course.id) {
  return db
    .insert(schema.enrollments)
    .values({ userId, courseId })
    .returning()
    .get();
}

function addModule(title = "Basics", courseId = base.course.id) {
  return db
    .insert(schema.modules)
    .values({ courseId, title, position: 1 })
    .returning()
    .get();
}

function addLesson(moduleId: number, title = "Hello") {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title, position: 1 })
    .returning()
    .get();
}

describe("lesson-added", () => {
  it("tells every enrolled Student about a new lesson, carrying the course id for batching", () => {
    const sam = addUser("Sam", UserRole.Student);
    const kim = addUser("Kim", UserRole.Student);
    enroll(sam.id);
    enroll(kim.id);
    const lesson = addLesson(addModule().id);

    expect(
      buildLessonAdded(db, {
        lessonId: lesson.id,
        actorId: base.instructor.id,
      })
    ).toEqual(
      [sam, kim].map((student) => ({
        workflow: "lesson-added",
        recipient: { id: String(student.id), name: student.name },
        dedupKey: `lesson-added:${lesson.id}`,
        data: {
          actorName: "Test Instructor",
          message: "Test Instructor added a lesson to *Test Course*",
          url: "/courses/test-course",
          courseId: base.course.id,
          courseTitle: "*Test Course*",
        },
      }))
    );
  });

  it("tells every enrolled Student about a new module, keyed by the module", () => {
    const sam = addUser("Sam", UserRole.Student);
    enroll(sam.id);
    const mod = addModule();

    expect(
      buildLessonAdded(db, { moduleId: mod.id, actorId: base.instructor.id })
    ).toEqual([
      {
        workflow: "lesson-added",
        recipient: { id: String(sam.id), name: "Sam" },
        dedupKey: `module-added:${mod.id}`,
        data: {
          actorName: "Test Instructor",
          message: "Test Instructor added a module to *Test Course*",
          url: "/courses/test-course",
          courseId: base.course.id,
          courseTitle: "*Test Course*",
        },
      },
    ]);
  });

  it("doesn't tell the Instructor who added the lesson, even when enrolled", () => {
    enroll(base.instructor.id);
    const lesson = addLesson(addModule().id);

    expect(
      buildLessonAdded(db, {
        lessonId: lesson.id,
        actorId: base.instructor.id,
      })
    ).toEqual([]);
  });

  it("only tells Students enrolled on the lesson's course", () => {
    const other = db
      .insert(schema.courses)
      .values({
        title: "Other Course",
        slug: "other-course",
        description: "Another",
        salesCopy: "Other",
        status: schema.CourseStatus.Published,
        instructorId: base.instructor.id,
        categoryId: base.course.categoryId,
      })
      .returning()
      .get();
    const sam = addUser("Sam", UserRole.Student);
    enroll(sam.id, other.id);
    const lesson = addLesson(addModule().id);

    expect(
      buildLessonAdded(db, {
        lessonId: lesson.id,
        actorId: base.instructor.id,
      })
    ).toEqual([]);
  });

  it("names Cadence when a Platform Admin adds the lesson", () => {
    const pat = addUser("Pat", UserRole.Admin);
    const sam = addUser("Sam", UserRole.Student);
    enroll(sam.id);
    const lesson = addLesson(addModule().id);

    const [send] = buildLessonAdded(db, {
      lessonId: lesson.id,
      actorId: pat.id,
    });

    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence added a lesson to *Test Course*",
      url: "/courses/test-course",
      courseId: base.course.id,
      courseTitle: "*Test Course*",
    });
  });

  it("builds an identical payload when built twice", () => {
    const sam = addUser("Sam", UserRole.Student);
    enroll(sam.id);
    const lesson = addLesson(addModule().id);
    const event = { lessonId: lesson.id, actorId: base.instructor.id };

    expect(buildLessonAdded(db, event)).toEqual(buildLessonAdded(db, event));
  });

  it("sends nothing for a lesson or module that no longer exists", () => {
    enroll(addUser("Sam", UserRole.Student).id);

    expect(
      buildLessonAdded(db, { lessonId: 999, actorId: base.instructor.id })
    ).toEqual([]);
    expect(
      buildLessonAdded(db, { moduleId: 999, actorId: base.instructor.id })
    ).toEqual([]);
  });
});
