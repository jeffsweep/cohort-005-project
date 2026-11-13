import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Send } from "./send";

// ─── The notifier ───
// Knock delivers every Notification when KNOCK_SECRET_API_KEY is set. Without
// it (local dev, tests) each send is written to .notifications/ as a JSON file
// instead, so it can be read without sending anything.
//
// Sending is best-effort: a failure is logged and never thrown, so it can
// never block the action that caused it. No retries, no queue.

export interface NotificationTransport {
  send(send: Send): Promise<void>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function knockTransport(
  secretKey: string,
  fetchImpl: Fetch = fetch
): NotificationTransport {
  return {
    async send(send) {
      const response = await fetchImpl(
        `https://api.knock.app/v1/workflows/${encodeURIComponent(send.workflow)}/trigger`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${secretKey}`,
            // Knock owns deduplication: a repeated key within 24 h is dropped.
            "Idempotency-Key": send.dedupKey,
          },
          body: JSON.stringify({
            recipients: [send.recipient],
            data: send.data,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Knock rejected ${send.dedupKey}: ${response.status} ${await response.text()}`
        );
      }
    },
  };
}

export function outboxTransport(directory: string): NotificationTransport {
  return {
    async send(send) {
      mkdirSync(directory, { recursive: true });
      const safeKey = send.dedupKey.replace(/[^\w-]/g, "_");
      const file = join(
        directory,
        `${Date.now()}-${safeKey}-to-${send.recipient.id}.json`
      );
      writeFileSync(file, JSON.stringify(send, null, 2));
    },
  };
}

function defaultTransport(): NotificationTransport {
  const secretKey = process.env.KNOCK_SECRET_API_KEY;
  return secretKey
    ? knockTransport(secretKey)
    : outboxTransport(".notifications");
}

/**
 * Sends each Notification. Never throws; failures are logged.
 *
 * Pass the builder call as a function, `notify(() => buildX(db, event))`, so
 * a builder that throws is logged too instead of failing the action.
 */
export async function notify(
  sends: Send[] | (() => Send[]),
  transport: NotificationTransport = defaultTransport()
): Promise<void> {
  let built: Send[];
  try {
    built = typeof sends === "function" ? sends() : sends;
  } catch (error) {
    console.error("Notifications could not be built", error);
    return;
  }

  for (const send of built) {
    try {
      await transport.send(send);
    } catch (error) {
      console.error(`Notification ${send.dedupKey} was not sent`, error);
    }
  }
}
