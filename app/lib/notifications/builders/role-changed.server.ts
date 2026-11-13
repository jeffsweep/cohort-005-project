import { eq } from "drizzle-orm";
import { UserRole, users } from "~/db/schema";
import type { Send } from "../send";
import { actorNameOf, excludingActor, recipientOf, type Db } from "./shared.server";

const ROLES: Record<UserRole, { name: string; startsAt: string }> = {
  [UserRole.Student]: { name: "Student", startsAt: "/dashboard" },
  [UserRole.Instructor]: { name: "Instructor", startsAt: "/instructor" },
  [UserRole.Admin]: { name: "Platform Admin", startsAt: "/admin/users" },
};

/**
 * Someone's role changed (read after the write commits): tell them, linking
 * to where the new role starts.
 */
export function buildRoleChanged(
  db: Db,
  event: { userId: number; actorId: number }
): Send[] {
  const person = db.select().from(users).where(eq(users.id, event.userId)).get();
  const actor = db.select().from(users).where(eq(users.id, event.actorId)).get();
  if (!person || !actor) return [];

  const role = ROLES[person.role];

  return excludingActor(
    [
      {
        workflow: "role-changed",
        recipient: recipientOf(person),
        dedupKey: `role-changed:${person.id}:${person.role}`,
        data: {
          actorName: actorNameOf(actor),
          message: `Your role is now ${role.name}`,
          url: role.startsAt,
        },
      },
    ],
    actor.id
  );
}
