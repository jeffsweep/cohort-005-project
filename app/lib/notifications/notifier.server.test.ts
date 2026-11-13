import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  knockTransport,
  notify,
  outboxTransport,
  type NotificationTransport,
} from "./notifier.server";
import type { Send } from "./send";

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
});

describe("knockTransport", () => {
  it("triggers the kind's workflow with the dedup key as Idempotency-Key", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));

    await knockTransport("sk_test", fetch).send(samEnrolled);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.knock.app/v1/workflows/enrolled/trigger");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk_test",
      "Idempotency-Key": "enrolled:7",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      recipients: [{ id: "2", name: "Test Instructor" }],
      data: samEnrolled.data,
    });
  });

  it("throws when Knock rejects the trigger, so notify can log it", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 422 }));

    await expect(
      knockTransport("sk_test", fetch).send(samEnrolled)
    ).rejects.toThrow(/422/);
  });
});
