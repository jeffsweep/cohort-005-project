import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { buildCommentPosted } from "./discussion.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lesson: { id: number };
let lessonUrl: string;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lesson = db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Generics", position: 1 })
    .returning()
    .get();
  lessonUrl = `/courses/test-course/lessons/${lesson.id}`;
});

function addUser(name: string, role: UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role })
    .returning()
    .get();
}

function post(userId: number, parentId: number | null = null) {
  return db
    .insert(schema.comments)
    .values({ userId, lessonId: lesson.id, parentId, body: "Hello" })
    .returning()
    .get();
}

function build(commentId: number) {
  return buildCommentPosted(db, { commentId });
}

describe("question-asked", () => {
  it("tells the course's Instructor that a Student posted, linking to the post", () => {
    const sam = addUser("Sam", UserRole.Student);
    const question = post(sam.id);

    expect(build(question.id)).toEqual([
      {
        workflow: "question-asked",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `question-asked:${question.id}`,
        data: {
          actorName: "Sam",
          message: "Sam posted in the discussion on *Generics*",
          url: `${lessonUrl}#comment-${question.id}`,
        },
      },
    ]);
  });

  it("sends nothing when the Instructor posts on their own course", () => {
    expect(build(post(base.instructor.id).id)).toEqual([]);
  });

  it("sends nothing when a Platform Admin posts, because only Students ask Discussion Questions", () => {
    const pat = addUser("Pat", UserRole.Admin);

    expect(build(post(pat.id).id)).toEqual([]);
  });

  it("builds an identical payload when built twice", () => {
    const question = post(base.user.id);

    expect(build(question.id)).toEqual(build(question.id));
  });

  it("sends nothing for a comment that no longer exists", () => {
    expect(build(999)).toEqual([]);
  });
});

describe("question-answered", () => {
  it("tells the Student when the Instructor first replies to their Discussion Question, linking to the reply", () => {
    const sam = addUser("Sam", UserRole.Student);
    const question = post(sam.id);
    const reply = post(base.instructor.id, question.id);

    expect(build(reply.id)).toEqual([
      {
        workflow: "question-answered",
        recipient: { id: String(sam.id), name: "Sam" },
        dedupKey: `question-answered:${question.id}`,
        data: {
          actorName: "Test Instructor",
          message: "Test Instructor replied to your post on *Generics*",
          url: `${lessonUrl}#comment-${reply.id}`,
        },
      },
    ]);
  });

  it("names Cadence when a Platform Admin answers", () => {
    const pat = addUser("Pat", UserRole.Admin);
    const question = post(base.user.id);
    const reply = post(pat.id, question.id);

    const [send] = build(reply.id);

    expect(send.workflow).toBe("question-answered");
    expect(send.data).toEqual({
      actorName: null,
      message: "Cadence replied to your post on *Generics*",
      url: `${lessonUrl}#comment-${reply.id}`,
    });
  });

  it("only sends for the first staff reply; a later staff reply is a comment-replied", () => {
    const pat = addUser("Pat", UserRole.Admin);
    const question = post(base.user.id);
    post(base.instructor.id, question.id);
    const second = post(pat.id, question.id);

    expect(build(second.id)).toEqual([
      {
        workflow: "comment-replied",
        recipient: { id: String(base.user.id), name: "Test User" },
        dedupKey: `comment-replied:${second.id}`,
        data: {
          actorName: null,
          message: "Cadence replied to your comment on *Generics*",
          url: `${lessonUrl}#comment-${second.id}`,
        },
      },
    ]);
  });

  it("still sends for the first staff reply after other Students have replied", () => {
    const sam = addUser("Sam", UserRole.Student);
    const question = post(base.user.id);
    post(sam.id, question.id);
    const reply = post(base.instructor.id, question.id);

    expect(build(reply.id).map((send) => send.workflow)).toEqual([
      "question-answered",
    ]);
  });

  it("does not count a reply from another course's Instructor as staff", () => {
    const alex = addUser("Alex", UserRole.Instructor);
    const question = post(base.user.id);
    const reply = post(alex.id, question.id);

    expect(build(reply.id).map((send) => send.workflow)).toEqual([
      "comment-replied",
    ]);
  });
});

describe("comment-replied", () => {
  it("tells a comment's author when someone replies, linking to the reply", () => {
    const sam = addUser("Sam", UserRole.Student);
    const question = post(base.user.id);
    const reply = post(sam.id, question.id);

    expect(build(reply.id)).toEqual([
      {
        workflow: "comment-replied",
        recipient: { id: String(base.user.id), name: "Test User" },
        dedupKey: `comment-replied:${reply.id}`,
        data: {
          actorName: "Sam",
          message: "Sam replied to your comment on *Generics*",
          url: `${lessonUrl}#comment-${reply.id}`,
        },
      },
    ]);
  });

  it("tells the Instructor when a Student replies to the Instructor's comment", () => {
    const announcement = post(base.instructor.id);
    const reply = post(base.user.id, announcement.id);

    expect(build(reply.id).map((send) => [send.workflow, send.recipient.id])).toEqual([
      ["comment-replied", String(base.instructor.id)],
    ]);
  });

  it("sends nothing when someone replies to their own comment", () => {
    const question = post(base.user.id);
    const reply = post(base.user.id, question.id);

    expect(build(reply.id)).toEqual([]);
  });

  it("sends nothing when the Instructor replies to their own comment", () => {
    const announcement = post(base.instructor.id);
    const reply = post(base.instructor.id, announcement.id);

    expect(build(reply.id)).toEqual([]);
  });

  it("builds an identical payload when built twice", () => {
    const question = post(base.user.id);
    const reply = post(base.instructor.id, question.id);
    const later = post(base.instructor.id, question.id);

    expect(build(reply.id)).toEqual(build(reply.id));
    expect(build(later.id)).toEqual(build(later.id));
  });
});
