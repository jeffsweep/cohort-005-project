import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { getNewestIndividualPurchase } from "./refund-purchases.server";
import {
  addStudent,
  base,
  buyForSelf,
  buySeats,
  daysBefore,
  db,
  useRefundsTestDb,
} from "./refunds.fixtures.server";

useRefundsTestDb();

describe("the newest Individual Purchase of a course", () => {
  it("is the Individual Purchase, not a newer Team Licence", () => {
    const individual = buyForSelf(base.user.id, 3);
    buySeats(base.user.id, 5, 1);

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)?.id
    ).toBe(individual.id);
  });

  it("is the newest of several Individual Purchases", () => {
    buyForSelf(base.user.id, 5);
    const newer = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 3950,
        country: "IN",
        createdAt: daysBefore(2),
      })
      .returning()
      .get();

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)
    ).toMatchObject({ id: newer.id, country: "IN" });
  });

  it("is nothing when the buyer holds only a Team Licence", () => {
    buySeats(base.user.id, 5);

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)
    ).toBeNull();
  });

  it("is nothing for a Student who only claimed a Seat", () => {
    const teamAdmin = addStudent("Tess");
    const { seats } = buySeats(teamAdmin.id, 2);
    const student = addStudent("Sam");
    db.update(schema.coupons)
      .set({ redeemedByUserId: student.id, redeemedAt: daysBefore(1) })
      .where(eq(schema.coupons.id, seats[0].id))
      .run();

    expect(
      getNewestIndividualPurchase(db, student.id, base.course.id)
    ).toBeNull();
  });
});
