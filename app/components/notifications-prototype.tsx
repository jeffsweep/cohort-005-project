// PROTOTYPE — throwaway. Answers "How do the bell and feed look and behave?"
// (https://github.com/jeffsweep/cohort-005-project/issues/10).
// Three variants of the Notification bell + feed, mounted in the real sidebar,
// switchable via `?variant=A|B|C` and the floating bar at the bottom.
// Data is mocked in memory from the phase-1 catalogue; nothing talks to Knock.
// The feed is hand-rendered with shadcn tokens, i.e. the "headless Knock hooks,
// our own markup" styling option. Lives on branch prototype/notification-feed only.

import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Popover, Dialog } from "radix-ui";
import { Bell, ChevronLeft, ChevronRight, CheckCheck, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { UserRole } from "~/db/schema";

// ---------- mock store ----------

export interface MockNotification {
  id: string;
  actor: string; // "Cadence" when a Platform Admin acted
  text: string;
  link: string;
  minutesAgo: number;
  read: boolean;
}

const byRole: Record<UserRole, Omit<MockNotification, "read">[]> = {
  [UserRole.Instructor]: [
    { id: "i1", actor: "Sam Patel", text: "posted in the discussion on Hooks in depth", link: "/instructor/questions", minutesAgo: 4 },
    { id: "i2", actor: "Jo Rivera", text: "bought a Team Licence with 10 Seats on React Fundamentals", link: "/instructor", minutesAgo: 38 },
    { id: "i3", actor: "Ana Lee", text: "rated React Fundamentals 4★", link: "/courses", minutesAgo: 95 },
    { id: "i4", actor: "Cadence", text: "refunded Sam Patel's purchase of React Fundamentals", link: "/instructor", minutesAgo: 60 * 5 },
    { id: "i5", actor: "Mia Chen", text: "enrolled on React Fundamentals", link: "/instructor", minutesAgo: 60 * 26 },
    { id: "i6", actor: "Cadence", text: "archived TypeScript Basics", link: "/instructor", minutesAgo: 60 * 50 },
  ],
  [UserRole.Student]: [
    { id: "s1", actor: "Alex Kim", text: "replied to your post on Hooks in depth", link: "/courses", minutesAgo: 12 },
    { id: "s2", actor: "Cadence", text: "approved your Refund Request for TypeScript Basics", link: "/settings", minutesAgo: 60 * 3 },
    { id: "s3", actor: "Cadence", text: "3 new lessons on React Fundamentals", link: "/courses", minutesAgo: 60 * 20 },
    { id: "s4", actor: "Ana Lee", text: "replied to your comment on State and props", link: "/courses", minutesAgo: 60 * 30 },
  ],
  [UserRole.Admin]: [
    { id: "a1", actor: "Sam Patel", text: "asked for a refund on React Fundamentals", link: "/admin/refunds", minutesAgo: 7 },
    { id: "a2", actor: "Jo Rivera", text: "asked for a refund on a Team Licence for TypeScript Basics", link: "/admin/refunds", minutesAgo: 60 * 2 },
    { id: "a3", actor: "Cadence", text: "Your role is now Platform Admin", link: "/admin/users", minutesAgo: 60 * 72 },
  ],
};

let state: { role: UserRole | null; items: MockNotification[] } = { role: null, items: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ensureRole(role: UserRole) {
  if (state.role === role) return;
  state = {
    role,
    // first two unread, the rest read
    items: byRole[role].map((n, i) => ({ ...n, read: i >= 2 })),
  };
  emit();
}

export function useMockFeed(role: UserRole | null) {
  useEffect(() => {
    if (role) ensureRole(role);
  }, [role]);
  const snapshot = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => state
  );
  const items = role && snapshot.role === role ? snapshot.items : [];
  return {
    items,
    unread: items.filter((n) => !n.read).length,
    markRead: (id: string) => {
      state = { ...state, items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)) };
      emit();
    },
    markAllRead: () => {
      state = { ...state, items: state.items.map((n) => ({ ...n, read: true })) };
      emit();
    },
    // dev helper: simulate a new arrival
    push: () => {
      const n: MockNotification = {
        id: `new-${Date.now()}`,
        actor: "Riley Novak",
        text: "replied to your comment on Effects",
        link: "/courses",
        minutesAgo: 0,
        read: false,
      };
      state = { ...state, items: [n, ...state.items] };
      emit();
    },
  };
}

function ago(m: number) {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 60 / 24)}d`;
}

// ---------- shared feed row ----------

function FeedRow({
  n,
  onOpen,
  dense = false,
}: {
  n: MockNotification;
  onOpen: (n: MockNotification) => void;
  dense?: boolean;
}) {
  const isAdminMsg = n.text.startsWith("Your ");
  return (
    <button
      onClick={() => onOpen(n)}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 text-left transition-colors hover:bg-accent",
        dense ? "py-2" : "py-3"
      )}
    >
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          n.read ? "bg-transparent" : "bg-primary"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", n.read ? "text-muted-foreground" : "text-foreground")}>
          {isAdminMsg ? (
            n.text
          ) : (
            <>
              <span className="font-medium">{n.actor}</span> {n.text}
            </>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{ago(n.minutesAgo)}</span>
      </span>
    </button>
  );
}

function FeedHeader({ unread, onMarkAll, extra }: { unread: number; onMarkAll: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="text-sm font-semibold">Notifications</div>
      <div className="flex items-center gap-1">
        <button
          onClick={onMarkAll}
          disabled={unread === 0}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
        >
          <CheckCheck className="size-3.5" /> Mark all as read
        </button>
        {extra}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      Nothing new. You'll see enrollments, replies and refunds here.
    </div>
  );
}

// ---------- Variant A: logo-row bell, dot, popover ----------

export function VariantA({ role }: { role: UserRole | null }) {
  const feed = useMockFeed(role);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!role) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          title={feed.unread ? `${feed.unread} unread notifications` : "Notifications"}
          className="relative rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Bell className="size-4" />
          {feed.unread > 0 && (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <FeedHeader unread={feed.unread} onMarkAll={feed.markAllRead} />
          <div className="max-h-[28rem] overflow-y-auto p-1">
            {feed.items.length === 0 ? (
              <Empty />
            ) : (
              feed.items.map((n) => (
                <FeedRow
                  key={n.id}
                  n={n}
                  dense
                  onOpen={(n) => {
                    feed.markRead(n.id);
                    setOpen(false);
                    navigate(n.link);
                  }}
                />
              ))
            )}
          </div>
          <Link
            to="/prototype/notifications?variant=A"
            onClick={() => setOpen(false)}
            className="block border-t px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            View all notifications
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------- Variant B: nav item with count pill, slide-over drawer ----------

export function VariantB({ role }: { role: UserRole | null }) {
  const feed = useMockFeed(role);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("all");
  if (!role) return null;
  const shown = tab === "unread" ? feed.items.filter((n) => !n.read) : feed.items;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            open
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Bell className="size-4" />
          Notifications
          {feed.unread > 0 && (
            <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {feed.unread}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 left-56 z-40 bg-black/20" />
        <Dialog.Content className="fixed inset-y-0 left-56 z-50 flex w-[26rem] flex-col border-r bg-background shadow-xl">
          <Dialog.Title className="sr-only">Notifications</Dialog.Title>
          <FeedHeader
            unread={feed.unread}
            onMarkAll={feed.markAllRead}
            extra={
              <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent">
                <X className="size-4" />
              </Dialog.Close>
            }
          />
          <div className="flex gap-1 border-b px-3 py-2">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                  tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60"
                )}
              >
                {t}
                {t === "unread" && feed.unread > 0 ? ` (${feed.unread})` : ""}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {shown.length === 0 ? (
              <Empty />
            ) : (
              shown.map((n) => (
                <FeedRow
                  key={n.id}
                  n={n}
                  onOpen={(n) => {
                    feed.markRead(n.id);
                    setOpen(false);
                    navigate(n.link);
                  }}
                />
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------- Variant C: avatar-row bell with number, full page ----------

export function VariantCBell({ role }: { role: UserRole | null }) {
  const feed = useMockFeed(role);
  if (!role) return null;
  return (
    <Link
      to="/prototype/notifications?variant=C"
      title="Notifications"
      className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Bell className="size-4" />
      {feed.unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
          {feed.unread > 9 ? "9+" : feed.unread}
        </span>
      )}
    </Link>
  );
}

export function VariantCPage({ role }: { role: UserRole | null }) {
  const feed = useMockFeed(role);
  const navigate = useNavigate();
  const today = feed.items.filter((n) => n.minutesAgo < 60 * 24);
  const earlier = feed.items.filter((n) => n.minutesAgo >= 60 * 24);
  const open = (n: MockNotification) => {
    feed.markRead(n.id);
    navigate(n.link);
  };
  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {feed.unread ? `${feed.unread} unread` : "You're all caught up"}
          </p>
        </div>
        <button
          onClick={feed.markAllRead}
          disabled={feed.unread === 0}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-40"
        >
          <CheckCheck className="size-4" /> Mark all as read
        </button>
      </div>
      {!role ? (
        <p className="text-sm text-muted-foreground">Select a user from the DevUI panel.</p>
      ) : feed.items.length === 0 ? (
        <Empty />
      ) : (
        [
          ["Today", today],
          ["Earlier", earlier],
        ].map(([label, list]) =>
          (list as MockNotification[]).length ? (
            <section key={label as string} className="mb-6">
              <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label as string}
              </h2>
              <div className="divide-y rounded-lg border">
                {(list as MockNotification[]).map((n) => (
                  <FeedRow key={n.id} n={n} onOpen={open} />
                ))}
              </div>
            </section>
          ) : null
        )
      )}
    </div>
  );
}

// ---------- switcher ----------

export const VARIANTS = [
  { key: "A", name: "Logo row · dot · popover" },
  { key: "B", name: "Nav item · count · drawer" },
  { key: "C", name: "Avatar row · number · full page" },
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

const STORAGE_KEY = "prototype-notification-variant";

// URL param wins; falls back to the last choice so normal sidebar navigation keeps the variant.
export function useVariant(): VariantKey {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant") as VariantKey | null;
  const [stored, setStored] = useState<VariantKey>("A");
  useEffect(() => {
    if (fromUrl && VARIANTS.some((v) => v.key === fromUrl)) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      setStored(fromUrl);
    } else {
      const s = localStorage.getItem(STORAGE_KEY) as VariantKey | null;
      if (s) setStored(s);
    }
  }, [fromUrl]);
  return fromUrl && VARIANTS.some((v) => v.key === fromUrl) ? fromUrl : stored;
}

export function PrototypeSwitcher({ role }: { role: UserRole | null }) {
  const current = useVariant();
  const [params, setParams] = useSearchParams();
  const feed = useMockFeed(role);
  const idx = VARIANTS.findIndex((v) => v.key === current);

  const go = (delta: number) => {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length];
    const p = new URLSearchParams(params);
    p.set("variant", next.key);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-zinc-900 px-2 py-1.5 text-xs text-white shadow-xl ring-1 ring-white/20">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/15">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 text-center font-medium">
        {current} ({VARIANTS[idx]?.name}) · {feed.unread} unread
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/15">
        <ChevronRight className="size-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-white/25" />
      <button onClick={feed.push} disabled={!role} className="rounded-full px-2 py-1 hover:bg-white/15 disabled:opacity-40">
        + simulate new
      </button>
    </div>
  );
}
