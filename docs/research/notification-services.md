# In-app notification services for Cadence

Research for [#7](https://github.com/jeffsweep/cohort-005-project/issues/7), part of map [#6](https://github.com/jeffsweep/cohort-005-project/issues/6). Researched 2026-11-11 against vendor docs and pricing pages. Prices and limits change; re-check before committing.

The bar, from the map: Cadence is a dumb sender that fires sends as often as it likes, each with a deterministic dedup key (e.g. `refund-approved:<refundRequestId>`). The service owns dedup, read state and display. Best-effort, no queue, in-app only. Hosted with a free tier and a React inbox is preferred. Self-hosting is acceptable only if it is one docker command locally. Minimal configuration. Phase 2 needs per-user preferences.

## Headline finding: no service dedups forever by default

Every candidate's dedup mechanism is an HTTP **idempotency key with a time window**, not a permanent "this key has been shown" record:

| Service | Mechanism | Window | Same key, different body |
| --- | --- | --- | --- |
| Courier | `Idempotency-Key` header on `POST /send` | 25 h by default; extendable **up to one year** per request with `x-idempotency-expiration` | not stated |
| Knock | `Idempotency-Key` header, only on `POST /workflows/:key/trigger` | 24 h | error |
| Novu Cloud | `Idempotency-Key` header on `POST /v1/events/trigger` (must be enabled by support); also `transactionId` | 24 h (key); `transactionId` retention "depends on your billing tier" | 422 error |
| MagicBell | `Idempotency-Key` header | 24 h | not stated |
| SuprSend | `idempotency_key` on workflow trigger | 24 h | not stated (later requests are skipped) |

Consequences for Cadence:

- Repeat sends within the window show once. A repeat after the window creates a second notification, except on Courier with a long `x-idempotency-expiration`.
- Knock and Novu reject a reused key with a different body. Cadence's payload for a given key must be deterministic (no "sent at" timestamps, no changing copy).
- Knock caches only `2xx` responses; Courier caches the first response whatever its status. Under best-effort this hardly matters, but on Courier a failed first send with a key is "used up" until it expires.

Sources: [Courier idempotent requests](https://www.courier.com/docs/reference/idempotent-requests), [Knock idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests), [Novu idempotency](https://docs.novu.co/api-reference/idempotency), [Novu trigger event](https://docs.novu.co/api-reference/events/trigger-event), [MagicBell REST API v2](https://www.magicbell.com/docs/api), [SuprSend idempotent requests](https://docs.suprsend.com/reference/idempotent-requests).

## Comparison

### Courier

- **Dedup.** `Idempotency-Key` on `POST /send`. Replays for 25 h by default; `x-idempotency-expiration` (ISO 8601 or epoch ms) extends it up to one year. Stores the first response's status and body. [docs](https://www.courier.com/docs/reference/idempotent-requests)
- **Inbox UI.** `@trycourier/courier-react` (React 18+) exports `CourierInbox`, `CourierInboxPopupMenu`, `CourierToast`, `CourierPreferences` and a `useCourier()` hook. Theming via `CourierInboxTheme`; docs say you can "supply your own views while the SDK still manages messages, or build a custom UI on the low-level APIs". No Tailwind-specific guidance found. [inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview), [React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md)
- **Read state.** Owned by Courier: read, opened and archived sync across devices; unread counts and badges built in. [inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview)
- **Free tier.** Developer plan: 10,000 sends/month free. Next: Business, $0.005 per send, pay-as-you-go. Pricing page does not single out Inbox per tier. [pricing](https://www.courier.com/pricing)
- **Setup.** A send may carry inline `content` (Elemental) instead of a `template`; the Courier Inbox provider is preconfigured in the test and production environments. Routing must include `channels: ["inbox"]`. So one send should work with no dashboard objects, but the Inbox guide's own example uses a published template, and I found no worked inline-content-to-inbox example. Verify hands-on. [send overview](https://www.courier.com/docs/send/overview), [send to the inbox](https://www.courier.com/docs/in-app/send-to-the-inbox.md)
- **Local dev.** No self-host. Each workspace has separate test and production environments with their own keys. [send to the inbox](https://www.courier.com/docs/in-app/send-to-the-inbox.md)
- **Identity.** Backend calls `POST /auth/issue-token` with the API key and a scope starting `user_id:<id>` (plus `inbox:read:messages inbox:write:events`); client calls `signIn({ userId, jwt })`. Omitting `expires_in` mints a non-expiring token; SDKs do not refresh. [authenticate users](https://www.courier.com/docs/in-app/authenticate-users.md)
- **Live updates.** Real-time after calling `inbox.listenForUpdates()`; transport not documented. [React SDK](https://www.courier.com/docs/sdk-libraries/courier-react-web.md)
- **Preferences.** `CourierPreferences` component and preference scopes on the token. [inbox overview](https://www.courier.com/docs/platform/inbox/inbox-overview), [preference center](https://www.courier.com/docs/in-app/preference-center.md)
- **Server SDK.** `@trycourier/courier` (v7+), or plain HTTP. [send overview](https://www.courier.com/docs/send/overview)

### Knock

- **Dedup.** `Idempotency-Key` (max 255 chars), only on `POST /workflows/:key/trigger`; 24 h; replays the original response with `idempotent-replayed: true`; errors when parameters differ; caches only `2xx`. [docs](https://docs.knock.app/api-reference/overview/idempotent-requests)
- **Inbox UI.** `@knocklabs/react`: `KnockFeedProvider`, `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`; `renderItem` for custom cells; `--rnf-` CSS variables, and `rnf-` classes so the Knock CSS can be replaced entirely. Headless via `@knocklabs/client` / hooks. [React feed](https://docs.knock.app/in-app-ui/react/feed)
- **Read state.** Owned by Knock: seen (on popover open by default) and read via `feedClient.markAsRead`; badge can count unread. [React feed](https://docs.knock.app/in-app-ui/react/feed)
- **Free tier.** 10,000 messages/month. Next: Starter, $250/month for 50,000 then $0.005 each. [pricing](https://knock.app/pricing)
- **Setup.** A workflow must exist: the trigger's only required input is the workflow `key` in the path, and changes "go live when you publish them". Workflows can be managed as code with the Knock CLI or Management API. So: one workflow with an in-app feed step, plus an in-app feed channel, before the first send. [trigger](https://docs.knock.app/api-reference/workflows/trigger), [workflows](https://docs.knock.app/concepts/workflows)
- **Local dev.** No self-host; non-production environments, with promotion to production. [workflows](https://docs.knock.app/concepts/workflows)
- **Identity.** "By default, Knock feeds are accessible to anyone who has the feed ID." Enhanced security mode requires an RS256 JWT signed with your private signing key, `sub` = user id; production "should enable" it. [security](https://docs.knock.app/in-app-ui/security-and-authentication)
- **Live updates.** Real-time over sockets; optional cross-tab sync. [React feed](https://docs.knock.app/in-app-ui/react/feed)
- **Preferences.** PreferenceSets by workflow, category and channel; hosted or custom preference center. [preferences](https://docs.knock.app/concepts/preferences)
- **Server SDK.** `@knocklabs/node`, or plain HTTP. (Package name from Knock's SDK listing; not separately cited.)

### Novu (Cloud and self-hosted)

- **Dedup.** `Idempotency-Key` on `POST /v1/events/trigger`: 24 h for completed responses, 5 min for in-progress (409 with `Retry-After`), 422 on a different body. "Not enabled for all organizations"; ask support@novu.co. `transactionId` is a weaker fallback checked during processing, with retention that "depends on your billing tier". [idempotency](https://docs.novu.co/api-reference/idempotency), [trigger event](https://docs.novu.co/api-reference/events/trigger-event)
- **Inbox UI.** `@novu/react` (React 18+): `Inbox`, bell, notifications and preferences sub-components, headless hooks via `@novu/react` / `@novu/js`. Appearance elements take **Tailwind class names** directly, the best shadcn fit of the set. [inbox overview](https://docs.novu.co/platform/inbox/overview), [styling](https://docs.novu.co/platform/inbox/configuration/styling.md)
- **Read state.** Owned by Novu: read, snooze, real-time unread counts. [inbox overview](https://docs.novu.co/platform/inbox/overview)
- **Free tier.** 10,000 workflow runs/month; activity feed retention 24 h. Next: Pro from $30/month. [pricing](https://novu.co/pricing)
- **Setup.** Trigger requires `name` (workflow id) and `to`. The React quickstart creates a workflow with an In-App step in the dashboard before anything shows. Subscribers are auto-created on first sight. [trigger event](https://docs.novu.co/api-reference/events/trigger-event), [React quickstart](https://docs.novu.co/platform/quickstart/react.md)
- **Local dev.** Self-hosting has a one-command setup script that downloads the compose file, generates secrets and runs `docker compose up -d`. It starts API, worker, WS, dashboard, MongoDB and Redis, which is heavy for a dev loop. You would still create the workflow in the local dashboard. Novu warns the default layout is not production-ready. Whether idempotency keys work self-hosted is not documented. [self-host with Docker](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)
- **Identity.** `subscriberHash = HMAC-SHA256(secretKey, subscriberId)` as lowercase hex; when HMAC is enabled the Inbox will not load without it. Fits a cookie user id well. [prepare for production](https://docs.novu.co/platform/inbox/prepare-for-production.md)
- **Live updates.** Real-time (WS service on port 3002 when self-hosted). [inbox overview](https://docs.novu.co/platform/inbox/overview), [self-host](https://docs.novu.co/community/self-hosting-novu/deploy-with-docker)
- **Preferences.** Built into the Inbox: subscribers control workflows and channels; `Preferences` component. [inbox overview](https://docs.novu.co/platform/inbox/overview)
- **Server SDK.** Node SDK (`@novu/api`), or plain HTTP. (Package name not separately cited.)

### MagicBell

- **Dedup.** `Idempotency-Key` header, first response cached, expires after 24 h. The v2 docs describe it for creating notifications; I found no explicit statement for `POST /v2/broadcasts`. [REST API v2](https://www.magicbell.com/docs/api)
- **Inbox UI.** Several generations of packages: `@magicbell/react` (newer, `inbox`, `floating-inbox`), `@magicbell/magicbell-react` (older, MobX), and `@magicbell/react-headless` (`useNotifications`, `useBell`, `useNotification`). Which one is current was not clear from the docs. [react-headless](https://magicbell.com/docs/libraries/react-headless)
- **Read state.** Owned by MagicBell (`useBell` exposes `unreadCount`, `markAllAsSeen`). [react-headless](https://magicbell.com/docs/libraries/react-headless)
- **Free tier.** Builder: 1,000 deliveries/month. Next: Startup, $249/month for 50,000. [pricing](https://www.magicbell.com/pricing)
- **Setup.** Broadcasts need only `title` and `recipients`; no template field. Whether recipients are auto-created by `external_id` is not stated. [broadcast](https://www.magicbell.com/docs/primitive/broadcast)
- **Local dev.** No self-host or test mode found.
- **Identity.** HS256 user JWT signed with the project secret, claims `user_external_id` and/or `user_email` plus `api_key`. [user JWT](https://www.magicbell.com/docs/api/authentication/user)
- **Live updates.** Real-time module in the headless SDK (`dist/esm/lib/realtime.js`); transport not documented in the pages read.
- **Preferences.** Categories and topics feed user preferences. [broadcast](https://www.magicbell.com/docs/primitive/broadcast)
- **Server SDK.** `magicbell` npm package, or plain HTTP.

### SuprSend

- **Dedup.** `idempotency_key` (up to 255 chars); requests with the same key are skipped for 24 h. [idempotent requests](https://docs.suprsend.com/reference/idempotent-requests)
- **Inbox UI.** `@suprsend/react` with drop-in `Inbox`, `NotificationsFeed`, `Preferences`, plus a headless option. `@suprsend/react-inbox` is end of support. [React SDK](https://docs.suprsend.com/docs/react-sdk.md), [React inbox](https://docs.suprsend.com/docs/react-inbox-integration)
- **Read state.** Not confirmed in the pages read.
- **Free tier.** 10,000 notifications/month, inbox carries SuprSend branding. Next: Essentials, $100/month for 50,000, then $2 per 1,000. [pricing](https://www.suprsend.com/pricing)
- **Setup.** Even the "dynamic workflow" trigger requires a `template` slug "created on SuprSend dashboard". [dynamic workflow trigger](https://docs.suprsend.com/reference/dynamic-workflow-trigger)
- **Local dev.** No self-host or test mode found.
- **Identity.** ES256 JWT signed with a dashboard-generated key, payload `entity_type: "subscriber"`, `entity_id`, `exp`; enhanced security mode rejects requests without it. [client authentication](https://docs.suprsend.com/docs/client-authentication)
- **Live updates.** Not confirmed in the pages read.
- **Preferences.** `Preferences` drop-in and `user.preferences` client methods. [React SDK](https://docs.suprsend.com/docs/react-sdk.md)
- **Server SDK.** `@suprsend/node-sdk`. [Node trigger](https://docs.suprsend.com/docs/node-trigger-workflow-from-api)

## Shortlist

1. **Courier.** Best fit for "fire as often as you like": the only service whose dedup window can be set per send, up to a year, and the only one where a send can carry inline content with a preconfigured inbox provider (no workflow or template needed, pending a hands-on check). 10k free sends. Trade-offs: React inbox theming is its own theme object rather than Tailwind classes; inline-content-to-inbox needs proving; JWT expiry is on us.
2. **Novu Cloud.** Best UI fit: Tailwind class names on inbox elements, HMAC of the user id for identity, built-in preferences, cheapest paid tier ($30/month), and a one-command self-host as an escape hatch. Trade-offs: idempotency must be switched on by support and lasts 24 h; one dashboard workflow with an In-App step is required; self-host is a six-container stack.
3. **Knock.** Most polished feed and preference model, CSS fully replaceable, workflows manageable as code via CLI. Trade-offs: 24 h idempotency that errors on a changed body; one workflow plus feed channel required; feeds are open to anyone with the feed id until enhanced security (RS256 signing key) is on; first paid tier is $250/month.

Dropped: **MagicBell** (1,000 deliveries/month free, unclear which React package is current, idempotency not confirmed for broadcasts); **SuprSend** (dashboard template required even for dynamic triggers, branded free inbox, read state and live updates unconfirmed).

## Not verified from a primary source

- Courier: a worked example of inline content to the inbox with no template; transport for live updates; behaviour on same key with a different body; whether Inbox is in the free plan (pricing page does not say).
- Knock and Novu Node SDK package names (from general knowledge, not a page read here).
- Novu: whether idempotency keys work on self-hosted; any keyless or test mode.
- MagicBell: idempotency on `POST /v2/broadcasts`; recipient auto-creation; current React package.
- SuprSend: read/seen state and real-time transport.
- No candidate offers a one-docker-command local mode except Novu; the others rely on separate test/development environments in the cloud. The map's mailer pattern (log locally when there are no credentials) covers local dev for any of them.
