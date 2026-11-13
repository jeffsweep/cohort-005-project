import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  KnockFeedProvider,
  KnockProvider,
  useKnockFeed,
} from "@knocklabs/react-core";
import type { FeedItemLike } from "~/lib/notifications/feed-row";
import type { FeedIdentity } from "~/lib/notifications/feed-identity.server";
import { FEED_OPTIONS, useLiveFeed } from "~/components/notification-live";

// ─── The signed-in person's feed ───
// One Knock feed for the whole app layout, shared by the bell and the
// all-notifications page, so marking read in one shows in the other.
// Knock only runs in the browser: no client, fetch or socket during SSR.

export type NotificationFeedState =
  | { status: "not-set-up" }
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      items: FeedItemLike[];
      unread: number;
      markAsRead: (id: string) => void;
      markAllAsRead: () => void;
    };

const FeedStateContext = createContext<NotificationFeedState>({ status: "not-set-up" });

export function useNotificationFeed(): NotificationFeedState {
  return useContext(FeedStateContext);
}

/** The bell's popover is open. Lives here so live toasts can stay quiet while
 *  it's open, and a merged toast can open it. */
type BellPopover = { open: boolean; setOpen: (open: boolean) => void };
const BellPopoverContext = createContext<BellPopover>({ open: false, setOpen: () => {} });

export function useBellPopover(): BellPopover {
  return useContext(BellPopoverContext);
}

/** Whether Knock's client is available to children: "not-set-up" without
 *  keys or user, "starting" until hydration mounts the provider. Only under
 *  "ready" may a child call `useKnockClient()`. */
export type KnockAvailability = "not-set-up" | "starting" | "ready";
const KnockAvailabilityContext = createContext<KnockAvailability>("not-set-up");

export function useKnockAvailability(): KnockAvailability {
  return useContext(KnockAvailabilityContext);
}

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

/** The person's "Show toasts" setting, from the layout loader. */
const ShowToastsContext = createContext(true);

export function NotificationFeedProvider({
  feed,
  showToasts,
  children,
}: {
  feed: FeedIdentity | null;
  showToasts: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ShowToastsContext.Provider value={showToasts}>
      <BellPopoverContext.Provider value={{ open, setOpen }}>
        <FeedFor feed={feed}>{children}</FeedFor>
      </BellPopoverContext.Provider>
    </ShowToastsContext.Provider>
  );
}

function FeedFor({ feed, children }: { feed: FeedIdentity | null; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!feed) {
    return <FeedStateContext.Provider value={{ status: "not-set-up" }}>{children}</FeedStateContext.Provider>;
  }
  if (!mounted) {
    return (
      <KnockAvailabilityContext.Provider value="starting">
        <FeedStateContext.Provider value={{ status: "loading" }}>{children}</FeedStateContext.Provider>
      </KnockAvailabilityContext.Provider>
    );
  }
  // Keyed by user, so switching users never shows the previous user's feed.
  return (
    <KnockAvailabilityContext.Provider value="ready">
      <KnockFeed key={feed.userId} feed={feed}>
        {children}
      </KnockFeed>
    </KnockAvailabilityContext.Provider>
  );
}

function KnockFeed({ feed, children }: { feed: FeedIdentity; children: ReactNode }) {
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
        <FeedState>{children}</FeedState>
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

function FeedState({ children }: { children: ReactNode }) {
  const { feedClient, useFeedStore } = useKnockFeed();
  const { items, metadata, networkStatus } = useFeedStore();
  const [failed, setFailed] = useState(false);
  const popover = useBellPopover();
  // useLiveFeed reads this at arrival time, so flipping the setting on
  // /settings applies at once (the layout loader revalidates after the save).
  const showToasts = useContext(ShowToastsContext);
  useLiveFeed({
    popoverOpen: popover.open,
    openPopover: () => popover.setOpen(true),
    toastsOn: showToasts,
  });

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

  const state: NotificationFeedState =
    failed || networkStatus === "error"
      ? { status: "error" }
      : networkStatus === "loading" && items.length === 0
        ? { status: "loading" }
        : {
            status: "ready",
            items,
            unread: metadata.unread_count,
            markAsRead: (id) => {
              const item = items.find((candidate) => candidate.id === id);
              if (item && !item.read_at) void feedClient.markAsRead(item);
            },
            markAllAsRead: () => void feedClient.markAllAsRead(),
          };

  return <FeedStateContext.Provider value={state}>{children}</FeedStateContext.Provider>;
}
