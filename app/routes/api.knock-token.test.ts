import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setCurrentUserId } from "~/lib/session";
import { loader } from "./api.knock-token";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingKey = Buffer.from(
  privateKey.export({ type: "pkcs8", format: "pem" }).toString()
).toString("base64");

function withKeys() {
  vi.stubEnv("KNOCK_PUBLIC_API_KEY", "pk_test_123");
  vi.stubEnv("KNOCK_SIGNING_KEY", signingKey);
  vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "feed-channel-1");
}

function withoutKeys() {
  vi.stubEnv("KNOCK_PUBLIC_API_KEY", "");
  vi.stubEnv("KNOCK_SIGNING_KEY", "");
  vi.stubEnv("KNOCK_FEED_CHANNEL_ID", "");
}

async function requestFor(tabUserId: string, cookieUserId?: number) {
  const url = `http://localhost/api/knock-token?userId=${tabUserId}`;
  if (cookieUserId === undefined) return new Request(url);
  const setCookie = await setCurrentUserId(new Request(url), cookieUserId);
  return new Request(url, {
    headers: { Cookie: setCookie.split(";")[0] },
  });
}

async function statusOf(request: Request) {
  try {
    const result = await loader({ request } as Parameters<typeof loader>[0]);
    return { status: 200, body: result };
  } catch (thrown) {
    if (thrown && typeof thrown === "object" && "init" in thrown) {
      const init = (thrown as { init: ResponseInit | null }).init;
      return { status: init?.status };
    }
    throw thrown;
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/knock-token", () => {
  it("gives the tab a fresh token for the user in the cookie", async () => {
    withKeys();

    const result = await statusOf(await requestFor("7", 7));

    expect(result).toEqual({
      status: 200,
      body: { userToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/) },
    });
  });

  it("tells the tab to reload when another tab switched the user", async () => {
    withKeys();

    const result = await statusOf(await requestFor("7", 8));

    expect(result.status).toBe(409);
  });

  it("answers 401 with no user", async () => {
    withKeys();

    const result = await statusOf(await requestFor("7"));

    expect(result.status).toBe(401);
  });

  it("answers 401 without keys", async () => {
    withoutKeys();

    const result = await statusOf(await requestFor("7", 7));

    expect(result.status).toBe(401);
  });
});
