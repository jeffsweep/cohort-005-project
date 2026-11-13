import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.knock-token";
import { getCurrentUserId } from "~/lib/session";
import { feedIdentity } from "~/lib/notifications/feed-identity.server";

// Knock's React provider calls this shortly before the feed token expires.
// The tab says which user it is showing; if the cookie now holds someone
// else (another tab switched user), it answers 409 and the tab reloads
// rather than show the wrong person's feed. With no user or no keys it
// answers 401 and the bell stops asking.

const querySchema = z.object({ userId: z.string().min(1) });

export async function loader({ request }: Route.LoaderArgs) {
  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!query.success) throw data("Missing userId", { status: 400 });

  const currentUserId = await getCurrentUserId(request);
  if (currentUserId === null) throw data("No user", { status: 401 });

  if (String(currentUserId) !== query.data.userId) {
    throw data("The user changed", { status: 409 });
  }

  const identity = feedIdentity(currentUserId);
  if (!identity) throw data("Notifications aren't set up", { status: 401 });

  return { userToken: identity.userToken };
}
