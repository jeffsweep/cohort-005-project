import { describe, it, expect, beforeEach } from "vitest";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { createInstructorAnalytics } from "../index.server";
import {
  DAY_MS,
  NOW,
  addCourse,
  addLesson,
  addModule,
  addUser,
  admin,
  analytics,
  asAdmin,
  asInstructor,
  buy,
  comment,
  course,
  db,
  instructor,
  otherCourse,
  otherInstructor,
  progress,
  useAnalyticsTestDb,
} from "./fixtures";

useAnalyticsTestDb();

describe("who sees what", () => {
  it("pins an instructor to their own figures, whatever the URL says", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asInstructor({ instructor: String(otherInstructor.id) });

    expect(result.instructorId).toBe(instructor.id);
    expect(result.summary.grossCents).toBe(1000);
  });

  it("shows an admin every instructor's figures when none is picked", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asAdmin();

    expect(result.instructorId).toBeNull();
    expect(result.summary.grossCents).toBe(6000);
  });

  it("narrows an admin to the instructor they pick", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asAdmin({ instructor: String(otherInstructor.id) });

    expect(result.instructorId).toBe(otherInstructor.id);
    expect(result.summary.grossCents).toBe(5000);
  });

  it("treats a junk instructor param from an admin as platform-wide", () => {
    expect(asAdmin({ instructor: "-3" }).instructorId).toBeNull();
    expect(asAdmin({ instructor: "1.5" }).instructorId).toBeNull();
    expect(asAdmin({ instructor: "bob" }).instructorId).toBeNull();
  });

  it("lists course owners, by name, in the admin's instructor picker", () => {
    // An admin who owns a course is an owner too; an instructor with no
    // courses is not.
    addCourse(admin.id, "Admin's Course");
    addUser("Idle Instructor", UserRole.Instructor);

    expect(asAdmin().instructors).toEqual([
      { id: otherInstructor.id, name: "Olive Other" },
      { id: admin.id, name: "Pat Admin" },
      { id: instructor.id, name: "Test Instructor" },
    ]);
  });

  it("gives an instructor no instructor picker", () => {
    expect(asInstructor().instructors).toEqual([]);
  });

  it("flags itself as an admin view only for admins", () => {
    expect(asAdmin().isAdmin).toBe(true);
    expect(asInstructor().isAdmin).toBe(false);
  });
});

describe("search params", () => {
  it("falls back to the defaults when params are missing", () => {
    const result = asInstructor();

    expect(result.range).toBe("30d");
    expect(result.tab).toBe("overview");
    expect(result.selectedCourseId).toBeNull();
  });

  it("falls back to the defaults when params are junk", () => {
    const result = asInstructor({
      range: "forever",
      tab: "settings",
      course: "abc",
    });

    expect(result.range).toBe("30d");
    expect(result.tab).toBe("overview");
    expect(result.selectedCourseId).toBeNull();
  });

  it("reads a valid range and the course tab", () => {
    const result = asInstructor({ range: "90d", tab: "course" });

    expect(result.range).toBe("90d");
    expect(result.tab).toBe("course");
  });
});

describe("the course picker", () => {
  it("offers every course the viewer owns, sold or not, by title", () => {
    const zebra = addCourse(instructor.id, "Zebra Course", CourseStatus.Draft);
    const alpha = addCourse(instructor.id, "Alpha Course");

    expect(asInstructor().courseOptions).toEqual([
      { courseId: alpha.id, title: "Alpha Course" },
      { courseId: course.id, title: "Test Course" },
      { courseId: zebra.id, title: "Zebra Course" },
    ]);
  });

  it("selects a course the viewer owns", () => {
    const result = asInstructor({ tab: "course", course: String(course.id) });

    expect(result.selectedCourseId).toBe(course.id);
    expect(result.progress).not.toBeNull();
    expect(result.funnel).not.toBeNull();
    expect(result.quizzes).not.toBeNull();
    expect(result.countries).not.toBeNull();
  });

  it("refuses another instructor's course and hides every course panel", () => {
    const result = asInstructor({ course: String(otherCourse.id) });

    expect(result.selectedCourseId).toBeNull();
    expect(result.progress).toBeNull();
    expect(result.funnel).toBeNull();
    expect(result.quizzes).toBeNull();
    expect(result.countries).toBeNull();
  });

  it("refuses a course id that doesn't exist", () => {
    expect(asInstructor({ course: "9999" }).selectedCourseId).toBeNull();
  });

  it("lets an admin pick any course when viewing platform-wide", () => {
    expect(asAdmin({ course: String(otherCourse.id) }).selectedCourseId).toBe(
      otherCourse.id
    );
  });
});

describe("revenue summary", () => {
  it("splits gross into the platform fee and the instructor's net", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 7900);
    buy(student.id, course.id, 2100);

    expect(asInstructor().summary).toEqual({
      grossCents: 10000,
      feeCents: 2000,
      netCents: 8000,
      purchaseCount: 2,
    });
  });

  it("is all zeroes with no sales", () => {
    expect(asInstructor().summary).toEqual({
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
      purchaseCount: 0,
    });
  });

  it("only counts purchases inside the range", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000, { daysBack: 29 });
    buy(student.id, course.id, 2000, { daysBack: 31 });
    buy(student.id, course.id, 4000, { daysBack: 400 });

    expect(asInstructor({ range: "30d" }).summary.grossCents).toBe(1000);
    expect(asInstructor({ range: "90d" }).summary.grossCents).toBe(3000);
    expect(asInstructor({ range: "all" }).summary.grossCents).toBe(7000);
  });

  it("includes a purchase landing exactly on the start of the range", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000, { daysBack: 7 });

    expect(asInstructor({ range: "7d" }).summary.grossCents).toBe(1000);
  });

  it("rounds the fee and still adds up", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 999);

    expect(asInstructor().summary).toMatchObject({
      grossCents: 999,
      feeCents: 200,
      netCents: 799,
    });
  });
});

describe("revenue by course", () => {
  it("lists courses biggest earner first, leaving out unsold ones", () => {
    const small = addCourse(instructor.id, "Small Earner");
    addCourse(instructor.id, "Never Sold");
    const student = addUser("Sam Student");
    buy(student.id, small.id, 500);
    buy(student.id, course.id, 3000);
    buy(student.id, course.id, 2000);

    expect(asInstructor().courses).toEqual([
      {
        courseId: course.id,
        title: "Test Course",
        grossCents: 5000,
        feeCents: 1000,
        netCents: 4000,
        purchaseCount: 2,
      },
      {
        courseId: small.id,
        title: "Small Earner",
        grossCents: 500,
        feeCents: 100,
        netCents: 400,
        purchaseCount: 1,
      },
    ]);
  });
});

describe("unanswered questions", () => {
  let lessonId: number;
  let student: typeof schema.users.$inferSelect;

  beforeEach(() => {
    const module = addModule(course.id, "Basics", 1);
    lessonId = addLesson(module.id, "Lesson 1", 1).id;
    student = addUser("Sam Student");
  });

  it("counts a student's question nobody has answered", () => {
    comment(lessonId, student.id);

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("does not count a question the course's instructor answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, instructor.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count a question an admin answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, admin.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("still counts a question only another student answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, addUser("Helpful Peer").id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("still counts a question answered by an instructor of a different course", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, otherInstructor.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("still counts a question whose staff reply was deleted", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, instructor.id, { parentId: question.id, deleted: true });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("does not count a deleted question", () => {
    comment(lessonId, student.id, { deleted: true });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count questions staff asked", () => {
    comment(lessonId, instructor.id);
    comment(lessonId, admin.id);

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count replies as questions", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, addUser("Helpful Peer").id, { parentId: question.id });
    comment(lessonId, student.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("reports questions older than the range rather than dropping them", () => {
    comment(lessonId, student.id, { daysBack: 2 });
    comment(lessonId, student.id, { daysBack: 100 });

    expect(asInstructor({ range: "30d" }).questions).toEqual({
      inRange: 1,
      older: 1,
    });
    expect(asInstructor({ range: "all" }).questions).toEqual({
      inRange: 2,
      older: 0,
    });
  });

  it("ignores questions on another instructor's courses", () => {
    const otherModule = addModule(otherCourse.id, "Elsewhere", 1);
    comment(addLesson(otherModule.id, "Their lesson", 1).id, student.id);

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
    expect(asAdmin().questions).toEqual({ inRange: 1, older: 0 });
  });
});

describe("refund exposure", () => {
  it("adds up purchases still inside their refund window", () => {
    const secondCourse = addCourse(instructor.id, "Second Course");
    const student = addUser("Sam Student");
    buy(student.id, course.id, 10000, { daysBack: 3 });
    buy(student.id, course.id, 5000, { daysBack: 14 });
    buy(student.id, course.id, 4000, { daysBack: 15 });
    buy(student.id, secondCourse.id, 2000, { daysBack: 1 });

    expect(asInstructor({ range: "30d" }).refundExposure).toEqual({
      grossCents: 17000,
      netCents: 13600,
      purchaseCount: 3,
      sharePercent: 81,
      closingTodayCount: 1,
      courses: [
        {
          courseId: course.id,
          title: "Test Course",
          grossCents: 15000,
          purchaseCount: 2,
          daysLeft: 0,
        },
        {
          courseId: secondCourse.id,
          title: "Second Course",
          grossCents: 2000,
          purchaseCount: 1,
          daysLeft: 13,
        },
      ],
    });
  });

  it("keeps the fourteenth day open and closes the fifteenth", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000, { daysBack: 14 });
    buy(student.id, course.id, 2000, { daysBack: 15 });

    expect(asInstructor().refundExposure).toMatchObject({
      grossCents: 1000,
      closingTodayCount: 1,
    });
  });

  it("counts days left from today, with a purchase made today having fourteen", () => {
    buy(addUser("Sam Student").id, course.id, 1000, { daysBack: 0 });

    expect(asInstructor().refundExposure.courses[0].daysLeft).toBe(14);
  });

  it("only looks at purchases inside the selected range", () => {
    buy(addUser("Sam Student").id, course.id, 1000, { daysBack: 10 });

    expect(asInstructor({ range: "7d" }).refundExposure.grossCents).toBe(0);
    expect(asInstructor({ range: "30d" }).refundExposure.grossCents).toBe(1000);
  });

  it("is empty with no sales", () => {
    expect(asInstructor().refundExposure).toEqual({
      grossCents: 0,
      netCents: 0,
      purchaseCount: 0,
      sharePercent: 0,
      closingTodayCount: 0,
      courses: [],
    });
  });

  it("moves with the clock it is given", () => {
    buy(addUser("Sam Student").id, course.id, 1000, { daysBack: 3 });
    const aWeekLater = new Date(NOW.getTime() + 7 * DAY_MS);
    const twelveDaysLater = new Date(NOW.getTime() + 12 * DAY_MS);
    const viewer = { userId: instructor.id, isAdmin: false };
    const params = new URLSearchParams();

    expect(
      createInstructorAnalytics(db).get(viewer, params, aWeekLater)
        .refundExposure.courses[0].daysLeft
    ).toBe(4);
    expect(
      createInstructorAnalytics(db).get(viewer, params, twelveDaysLater)
        .refundExposure.grossCents
    ).toBe(0);
  });
});

describe("the publish-your-first-course prompt", () => {
  it("shows for an instructor with nothing published", () => {
    const newcomer = addUser("New Instructor", UserRole.Instructor);
    addCourse(newcomer.id, "Work in progress", CourseStatus.Draft);

    expect(analytics({ userId: newcomer.id, isAdmin: false }).unpublished).toBe(
      true
    );
  });

  it("hides once the instructor has published a course", () => {
    expect(asInstructor().unpublished).toBe(false);
  });

  it("never shows on the platform-wide view", () => {
    expect(asAdmin().unpublished).toBe(false);
  });
});
