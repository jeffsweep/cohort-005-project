import { createSign } from "node:crypto";

// ─── Feed identity ───
// The browser reads a person's feed from Knock with the public key plus a
// user token Cadence signs here. Enhanced security is on, so a feed read
// without a valid token is rejected. Nothing is stored: the layout loader
// signs a fresh token on every request, and /api/knock-token refreshes it.

export type FeedIdentity = {
  /** The Knock user id: the Cadence user id as text. */
  userId: string;
  userToken: string;
  publicKey: string;
  feedChannelId: string;
};

type KnockEnv = {
  KNOCK_PUBLIC_API_KEY?: string;
  KNOCK_SIGNING_KEY?: string;
  KNOCK_FEED_CHANNEL_ID?: string;
};

const TOKEN_LIFETIME_SECONDS = 60 * 60;

/**
 * The feed identity for a user, or null when Knock isn't set up. Set up means
 * both the public key and the signing key (and the feed channel); a public
 * key alone counts as not set up.
 */
export function feedIdentity(
  userId: number,
  env: KnockEnv = process.env,
  now: Date = new Date()
): FeedIdentity | null {
  const publicKey = env.KNOCK_PUBLIC_API_KEY;
  const signingKey = env.KNOCK_SIGNING_KEY;
  const feedChannelId = env.KNOCK_FEED_CHANNEL_ID;
  if (!publicKey || !signingKey || !feedChannelId) return null;

  const knockUserId = String(userId);
  return {
    userId: knockUserId,
    userToken: signUserToken(knockUserId, signingKey, now),
    publicKey,
    feedChannelId,
  };
}

function signUserToken(sub: string, signingKey: string, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64url({ alg: "RS256", typ: "JWT" });
  const payload = base64url({ sub, iat, exp: iat + TOKEN_LIFETIME_SECONDS });

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(pemOf(signingKey)).toString("base64url");

  return `${header}.${payload}.${signature}`;
}

// Knock hands out the signing key base64-encoded; accept plain PEM too.
function pemOf(signingKey: string) {
  return signingKey.startsWith("-----BEGIN")
    ? signingKey
    : Buffer.from(signingKey, "base64").toString("utf8");
}

function base64url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
