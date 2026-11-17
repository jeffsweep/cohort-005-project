import { describe, it, expect, vi } from "vitest";
import { and } from "drizzle-orm";
import * as schema from "~/db/schema";
import { LessonProgressStatus, UserRole } from "~/db/schema";
import {
  approveRefundRequest,
  checkRefundRequest,
  declineRefundRequest,
  getRefundOffer,
  raiseRefundRequest,
} from "./refunds.server";
import {
  NOW,
  addStudent,
  base,
  buyForSelf,
  buySeats,
  claimSeat,
  db,
  lessonIds,
  notifications,
  platformAdmin,
  raise,
  useRefundsTestDb,
} from "./refunds.fixtures.server";

useRefundsTestDb();

describe("raising a Refund Request", () => {
  it("lets the buyer raise one on an Individual Purchase inside the window", async () => {
    const purchase = buyForSelf(base.user.id);

    const result = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Nope.",
      NOW,
      notifications
    );

    expect(result).toMatchObject({ ok: true, kind: "individual_purchase" });
  });

  it("refuses anyone but the buyer", () => {
    const purchase = buyForSelf(base.user.id);
    const someoneElse = addStudent("Ben");

    expect(
      checkRefundRequest(db, purchase.id, someoneElse.id, NOW)
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("allows only one Open Refund Request per Purchase", async () => {
    const purchase = buyForSelf(base.user.id);
    await raise(purchase.id, base.user.id);

    expect(
      checkRefundRequest(db, purchase.id, base.user.id, NOW)
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("keeps the fourteenth day open and closes the fifteenth", () => {
    const onDay14 = buyForSelf(base.user.id, 14);
    const onDay15 = buyForSelf(addStudent("Ben").id, 15);

    expect(checkRefundRequest(db, onDay14.id, onDay14.userId, NOW).ok).toBe(
      true
    );
    expect(
      checkRefundRequest(db, onDay15.id, onDay15.userId, NOW)
    ).toMatchObject({ ok: false, error: "The 14-day window has closed." });
  });

  it("refuses a buyer who has completed half the lessons", () => {
    const purchase = buyForSelf(base.user.id);
    db.insert(schema.lessonProgress)
      .values(
        lessonIds.slice(0, 2).map((lessonId) => ({
          userId: base.user.id,
          lessonId,
          status: LessonProgressStatus.Completed,
        }))
      )
      .run();

    expect(
      checkRefundRequest(db, purchase.id, base.user.id, NOW)
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a buyer who has watched two hours", () => {
    const purchase = buyForSelf(base.user.id);
    db.insert(schema.videoWatchEvents)
      .values([
        {
          userId: base.user.id,
          lessonId: lessonIds[0],
          eventType: "progress",
          positionSeconds: 3600,
        },
        {
          userId: base.user.id,
          lessonId: lessonIds[1],
          eventType: "progress",
          positionSeconds: 3600,
        },
      ])
      .run();

    expect(
      checkRefundRequest(db, purchase.id, base.user.id, NOW)
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses a Team Licence with a Claimed Seat", () => {
    const teamAdmin = addStudent("Priya");
    const { purchase, seats } = buySeats(teamAdmin.id, 3);
    claimSeat(seats[0].id, addStudent("Ben").id);

    expect(
      checkRefundRequest(db, purchase.id, teamAdmin.id, NOW)
    ).toMatchObject({
      ok: false,
      status: 403,
    });
  });
});

describe("the refund offer on the course page", () => {
  it("offers the newest Individual Purchase, not a newer Team Licence", () => {
    const individual = buyForSelf(base.user.id, 3);
    buySeats(base.user.id, 5, 1);

    expect(getRefundOffer(db, base.user.id, base.course.id, NOW)).toMatchObject(
      {
        purchaseId: individual.id,
        amount: 7900,
      }
    );
  });

  it("offers nothing once the purchase has been refunded", async () => {
    const purchase = buyForSelf(base.user.id);
    const id = await raise(purchase.id, base.user.id);
    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );

    expect(getRefundOffer(db, base.user.id, base.course.id, NOW)).toBeNull();
  });
});

describe("the Refund Request Notifications", () => {
  const testUser = {
    name: "Test User",
    email: "test@example.com",
    avatarUrl: null,
  };

  function sentOf(kind: string) {
    return notifications.sent.filter((n) => n.kind === kind);
  }

  it("confirms the Refund Request to the buyer", async () => {
    const purchase = buyForSelf(base.user.id, 3, 7900);

    const id = await raise(purchase.id, base.user.id);

    expect(sentOf("refund-requested")).toEqual([
      {
        kind: "refund-requested",
        idempotencyKey: `refund-requested:${id}`,
        recipient: { id: base.user.id, ...testUser },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          amount: "$79.00",
        },
      },
    ]);
  });

  it("tells every Platform Admin, and nobody else, about the Open Refund Request", async () => {
    const sam = db
      .insert(schema.users)
      .values({
        name: "Sam Admin",
        email: "sam@example.com",
        role: UserRole.Admin,
      })
      .returning()
      .get();
    const purchase = buyForSelf(base.user.id, 3, 7900);

    const id = await raise(purchase.id, base.user.id);

    const open = sentOf("refund-request-open");
    expect(open.map((n) => n.recipient.id).sort()).toEqual(
      [platformAdmin.id, sam.id].sort()
    );
    expect(open[0]).toEqual({
      kind: "refund-request-open",
      idempotencyKey: `refund-request-open:${id}`,
      recipient: {
        id: platformAdmin.id,
        name: "Pat Admin",
        email: "pat@example.com",
        avatarUrl: null,
      },
      actor: { id: base.user.id, ...testUser },
      data: {
        refundRequestId: id,
        buyerName: "Test User",
        courseTitle: "Test Course",
        amount: "$79.00",
        reason: "It was not what I expected.",
        url: "/admin/refunds",
      },
    });
  });

  it("tells the buyer their Individual Purchase refund was approved", async () => {
    const purchase = buyForSelf(base.user.id, 3, 7900);
    const id = await raise(purchase.id, base.user.id);

    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      "Sorry it didn't work out.",
      NOW,
      notifications
    );

    expect(sentOf("refund-approved")).toEqual([
      {
        kind: "refund-approved",
        idempotencyKey: `refund-approved:${id}`,
        recipient: { id: base.user.id, ...testUser },
        actor: {
          id: platformAdmin.id,
          name: "Pat Admin",
          email: "pat@example.com",
          avatarUrl: null,
        },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          purchaseKind: "individual_purchase",
          amount: "$79.00",
          decisionNote: "Sorry it didn't work out.",
          url: "/settings",
        },
      },
    ]);
  });

  it("tells a Team Admin their Team Licence refund was declined", async () => {
    const priya = addStudent("Priya");
    const { purchase } = buySeats(priya.id, 2);
    const id = await raise(purchase.id, priya.id);

    await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "  Seats are in use.  ",
      NOW,
      notifications
    );

    expect(sentOf("refund-declined")).toEqual([
      {
        kind: "refund-declined",
        idempotencyKey: `refund-declined:${id}`,
        recipient: {
          id: priya.id,
          name: "Priya",
          email: "priya@example.com",
          avatarUrl: null,
        },
        actor: {
          id: platformAdmin.id,
          name: "Pat Admin",
          email: "pat@example.com",
          avatarUrl: null,
        },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          purchaseKind: "team_licence",
          amount: "$158.00",
          decisionNote: "Seats are in use.",
          url: "/team",
        },
      },
    ]);
    expect(sentOf("refund-approved")).toEqual([]);
  });

  it("tells a Team Admin their Team Licence refund was approved, with no note", async () => {
    const priya = addStudent("Priya");
    const { purchase } = buySeats(priya.id, 2);
    const id = await raise(purchase.id, priya.id);

    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );

    expect(sentOf("refund-approved")).toMatchObject([
      {
        idempotencyKey: `refund-approved:${id}`,
        recipient: { id: priya.id },
        data: {
          purchaseKind: "team_licence",
          decisionNote: null,
          url: "/team",
        },
      },
    ]);
  });

  it("still raises and decides Refund Requests, with their emails, when Knock is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    notifications.failWith(new Error("Knock is down"));
    const purchase = buyForSelf(base.user.id);

    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Nope.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const declined = await declineRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      "No.",
      NOW,
      notifications
    );

    expect(raised.email.to).toBe("test@example.com");
    expect(declined).toMatchObject({
      ok: true,
      email: { to: "test@example.com" },
    });
    for (const key of [
      "refund-requested:",
      "refund-request-open:",
      "refund-declined:",
    ]) {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(key),
        "Knock is down"
      );
    }
    error.mockRestore();
  });

  it("sends nothing when a decision is refused", async () => {
    const purchase = buyForSelf(base.user.id);
    const id = await raise(purchase.id, base.user.id);
    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );
    notifications.sent.length = 0;

    await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "Too late.",
      NOW,
      notifications
    );

    expect(notifications.sent).toEqual([]);
  });
});
