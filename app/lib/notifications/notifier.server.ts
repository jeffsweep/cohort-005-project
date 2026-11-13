import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Send, Withdrawal } from "./send";

// ─── The notifier ───
// Knock delivers every Notification when KNOCK_SECRET_API_KEY is set. Without
// it (local dev, tests) each send is written to .notifications/ as a JSON file
// instead, so it can be read without sending anything.
//
// Sending is best-effort: a failure is logged and never thrown, so it can
// never block the action that caused it. No retries, no queue. The same goes
// for withdrawing Notifications that no longer need acting on.

export interface NotificationTransport {
  send(send: Send): Promise<void>;
  /** Archives every recipient's copy matching the withdrawal. */
  withdraw(withdrawal: Withdrawal): Promise<void>;
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export function knockTransport(
  secretKey: string,
  fetchImpl: Fetch = fetch,
  /** The in-app feed channel's id, which archiving needs. */
  feedChannelId: string | undefined = process.env.KNOCK_FEED_CHANNEL_ID
): NotificationTransport {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${secretKey}`,
  };

  return {
    async send(send) {
      const response = await fetchImpl(
        `https://api.knock.app/v1/workflows/${encodeURIComponent(send.workflow)}/trigger`,
        {
          method: "POST",
          headers: {
            ...headers,
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

    async withdraw(withdrawal) {
      if (!feedChannelId) {
        throw new Error("KNOCK_FEED_CHANNEL_ID is not set");
      }

      // One bulk archive across every recipient's feed.
      const response = await fetchImpl(
        `https://api.knock.app/v1/channels/${encodeURIComponent(feedChannelId)}/messages/bulk/archive`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            workflows: [withdrawal.workflow],
            trigger_data: JSON.stringify(withdrawal.triggerData),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Knock rejected the withdrawal of ${describe(withdrawal)}: ${response.status} ${await response.text()}`
        );
      }
    },
  };
}

export function outboxTransport(directory: string): NotificationTransport {
  function write(name: string, content: unknown) {
    mkdirSync(directory, { recursive: true });
    const safeName = name.replace(/[^\w-]/g, "_");
    writeFileSync(
      join(directory, `${Date.now()}-${safeName}.json`),
      JSON.stringify(content, null, 2)
    );
  }

  return {
    async send(send) {
      write(`${send.dedupKey}-to-${send.recipient.id}`, send);
    },
    async withdraw(withdrawal) {
      write(`withdrawn-${describe(withdrawal)}`, { withdrawn: withdrawal });
    },
  };
}

function describe(withdrawal: Withdrawal): string {
  return `${withdrawal.workflow} ${JSON.stringify(withdrawal.triggerData)}`;
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

/**
 * Archives every copy of the Notifications matching the withdrawal, whoever
 * they went to. Never throws; failures are logged.
 */
export async function withdraw(
  withdrawal: Withdrawal | (() => Withdrawal),
  transport: NotificationTransport = defaultTransport()
): Promise<void> {
  let built: Withdrawal;
  try {
    built = typeof withdrawal === "function" ? withdrawal() : withdrawal;
  } catch (error) {
    console.error("A withdrawal could not be built", error);
    return;
  }

  try {
    await transport.withdraw(built);
  } catch (error) {
    console.error(
      `Notifications ${describe(built)} were not withdrawn`,
      error
    );
  }
}
