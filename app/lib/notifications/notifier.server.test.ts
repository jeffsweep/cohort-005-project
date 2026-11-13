import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  knockTransport,
  notify,
  outboxTransport,
  withdraw,
  type NotificationTransport,
} from "./notifier.server";
import type { Send, Withdrawal } from "./send";

const samEnrolled: Send = {
  workflow: "enrolled",
  recipient: { id: "2", name: "Test Instructor" },
  dedupKey: "enrolled:7",
  data: {
    actorName: "Sam",
    message: "Sam enrolled on *Test Course*",
    url: "/instructor/1/students",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notify", () => {
  it("writes one JSON file per send to the outbox when there are no Knock keys", async () => {
    const directory = mkdtempSync(join(tmpdir(), "notifications-"));
    const second = { ...samEnrolled, dedupKey: "enrolled:8" };

    await notify([samEnrolled, second], outboxTransport(directory));

    const files = readdirSync(directory).sort();
    expect(files).toHaveLength(2);
    const written = files.map((file) =>
      JSON.parse(readFileSync(join(directory, file), "utf8"))
    );
    expect(written).toContainEqual(samEnrolled);
    expect(written).toContainEqual(second);
  });

  it("logs a failed send instead of throwing, and still tries the rest", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const delivered: Send[] = [];
    const flaky: NotificationTransport = {
      async send(send) {
        if (send.dedupKey === "enrolled:7") throw new Error("Knock is down");
        delivered.push(send);
      },
      async withdraw() {},
    };
    const second = { ...samEnrolled, dedupKey: "enrolled:8" };

    await expect(notify([samEnrolled, second], flaky)).resolves.toBeUndefined();

    expect(delivered).toEqual([second]);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("enrolled:7"),
      expect.any(Error)
    );
  });

  it("builds the sends lazily and logs a builder that throws instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const directory = mkdtempSync(join(tmpdir(), "notifications-"));

    await expect(
      notify(() => {
        throw new Error("no such table");
      }, outboxTransport(directory))
    ).resolves.toBeUndefined();
    await notify(() => [samEnrolled], outboxTransport(directory));

    expect(error).toHaveBeenCalledTimes(1);
    expect(readdirSync(directory)).toHaveLength(1);
  });

  it("starts every send at once, so many recipients don't keep the action waiting", async () => {
    const started: string[] = [];
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: NotificationTransport = {
      async send(send) {
        started.push(send.dedupKey);
        await gate;
      },
      async withdraw() {},
    };
    const second = { ...samEnrolled, dedupKey: "enrolled:8" };

    const sending = notify([samEnrolled, second], slow);
    await Promise.resolve();

    expect(started).toEqual(["enrolled:7", "enrolled:8"]);
    release();
    await sending;
  });
});

describe("knockTransport", () => {
  it("triggers the kind's workflow with the dedup key and recipient as Idempotency-Key", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));

    await knockTransport("sk_test", fetch).send(samEnrolled);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.knock.app/v1/workflows/enrolled/trigger");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk_test",
      "Idempotency-Key": "enrolled:7:to:2",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      recipients: [{ id: "2", name: "Test Instructor" }],
      data: samEnrolled.data,
    });
  });

  it("gives each recipient of one event its own Idempotency-Key, and the same recipient the same key", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    const transport = knockTransport("sk_test", fetch);
    const toOtherAdmin: Send = {
      ...samEnrolled,
      recipient: { id: "5", name: "Other Admin" },
    };

    await transport.send(samEnrolled);
    await transport.send(toOtherAdmin);
    await transport.send(samEnrolled);

    const keys = fetch.mock.calls.map((call) => {
      const [, init] = call as unknown as [string, RequestInit];
      return (init.headers as Record<string, string>)["Idempotency-Key"];
    });
    expect(keys).toEqual(["enrolled:7:to:2", "enrolled:7:to:5", "enrolled:7:to:2"]);
  });

  it("throws when Knock rejects the trigger, so notify can log it", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 422 }));

    await expect(
      knockTransport("sk_test", fetch).send(samEnrolled)
    ).rejects.toThrow(/422/);
  });
});

const withdrawRefundRequest3: Withdrawal = {
  workflow: "refund-requested",
  triggerData: { refundRequestId: 3 },
};

describe("withdraw", () => {
  it("records the withdrawal in the outbox when there are no Knock keys", async () => {
    const directory = mkdtempSync(join(tmpdir(), "notifications-"));

    await withdraw(withdrawRefundRequest3, outboxTransport(directory));

    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(directory, files[0]), "utf8"))).toEqual(
      { withdrawn: withdrawRefundRequest3 }
    );
  });

  it("logs a failed withdrawal, or one that can't be built, instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: NotificationTransport = {
      async send() {},
      async withdraw() {
        throw new Error("Knock is down");
      },
    };

    await expect(
      withdraw(withdrawRefundRequest3, broken)
    ).resolves.toBeUndefined();
    await expect(
      withdraw(() => {
        throw new Error("no such table");
      }, broken)
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("refund-requested"),
      expect.any(Error)
    );
  });
});

describe("knockTransport withdrawals", () => {
  it("archives every recipient's copy in the feed channel, found by workflow and trigger data", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));

    await knockTransport("sk_test", fetch, "feed-channel-id").withdraw(
      withdrawRefundRequest3
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.knock.app/v1/channels/feed-channel-id/messages/bulk/archive"
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk_test" });
    expect(JSON.parse(String(init.body))).toEqual({
      workflows: ["refund-requested"],
      trigger_data: JSON.stringify({ refundRequestId: 3 }),
    });
  });

  it("throws when Knock rejects the archive, or the feed channel isn't set", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 422 }));

    await expect(
      knockTransport("sk_test", fetch, "feed-channel-id").withdraw(
        withdrawRefundRequest3
      )
    ).rejects.toThrow(/422/);
    await expect(
      knockTransport("sk_test", fetch, undefined).withdraw(
        withdrawRefundRequest3
      )
    ).rejects.toThrow(/KNOCK_FEED_CHANNEL_ID/);
  });
});
