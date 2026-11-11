# What Knock's free plan includes, per Knock's own docs

Research for [#13](https://github.com/jeffsweep/cohort-005-project/issues/13), part of map [#6](https://github.com/jeffsweep/cohort-005-project/issues/6). Researched 2026-11-11 against knock.app/pricing, docs.knock.app and the `knocklabs/javascript` repo (commit `f3d845e`). Only primary sources. Prices and limits change; re-check before committing. Checking Jeff's actual account is [#11](https://github.com/jeffsweep/cohort-005-project/issues/11).

## Naming

The "Developer" plan has been renamed **Free**: "Knock offers a Free plan (formerly known as our Developer plan) and two paid plans, Starter and Enterprise. Most features are available across all three plans, with a small set reserved for Enterprise customers only." ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans))

## How gating was decided

Knock publishes an explicit list of Enterprise-only features ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans#enterprise-features)): per-tenant preferences and branding, per-tenant guides, translations (i18n), batch render limits beyond 10 items, custom permission groups, SAML SSO, directory sync, warehouse export, and the Datadog / New Relic / Segment / Heap extensions. The pricing comparison table adds Starter-only items (email client previews, removing Knock branding). Where a feature is neither on those lists nor marked on its own docs page as plan-gated, it is recorded as available on Free "by exclusion", which is weaker than a positive "Yes" row on the pricing table.

## Verdicts

| # | Item | Free plan? | Basis |
| --- | --- | --- | --- |
| 1 | `Idempotency-Key` dedup on workflow trigger | **Yes (by exclusion)** | Doc page has no plan restriction; not on Enterprise list |
| 2 | Enhanced security (RS256 user tokens) for in-app feeds | **Yes (by exclusion)** | Doc page has no plan restriction; not on Enterprise list |
| 3 | Batch function | **Yes**, with a cap | Pricing table: Batching = Yes on Free. Render limit beyond 10 items is Enterprise-only |
| 4 | Server-side withdrawal of a recipient's message | **Archive: Yes (by exclusion). Delete: No** (no endpoint exists on any plan) | Messages API reference |
| 5 | Workflows as code via Knock CLI | **Yes** | Pricing table: "Manage via API & CLI" = Yes on Free |
| 6 | Headless `@knocklabs/react-core` hooks | **Yes** | MIT open source; pricing table: "Bring your own components" and "Feed API" = Yes on Free |

### 1. Deduplication (`Idempotency-Key`)

- Source: [Idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests)
- Quote: "To perform an idempotent request, set an `Idempotency-Key` header on your request." / "Today, only `POST /workflows/:key/trigger` accepts the `Idempotency-Key` header".
- Window and behaviour: "If you retry a request with the same idempotency key within 24 hours from the original request" the original response is replayed; "Knock returns an error when incoming parameters don't match those from the original request"; "Knock only caches successful responses (`2xx`)."
- Plan: the page mentions no plan or tier. Not on the Enterprise list, not on the pricing table at all. **Yes (by exclusion).**
- Caveat for Cadence: the dedup lasts 24 hours, not forever. Same key after 24 h gives a second feed item.

### 2. Feed security (enhanced security mode, RS256)

- Source: [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication)
- Quote: "Production environments should enable **enhanced security mode**, which requires clients to send both the public API key and a signed user token that identifies the user that is performing the request." / "Your JWT will need to be signed against your **private signing key** using an **RS256** algorithm. The JWT must contain the `sub` claim".
- "Enhanced security mode is off by default".
- Plan: the page mentions no plan or tier; it is not on the Enterprise list. The pricing page's "Security & Support" section gates only custom roles and audit logs (Enterprise). **Yes (by exclusion).** No page positively states "available on Free".

### 3. Batching

- Source: [pricing](https://knock.app/pricing), comparison table row "Batching — Batch and digest notifications to reduce the frequency with which recipients receive your notifications." Free: **Yes**, Starter: Yes, Enterprise: Yes.
- Source: [Batch function](https://docs.knock.app/designing-workflows/batch-function): "A batch function collects notifications that have to do with the same subject, so you can send fewer notifications to your users." Batch window is configurable; "A batch function always captures events per `recipient`."
- Gated part: "The render limit setting for batch activities and actors is only available on our Enterprise plan." On Free, templates see at most the first or last 10 `activities` / `actors`; the batch itself can hold unbounded items ("A batch can support an unbounded number of items per recipient, although we will only ever return either the first 10 or last 10 items to be rendered in your template").
- For Cadence's "at most one new-lesson notification a day": a 1-day batch window works on Free; a digest listing more than 10 lessons does not.

### 4. Withdrawal (archive / delete from the server)

- Archive: [Archive message](https://docs.knock.app/api-reference/messages/archive) — "`PUT /v1/messages/{message_id}/archived`. Archives a message for the user. Archived messages are hidden from the default message list in the feed but can still be accessed and unarchived later." Bulk form: `POST /v1/messages/batch/archived` ([Messages overview](https://docs.knock.app/api-reference/messages)).
- Delete: the [Messages API overview](https://docs.knock.app/api-reference/messages) lists no delete endpoint. Its only `DELETE` routes undo state (`/seen`, `/read`, `/archived`). **No server-side delete exists on any plan** as far as the API reference shows.
- Plan: archive has no plan note; Messages API is not on the Enterprise list. **Archive: Yes (by exclusion).**
- Caveat: archive works per `message_id`. Cadence must find each Platform Admin's copy (e.g. via `GET /v1/messages` filtered by workflow/tenant, or by the recipient's message list) before archiving. Not verified end to end.

### 5. Workflows as code (Knock CLI)

- Source: [pricing](https://knock.app/pricing), row "Manage via API & CLI": Free **Yes**, Starter Yes, Enterprise Yes.
- Source: [Knock CLI](https://docs.knock.app/developer-tools/knock-cli): "Pull Knock workflows down to your local machine and work with your notification logic and templates in your code editor." / "Integrate Knock into your CI/CD pipeline to commit changes on release, and promote them between environments, if you've enabled them."
- Install: `npm install -g @knocklabs/cli` ([CLI overview](https://docs.knock.app/cli/overview)).

### 6. Headless React (`@knocklabs/react-core`)

- Source: [knocklabs/javascript `packages/react-core/package.json`](https://github.com/knocklabs/javascript/blob/f3d845ea50b56ed12447f42efada05c9285f8226/packages/react-core/package.json): `"name": "@knocklabs/react-core"`, `"version": "0.17.1"`, `"license": "MIT"`, peer dep `"react": "^17.0.0 || ^18.0.0 || ^19.0.0"`. React 19 is supported.
- Hooks: [`feed/hooks/index.ts`](https://github.com/knocklabs/javascript/blob/f3d845ea50b56ed12447f42efada05c9285f8226/packages/react-core/src/modules/feed/hooks/index.ts) exports `useNotifications`, `useFeedSettings`, `useNotificationStore`, `useCreateNotificationStore`.
- Real-time: [`useNotifications.ts`](https://github.com/knocklabs/javascript/blob/f3d845ea50b56ed12447f42efada05c9285f8226/packages/react-core/src/modules/feed/hooks/useNotifications.ts) calls `knock.feeds.initialize(feedChannelId, options)` then `feedClient.listenForUpdates();`.
- Read state: the returned `Feed` (from `@knocklabs/client`, [`feed.ts`](https://github.com/knocklabs/javascript/blob/f3d845ea50b56ed12447f42efada05c9285f8226/packages/client/src/clients/feed/feed.ts)) has `async markAsRead(itemOrItems)`, `async markAllAsRead()`, `markAsArchived`, `markAllAsArchived`.
- Docs: [headless feed](https://docs.knock.app/in-app-ui/react/headless/feed) — "Using our `@knocklabs/react` and `@knocklabs/client` libraries, you can create fully custom notification UIs that are backed by the Knock Feed API and real-time service." The docs import the same hooks from `@knocklabs/react` (which re-exports react-core); they don't name `react-core` directly.
- Plan: the SDK is MIT and the pricing table rows "Bring your own components", "Pre-built components" and "Feed API" are all Yes on Free. **Yes.**

## Free plan limits

All from the [pricing](https://knock.app/pricing) comparison table unless noted.

| Limit | Free | Quote |
| --- | --- | --- |
| Messages / month | up to 10,000 | "Messages sent — A single message delivered to a single user on a single channel. Messages that bounce or fail to send are not included." |
| Over the limit | no hard cap | "We don't hard cap your messages. … If you go over your limit, we'll get in touch with you about making sure you have a billing method in place next month." |
| Environments | Unlimited | "Isolated environments — Create as many environments as you need to map to your development lifecycle." Accounts start with production only; "Enabling environments adds a development environment below production" ([environments](https://docs.knock.app/version-control/environments)) |
| Seats | Unlimited | "Team members — A team member is anyone with login access to your account." |
| Log retention | 30 days | "Log retention — 30-day retention" (Enterprise: 90) |
| Feed retention | Unlimited | "The number of days a message stays in your users' feeds. No limit, but can be configured." |
| Feeds per recipient | Unlimited | "Create as many in-app channels as you need." |
| Guide recipients | up to 500 | not relevant to Cadence |

Metering note ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans#message-counts)): "A message is counted each time a notification is successfully delivered to a single user on a single channel." "Regardless of plan, usage may be accrued in any Knock environment" — dev and test sends count. "The in-app channel doesn't support sandbox mode"; use channel conditions in non-production environments.

## Gated to paid tiers (relevant to Cadence)

- Batch render limit beyond 10 items — Enterprise.
- Removing Knock branding from the feed UI — Starter and up ("Remove Knock branding": Free No).
- Translations (i18n), per-tenant preferences and branding — Enterprise.
- Custom roles, audit logs, SAML SSO, 90-day log retention — Enterprise.

## Unclear / check by hand in the account (#11)

- **Enhanced security mode** and **idempotency** are Free only by exclusion. Confirm the "enhanced security mode" toggle is present and enableable on a Free-plan environment, and that a repeat trigger with the same `Idempotency-Key` returns `idempotent-replayed: true`.
- **Archive via secret key from the server**: the endpoint is documented without plan notes, but not tested. Confirm a server-side archive removes the item from the recipient's default feed.
- **No delete endpoint** was found; if Cadence needs true deletion, ask Knock support.
- Whether Free-plan feeds show Knock branding in the pre-built components only, or also affect headless use (likely not, since headless renders no Knock UI, but not stated).
