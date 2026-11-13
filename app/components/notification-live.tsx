import { useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useKnockFeed } from "@knocklabs/react-core";
import type { FeedEventPayload, FeedItem } from "@knocklabs/client";
import { toast } from "sonner";
import { feedRow } from "~/lib/notifications/feed-row";
import {
  burstWording,
  nextToast,
  TOAST_DURATION_MS,
  type Burst,
} from "~/lib/notifications/toasts";

// ─── Live updates and toasts ───
// Knock's provider already opens the real-time connection when the bell mounts
// (useNotifications calls listenForUpdates), so new items land at the top of
// the store, unread, and the dot and count follow. This hook adds:
//   - a silent refetch when the connection reopens or the tab becomes visible
//     (a refetch never toasts and never shows "Couldn't load notifications"
//     unless the fetch itself fails);
//   - toasts for items that arrived over the live connection, decided by
//     `nextToast` in `~/lib/notifications/toasts`.

/** Read state syncs between tabs of the same browser. Stable: Knock compares options. */
export const FEED_OPTIONS = { __experimentalCrossBrowserUpdates: true } as const;

/** Every Notification toast shares this id, so a new one replaces the last. */
const TOAST_ID = "notification";

export function useLiveFeed({
  popoverOpen,
  openPopover,
  toastsOn,
}: {
  popoverOpen: boolean;
  openPopover: () => void;
  /** Whether this person wants toasts at all. */
  toastsOn: boolean;
}) {
  const { feedClient } = useKnockFeed();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The handlers below read what's on screen at the moment an item arrives.
  const latest = useRef({ popoverOpen, openPopover, toastsOn, pathname, navigate });
  latest.current = { popoverOpen, openPopover, toastsOn, pathname, navigate };

  useRefetchOnReconnect();

  useEffect(() => {
    let burst: Burst = null;
    // Until a first page has loaded, a "live" fetch would return the whole
    // feed (Knock fetches everything newer than the top item, and there is
    // none), so it mustn't toast.
    let loaded = false;
    const onPage = () => {
      loaded = true;
    };

    const onLive = ({ items }: FeedEventPayload) => {
      if (!loaded) return;
      const { popoverOpen, toastsOn, pathname } = latest.current;
      const step = nextToast(
        burst,
        items,
        {
          tabHidden: document.hidden,
          feedOpen: popoverOpen || pathname === "/notifications",
          toastsOn,
        },
        Date.now()
      );
      burst = step.burst;

      if (step.toast.kind === "single") {
        const item = step.toast.item;
        toast(<SingleToast item={item} onOpen={() => openItem(item)} />, {
          id: TOAST_ID,
          duration: TOAST_DURATION_MS,
        });
      } else if (step.toast.kind === "burst") {
        const count = step.toast.count;
        toast(
          <ToastButton
            onClick={() => {
              toast.dismiss(TOAST_ID);
              latest.current.openPopover();
            }}
          >
            {burstWording(count)}
          </ToastButton>,
          { id: TOAST_ID, duration: TOAST_DURATION_MS }
        );
      }
    };

    function openItem(item: FeedItem) {
      toast.dismiss(TOAST_ID);
      // Prefer the store's copy, in case its read state has moved on.
      const current = feedClient.getState().items.find((i) => i.id === item.id) ?? item;
      if (current.read_at === null) void feedClient.markAsRead(current);
      latest.current.navigate(feedRow(current).url);
    }

    feedClient.on("items.received.page", onPage);
    feedClient.on("items.received.realtime", onLive);
    return () => {
      feedClient.off("items.received.page", onPage);
      feedClient.off("items.received.realtime", onLive);
    };
  }, [feedClient]);
}

function useRefetchOnReconnect() {
  const { knock, feedClient } = useKnockFeed();
  useEffect(() => {
    // The first open is the initial connection; the bell has already
    // fetched. Every open after that is a reconnect (dropped connection,
    // tab visible again, or a token refresh, which builds a new socket).
    let opened = false;
    let socket: ReturnType<typeof knock.client>["socket"];
    let refs: string[] = [];

    const refetch = () => void feedClient.fetch().catch(() => {});
    const attach = () => {
      const next = knock.isAuthenticated() ? knock.client().socket : undefined;
      if (next === socket) return;
      socket?.off(refs);
      socket = next;
      refs = socket
        ? [
            socket.onOpen(() => {
              if (opened) refetch();
              opened = true;
            }),
          ]
        : [];
    };

    attach();
    const unsubscribe = knock.authStore.subscribe(attach);
    const onVisibility = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      unsubscribe();
      socket?.off(refs);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [knock, feedClient]);
}

function SingleToast({ item, onOpen }: { item: FeedItem; onOpen: () => void }) {
  const row = feedRow(item);
  return (
    <ToastButton onClick={onOpen}>
      {row.actor && <span className="font-semibold">{row.actor}</span>}
      {row.wording.map((part, index) =>
        part.italic ? <em key={index}>{part.text}</em> : <span key={index}>{part.text}</span>
      )}
    </ToastButton>
  );
}

function ToastButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left text-sm">
      {children}
    </button>
  );
}
