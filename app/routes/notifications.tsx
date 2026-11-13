import { data, useNavigate } from "react-router";
import { CheckCheck } from "lucide-react";
import type { Route } from "./+types/notifications";
import { getCurrentUserId } from "~/lib/session";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useNotificationFeed } from "~/components/notification-feed";
import { EMPTY_FEED, Message, Row } from "~/components/notification-bell";
import {
  feedRow,
  groupByDay,
  unreadSummary,
  type FeedRow,
} from "~/lib/notifications/feed-row";

// ─── All notifications ───
// The same feed as the bell (the layout shares it), as a full page grouped
// into Today and Earlier. Opened from the popover's "View all notifications".

export function meta() {
  return [
    { title: "Notifications — Cadence" },
    { name: "description", content: "Everything you've been notified about" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to see your notifications.", {
      status: 401,
    });
  }
  return null;
}

export default function Notifications() {
  const feed = useNotificationFeed();
  const navigate = useNavigate();
  const ready = feed.status === "ready" ? feed : null;

  function openRow(row: FeedRow) {
    if (!row.read) ready?.markAsRead(row.id);
    navigate(row.url);
  }

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          {ready && <p className="mt-1 text-muted-foreground">{unreadSummary(ready.unread)}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={ready?.markAllAsRead}
          disabled={!ready || ready.unread === 0}
        >
          <CheckCheck className="size-4" /> Mark all as read
        </Button>
      </div>

      {feed.status === "not-set-up" ? (
        <Card className="py-0">
          <Message>Notifications aren't set up.</Message>
        </Card>
      ) : feed.status === "error" ? (
        <Card className="py-0">
          <Message>Couldn't load notifications.</Message>
        </Card>
      ) : feed.status === "loading" ? null : feed.items.length === 0 ? (
        <Card className="py-0">
          <Message>{EMPTY_FEED}</Message>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupByDay(feed.items).map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {group.label}
              </h2>
              <Card className="gap-0 p-1">
                {group.items.map((item) => {
                  const row = feedRow(item);
                  return <Row key={row.id} row={row} onOpen={openRow} />;
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
