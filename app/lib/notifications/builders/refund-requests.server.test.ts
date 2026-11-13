import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  approveRefundRequest,
  declineRefundRequest,
  raiseRefundRequest,
} from "~/lib/refunds.server";
import { buildRefundApprovedInstructor } from "./refund-approved-instructor.server";
import {
  buildRefundApproved,
  buildRefundDeclined,
} from "./refund-request.server";
import {
  buildRefundRequested,
  refundRequestedWithdrawal,
} from "./refund-requested.server";
import type { Send } from "../send";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let pat: typeof schema.users.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  pat = addUser("Pat", UserRole.Admin);
});

function addUser(name: string, role: UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.toLowerCase()}@example.com`, role })
    .returning()
    .get();
}

function buyForSelf(userId: number) {
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId,
      courseId: base.course.id,
      amountPaid: 7900,
      createdAt: NOW.toISOString(),
    })
    .returning()
    .get();
  db.insert(schema.enrollments)
    .values({ userId, courseId: base.course.id })
    .run();
  return purchase;
}

function buySeats(userId: number, seats: number) {
  const team = db.insert(schema.teams).values({}).returning().get();
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId,
      courseId: base.course.id,
      amountPaid: 7900 * seats,
      createdAt: NOW.toISOString(),
    })
    .returning()
    .get();
  for (let i = 0; i < seats; i++) {
    db.insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId: base.course.id,
        code: `SEAT-${purchase.id}-${i}`,
        purchaseId: purchase.id,
      })
      .run();
  }
  return purchase;
}

function raise(purchaseId: number, buyerId: number) {
  const result = raiseRefundRequest(
    db,
    purchaseId,
    buyerId,
    "It was not what I expected.",
    NOW
  );
  if (!result.ok) throw new Error(result.error);
  return result.refundRequestId;
}

function approve(refundRequestId: number, adminId = pat.id) {
  const result = approveRefundRequest(db, refundRequestId, adminId, null, NOW);
  if (!result.ok) throw new Error(result.error);
}

function decline(refundRequestId: number, adminId = pat.id) {
  const result = declineRefundRequest(
    db,
    refundRequestId,
    adminId,
    "Past half way.",
    NOW
  );
  if (!result.ok) throw new Error(result.error);
}

describe("refund-requested", () => {
  it("tells every Platform Admin that a buyer asked for a refund, linking to that request", () => {
    const kim = addUser("Kim", UserRole.Admin);
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);

    expect(buildRefundRequested(db, { refundRequestId: id })).toEqual(
      [pat, kim].map((admin) => ({
        workflow: "refund-requested",
        recipient: { id: String(admin.id), name: admin.name },
        dedupKey: `refund-requested:${id}`,
        data: {
          actorName: "Sam",
          message: "Sam asked for a refund on *Test Course*",
          url: `/admin/refunds?request=${id}`,
          refundRequestId: id,
        },
      }))
    );
  });

  it("does not tell a Platform Admin about their own Refund Request, and names them Cadence to the others", () => {
    const kim = addUser("Kim", UserRole.Admin);
    const id = raise(buyForSelf(kim.id).id, kim.id);

    const sends = buildRefundRequested(db, { refundRequestId: id });

    expect(sends.map((send) => send.recipient.id)).toEqual([String(pat.id)]);
    expect(sends[0].data.actorName).toBeNull();
    expect(sends[0].data.message).toBe(
      "Cadence asked for a refund on *Test Course*"
    );
  });

  it("builds an identical payload when built twice", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);

    expect(buildRefundRequested(db, { refundRequestId: id })).toEqual(
      buildRefundRequested(db, { refundRequestId: id })
    );
  });

  it("sends nothing for a Refund Request that does not exist", () => {
    expect(buildRefundRequested(db, { refundRequestId: 999 })).toEqual([]);
  });

  it("is withdrawn from every Platform Admin by its own workflow and Refund Request", () => {
    addUser("Kim", UserRole.Admin);
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    const other = raise(buyForSelf(base.user.id).id, base.user.id);

    const withdrawal = refundRequestedWithdrawal(id);

    expect(withdrawal).toEqual({
      workflow: "refund-requested",
      triggerData: { refundRequestId: id },
    });
    const matches = (send: Send) =>
      send.workflow === withdrawal.workflow &&
      Object.entries(withdrawal.triggerData).every(
        ([key, value]) => send.data[key as keyof Send["data"]] === value
      );
    expect(
      buildRefundRequested(db, { refundRequestId: id }).every(matches)
    ).toBe(true);
    expect(
      buildRefundRequested(db, { refundRequestId: other }).some(matches)
    ).toBe(false);
  });
});

describe("refund-approved", () => {
  it("tells the buyer of an Individual Purchase, linking to their settings", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    approve(id);

    expect(buildRefundApproved(db, { refundRequestId: id })).toEqual([
      {
        workflow: "refund-approved",
        recipient: { id: String(sam.id), name: "Sam" },
        dedupKey: `refund-approved:${id}`,
        data: {
          actorName: null,
          message: "Your Refund Request for *Test Course* was approved",
          url: "/settings",
        },
      },
    ]);
  });

  it("links the buyer of a Team Licence to their team page", () => {
    const jo = addUser("Jo", UserRole.Student);
    const id = raise(buySeats(jo.id, 3).id, jo.id);
    approve(id);

    const [send] = buildRefundApproved(db, { refundRequestId: id });

    expect(send.data.url).toBe("/team");
  });

  it("sends nothing while the Refund Request is still open, or once it was declined", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);

    expect(buildRefundApproved(db, { refundRequestId: id })).toEqual([]);

    decline(id);

    expect(buildRefundApproved(db, { refundRequestId: id })).toEqual([]);
  });

  it("sends nothing when a Platform Admin approves their own Refund Request", () => {
    const id = raise(buyForSelf(pat.id).id, pat.id);
    approve(id, pat.id);

    expect(buildRefundApproved(db, { refundRequestId: id })).toEqual([]);
  });

  it("builds an identical payload when built twice", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    approve(id);

    expect(buildRefundApproved(db, { refundRequestId: id })).toEqual(
      buildRefundApproved(db, { refundRequestId: id })
    );
  });
});

describe("refund-declined", () => {
  it("tells the buyer, linking to their settings or their team page", () => {
    const sam = addUser("Sam", UserRole.Student);
    const samsRequest = raise(buyForSelf(sam.id).id, sam.id);
    const jo = addUser("Jo", UserRole.Student);
    const josRequest = raise(buySeats(jo.id, 3).id, jo.id);
    decline(samsRequest);
    decline(josRequest);

    expect(buildRefundDeclined(db, { refundRequestId: samsRequest })).toEqual([
      {
        workflow: "refund-declined",
        recipient: { id: String(sam.id), name: "Sam" },
        dedupKey: `refund-declined:${samsRequest}`,
        data: {
          actorName: null,
          message: "Your Refund Request for *Test Course* was declined",
          url: "/settings",
        },
      },
    ]);
    expect(
      buildRefundDeclined(db, { refundRequestId: josRequest })[0].data.url
    ).toBe("/team");
  });

  it("sends nothing for an approved Refund Request", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    approve(id);

    expect(buildRefundDeclined(db, { refundRequestId: id })).toEqual([]);
  });
});

describe("refund-approved-instructor", () => {
  it("tells the Instructor that Cadence refunded an Individual Purchase", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    approve(id);

    expect(buildRefundApprovedInstructor(db, { refundRequestId: id })).toEqual([
      {
        workflow: "refund-approved-instructor",
        recipient: { id: String(base.instructor.id), name: "Test Instructor" },
        dedupKey: `refund-approved-instructor:${id}`,
        data: {
          actorName: null,
          message: "Cadence refunded Sam's purchase of *Test Course*",
          url: `/instructor/${base.course.id}/students`,
        },
      },
    ]);
  });

  it("says how many Unclaimed Seats a refunded Team Licence voided", () => {
    const jo = addUser("Jo", UserRole.Student);
    const id = raise(buySeats(jo.id, 7).id, jo.id);
    approve(id);

    const [send] = buildRefundApprovedInstructor(db, { refundRequestId: id });

    expect(send.data.message).toBe(
      "Cadence refunded Jo's Team Licence on *Test Course*; 7 Unclaimed Seats voided"
    );
  });

  it("says Seat, not Seats, when one was voided", () => {
    const jo = addUser("Jo", UserRole.Student);
    const id = raise(buySeats(jo.id, 1).id, jo.id);
    approve(id);

    const [send] = buildRefundApprovedInstructor(db, { refundRequestId: id });

    expect(send.data.message).toBe(
      "Cadence refunded Jo's Team Licence on *Test Course*; 1 Unclaimed Seat voided"
    );
  });

  it("sends nothing for a declined Refund Request", () => {
    const sam = addUser("Sam", UserRole.Student);
    const id = raise(buyForSelf(sam.id).id, sam.id);
    decline(id);

    expect(buildRefundApprovedInstructor(db, { refundRequestId: id })).toEqual(
      []
    );
  });

  it("builds an identical payload when built twice", () => {
    const jo = addUser("Jo", UserRole.Student);
    const id = raise(buySeats(jo.id, 3).id, jo.id);
    approve(id);

    expect(buildRefundApprovedInstructor(db, { refundRequestId: id })).toEqual(
      buildRefundApprovedInstructor(db, { refundRequestId: id })
    );
  });
});
