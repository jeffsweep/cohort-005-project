import { describe, expect, it } from "vitest";
import { burstWording, nextToast, type ToastContext } from "./toasts";
import type { FeedItemLike } from "./feed-row";

const visible: ToastContext = { tabHidden: false, feedOpen: false, toastsOn: true };

function item(id: string, overrides: Partial<FeedItemLike> = {}): FeedItemLike {
  return {
    id,
    inserted_at: "2026-11-13T11:56:00Z",
    read_at: null,
    data: { actorName: "Sam", message: "Sam enrolled on *Test Course*", url: "/x" },
    ...overrides,
  };
}

describe("nextToast", () => {
  it("toasts a single live arrival with its own item", () => {
    const { toast } = nextToast(null, [item("a")], visible, 0);
    expect(toast).toEqual({ kind: "single", item: item("a") });
  });

  it("merges three arrivals a few seconds apart into one '3 new' toast", () => {
    let step = nextToast(null, [item("a")], visible, 0);
    step = nextToast(step.burst, [item("b")], visible, 4_000);
    step = nextToast(step.burst, [item("c")], visible, 8_000);
    expect(step.toast).toEqual({ kind: "burst", count: 3 });
  });

  it("starts afresh with a single toast after more than 10 s of quiet", () => {
    let step = nextToast(null, [item("a")], visible, 0);
    step = nextToast(step.burst, [item("b")], visible, 5_000);
    step = nextToast(step.burst, [item("c")], visible, 16_000);
    expect(step.toast).toEqual({ kind: "single", item: item("c") });
  });

  it("toasts two items that arrive together as '2 new'", () => {
    const { toast } = nextToast(null, [item("a"), item("b")], visible, 0);
    expect(toast).toEqual({ kind: "burst", count: 2 });
  });

  it.each([
    ["the tab is hidden", { ...visible, tabHidden: true }],
    ["the popover or full page is open", { ...visible, feedOpen: true }],
    ["the person turned toasts off", { ...visible, toastsOn: false }],
  ])("shows nothing while %s", (_, context) => {
    expect(nextToast(null, [item("a")], context, 0).toast).toEqual({ kind: "none" });
  });

  it("doesn't count arrivals the person couldn't be toasted about", () => {
    let step = nextToast(null, [item("a")], { ...visible, feedOpen: true }, 0);
    step = nextToast(step.burst, [item("b")], visible, 3_000);
    expect(step.toast).toEqual({ kind: "single", item: item("b") });
  });

  it("ignores arrivals that are already read", () => {
    const read = item("a", { read_at: "2026-11-13T11:57:00Z" });
    expect(nextToast(null, [read], visible, 0).toast).toEqual({ kind: "none" });
    expect(nextToast(null, [read, item("b")], visible, 0).toast).toEqual({
      kind: "single",
      item: item("b"),
    });
  });
});

describe("burstWording", () => {
  it("counts the merged arrivals", () => {
    expect(burstWording(3)).toBe("3 new notifications");
  });
});
