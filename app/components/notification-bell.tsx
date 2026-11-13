import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  KnockFeedProvider,
  KnockProvider,
  useKnockFeed,
} from "@knocklabs/react-core";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { feedRow, unreadLabel, type FeedRow } from "~/lib/notifications/feed-row";
import type { FeedIdentity } from "~/lib/notifications/feed-identity.server";
import { FEED_OPTIONS, useLiveFeed } from "~/components/notification-live";

// ─── The bell ───
// Sits in the sidebar's logo row for a signed-in person. Reads their feed
// from Knock in the browser with headless hooks; the markup is Cadence's own.
// Without keys it says "Notifications aren't set up" (never naming the
// service); if the feed can't load it says so and shows no dot.

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

export function NotificationBell({ feed }: { feed: FeedIdentity | null }) {
  // Knock only runs in the browser: no client, fetch or socket during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!feed) return <BellShell unread={0} body={<Message>Notifications aren't set up.</Message>} />;
  if (!mounted) return <BellShell unread={0} body={null} />;

  // Keyed by user, so switching users never shows the previous user's feed.
  return <KnockBell key={feed.userId} feed={feed} />;
}

function KnockBell({ feed }: { feed: FeedIdentity }) {
  // The layout loader signs a new token on every navigation. Keep the first
  // one: handing Knock a new token reconnects the feed. Knock asks for a
  // fresh one before it expires.
  const [initialToken] = useState(feed.userToken);

  return (
    <KnockProvider
      apiKey={feed.publicKey}
      user={{ id: feed.userId }}
      identificationStrategy="skip"
      userToken={initialToken}
      onUserTokenExpiring={() => refreshToken(feed.userId)}
      timeBeforeExpirationInMs={REFRESH_BEFORE_EXPIRY_MS}
    >
      <KnockFeedProvider feedId={feed.feedChannelId} defaultFeedOptions={FEED_OPTIONS}>
        <KnockFeedBell />
      </KnockFeedProvider>
    </KnockProvider>
  );
}

async function refreshToken(userId: string): Promise<string | void> {
  try {
    const response = await fetch(
      `/api/knock-token?userId=${encodeURIComponent(userId)}`
    );
    // Another tab switched the user: reload rather than mix identities.
    if (response.status === 409) {
      window.location.reload();
      return;
    }
    // No user or no keys: stop asking.
    if (!response.ok) return;
    const body: { userToken: string } = await response.json();
    return body.userToken;
  } catch {
    return;
  }
}

function KnockFeedBell() {
  const { feedClient, useFeedStore } = useKnockFeed();
  const { items, metadata, networkStatus } = useFeedStore();
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Toasts are on for everyone in Phase 1; #29 passes the "Show toasts" setting.
  useLiveFeed({ popoverOpen: open, openPopover: () => setOpen(true), toastsOn: true });

  useEffect(() => {
    let cancelled = false;
    feedClient
      .fetch()
      .then((result) => {
        if (!cancelled && result?.status === "error") setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [feedClient]);

  if (failed || networkStatus === "error") {
    return <BellShell unread={0} body={<Message>Couldn't load notifications.</Message>} />;
  }

  const rows = items.map((item) => feedRow(item));
  const unread = metadata.unread_count;
  const loading = networkStatus === "loading" && items.length === 0;

  function openRow(row: FeedRow) {
    const item = items.find((candidate) => candidate.id === row.id);
    if (item && !row.read) void feedClient.markAsRead(item);
    setOpen(false);
    navigate(row.url);
  }

  return (
    <BellShell
      unread={unread}
      open={open}
      onOpenChange={setOpen}
      onMarkAllRead={unread > 0 ? () => void feedClient.markAllAsRead() : undefined}
      body={
        loading ? null : rows.length === 0 ? (
          <Message>Nothing new. You'll see enrollments, replies and refunds here.</Message>
        ) : (
          rows.map((row) => <Row key={row.id} row={row} onOpen={openRow} />)
        )
      }
    />
  );
}

function BellShell({
  unread,
  body,
  open,
  onOpenChange,
  onMarkAllRead,
}: {
  unread: number;
  body: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMarkAllRead?: () => void;
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
      </PopoverContent>
    </Popover>
  );
}

function Row({ row, onOpen }: { row: FeedRow; onOpen: (row: FeedRow) => void }) {
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

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>
  );
}
