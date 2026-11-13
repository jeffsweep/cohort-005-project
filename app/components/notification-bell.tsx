import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useNotificationFeed } from "~/components/notification-feed";
import { feedRow, unreadLabel, type FeedRow } from "~/lib/notifications/feed-row";

// ─── The bell ───
// Sits in the sidebar's logo row for a signed-in person. Reads their feed
// (see notification-feed.tsx); the markup is Cadence's own. Without keys it
// says "Notifications aren't set up" (never naming the service); if the feed
// can't load it says so and shows no dot.

export function NotificationBell() {
  const feed = useNotificationFeed();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (feed.status === "not-set-up") {
    return <BellShell unread={0} body={<Message>Notifications aren't set up.</Message>} />;
  }
  if (feed.status === "error") {
    return <BellShell unread={0} body={<Message>Couldn't load notifications.</Message>} />;
  }
  if (feed.status === "loading") return <BellShell unread={0} body={null} />;

  const rows = feed.items.map((item) => feedRow(item));
  const { unread, markAsRead } = feed;

  function openRow(row: FeedRow) {
    if (!row.read) markAsRead(row.id);
    setOpen(false);
    navigate(row.url);
  }

  return (
    <BellShell
      unread={unread}
      open={open}
      onOpenChange={setOpen}
      onMarkAllRead={unread > 0 ? feed.markAllAsRead : undefined}
      onViewAll={() => setOpen(false)}
      body={
        rows.length === 0 ? (
          <Message>{EMPTY_FEED}</Message>
        ) : (
          rows.map((row) => <Row key={row.id} row={row} onOpen={openRow} />)
        )
      }
    />
  );
}

export const EMPTY_FEED = "Nothing new. You'll see enrollments, replies and refunds here.";

function BellShell({
  unread,
  body,
  open,
  onOpenChange,
  onMarkAllRead,
  onViewAll,
}: {
  unread: number;
  body: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMarkAllRead?: () => void;
  onViewAll?: () => void;
}) {
  const label = unreadLabel(unread);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="relative rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-96 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={!onMarkAllRead}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Mark all as read
          </button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto p-1">{body}</div>
        <Link
          to="/notifications"
          onClick={onViewAll}
          className="block border-t px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export function Row({ row, onOpen }: { row: FeedRow; onOpen: (row: FeedRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          row.read ? "bg-transparent" : "bg-primary"
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm",
            row.read ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {row.actor && <span className="font-semibold">{row.actor}</span>}
          {row.wording.map((part, index) =>
            part.italic ? <em key={index}>{part.text}</em> : <span key={index}>{part.text}</span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{row.time}</span>
      </span>
    </button>
  );
}

export function Message({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>
  );
}
