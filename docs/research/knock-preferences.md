# What Knock's per-user preferences support on Free, per Knock's own docs

Research for [#17](https://github.com/jeffsweep/cohort-005-project/issues/17), part of map [#6](https://github.com/jeffsweep/cohort-005-project/issues/6). Builds on [#13](https://github.com/jeffsweep/cohort-005-project/issues/13) (branch `research/knock-free-plan`, `docs/research/knock-free-plan.md`), which is not repeated here. Researched 2026-11-12 against docs.knock.app (the `.md` versions of each page), knock.app/pricing and the `knocklabs/javascript` repo (commit `f3d845e`, `@knocklabs/react-core` 0.17.1). Only primary sources. Anything marked **inference** is my reading of the docs, not a statement in them.

## Plan gating

- **Preferences are a positive "Yes" on Free.** Pricing table row: "Preferences — Manage user preferences for your channels, notifications, and categories. | Yes | Yes | Yes" ([pricing](https://knock.app/pricing)).
- **Per-tenant preferences are Enterprise-only (confirmed).** Pricing row "Per-tenant preferences … No | No | Yes"; the docs page carries the callout "Per-tenant user preferences and tenant preference defaults are only available on our Enterprise plan" ([per-tenant preferences](https://docs.knock.app/multi-tenancy/per-tenant-preferences)); it is first on the Enterprise list ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans#enterprise-features)).
- Environment defaults, preference conditions, the Management API defaults endpoint, the hosted preference center and the workflow "override preferences" setting carry no plan note and are not on the Enterprise list: **Free by exclusion** (same standard as #13).
- Muted sends are free: "If the same trigger resulted in zero messages being sent (say because of a given user's messaging preferences,) you wouldn't be charged." ([pricing FAQ](https://knock.app/pricing))

## Verdicts

| # | Question | Answer | Source |
| --- | --- | --- | --- |
| 1 | Mute by workflow | **Yes**: `workflows: { "<workflow-key>": false }`, or per channel type / channel inside it | [overview](https://docs.knock.app/preferences/overview) |
| 2 | Mute by category | **Yes**: `categories: { "<cat>": false }`. Categories are set on the workflow (`categories` array in `workflow.json`) | [overview](https://docs.knock.app/preferences/overview), [workflow schema](https://docs.knock.app/mapi-reference/workflows/schemas/workflow) |
| 3 | Mute by channel type | **Yes**: `channel_types: { in_app_feed: false }`; types are `email`, `sms`, `push`, `chat`, `in_app_feed`, `http` | [EnvironmentDefaultsPreferenceSet](https://docs.knock.app/mapi-reference/environments/defaults/schemas/environment_defaults_preference_set) |
| 4 | Mute by channel | **Yes**, but keyed by the channel's **UUID**, not its key (`in-app`) | [overview](https://docs.knock.app/preferences/overview#channels-vs-channel-types) |
| 5 | Environment defaults | **Yes**, dashboard or **Management API** `PUT /v1/environments/{slug}/defaults`. **No CLI command.** Not committed or promoted; takes effect immediately; replaces in full | [custom preference center](https://docs.knock.app/preferences/custom-preference-center), [MAPI upsert](https://docs.knock.app/mapi-reference/environments/defaults/update) |
| 6 | Workflow-level defaults | **No separate concept.** A per-workflow default is a `workflows.<key>` entry in the environment default set. The only per-workflow preference setting is `settings.override_preferences` (ignore preferences entirely), which *is* in `workflow.json` and so goes through the CLI | [MAPI upsert example](https://docs.knock.app/mapi-reference/environments/defaults/update), [workflow schema](https://docs.knock.app/mapi-reference/workflows/schemas/workflow) |
| 7 | Browser with RS256 user token reads/writes own preferences | **Yes, directly.** `GET`/`PUT /v1/users/:id/preferences/:id` are public-key endpoints; grants `preferences/read`, `preferences/write`. No server round trip required | [security](https://docs.knock.app/in-app-ui/security-and-authentication) |
| 8 | Headless React hook | **Yes**: `usePreferences` in `@knocklabs/react-core` (re-exported by `@knocklabs/react`), SWR-backed | [source](https://github.com/knocklabs/javascript/blob/main/packages/react-core/src/modules/preferences/hooks/usePreferences.ts), [hook docs](https://docs.knock.app/in-app-ui/react/sdk/hooks/use-preferences) |
| 9 | Muted send: dropped or kept? | **Dropped.** The channel step is *skipped*; no message, no feed item, no charge. Not held for later | [channel step](https://docs.knock.app/designing-workflows/channel-step#channel-step-execution), [debugging](https://docs.knock.app/send-notifications/debugging-workflows) |
| 10 | With batch steps | Preferences are checked when the **channel step runs**, i.e. after the batch window closes (**inference** from step order). Preference *conditions* are evaluated only against the **first activity** in the batch (stated) | [channel step](https://docs.knock.app/designing-workflows/channel-step#channel-step-execution), [conditions](https://docs.knock.app/preferences/preference-conditions) |
| 11 | With `Idempotency-Key` | No interaction documented. A muted run is still a 2xx trigger, so a retry within 24 h replays it and does **not** resend after an unmute (**inference**) | [idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests) |
| 12 | Per-tenant preferences | **Enterprise only** (confirmed) | [Knock plans](https://docs.knock.app/manage-your-account/knock-plans#enterprise-features) |

## Details

### The PreferenceSet model (1–4)

Source: [Preferences overview](https://docs.knock.app/preferences/overview).

- "A preference set is built using four keys: `categories`, `channels`, `channel_types`, `workflows`. These keys resolve to boolean values to determine if a user has opted out of receiving a notification."
- `workflows` and `categories` entries can be a boolean or nest `channel_types` / `channels` / `conditions`, so a grid "kind × channel type" is expressible: `workflows: { "invoice-issued": { channel_types: { email: true } } }`.
- Default is opt-in: "If you do not set a preference for a given channel, workflow, or workflow category, Knock defaults them to `true`."
- Conflict rules: "Knock only sends a notification if all preference combinations that exist on the recipient evaluate to `true`." "A workflow can belong to multiple `categories`. Only one of those category preferences needs to evaluate to `false` for the notification not to send." "If a workflow's `category` is set to `false`, the notification will not send even if a `channel_type` or `channel` on the workflow is explicitly set to `true`." "Channel preferences take precedence over channel type preferences."
- Channels vs channel types: "Channel preferences (`channels`) control specific channel instances using their UUID identifiers." So per-channel muting of Cadence's `in-app` channel needs its UUID (visible via `knock channel list`), not the key. With one in-app channel, `channel_types.in_app_feed` covers the same ground.
- Categories: "Categories are useful for grouping related types of workflows together and offer a way to apply a user's preferences across many workflows." They are "case sensitive" ([workflows](https://docs.knock.app/concepts/workflows#workflow-categories)). The docs describe setting them in the dashboard, but `categories` is a field of the workflow object that `workflow.json` follows ([CLI file structure](https://docs.knock.app/cli/workflow/file-structure): "Each `workflow.json` file should follow the structure defined [here](/mapi-reference/workflows/schemas/workflow)"), so they can be set in code and pushed with the CLI.
- Preference conditions (per-resource muting, e.g. "mute notifications about this task"): a `conditions` array on any entry, e.g. `recipient.muted_dinos not_contains data.dino`. Can be set "from your application with a public API key and signed user token" ([preference conditions](https://docs.knock.app/preferences/preference-conditions)).
- Overriding for must-send workflows: enable "Override recipient preferences" on the workflow; "the workflow will send to all of its channels, regardless of the recipient's preferences." In the workflow object this is `settings.override_preferences: true`.

### Defaults (5–6)

- Environment default: "Any user who doesn't have a preference set of their own will use these environment defaults." Dashboard: Platform > Preferences. "Each environment has its own default preferences." ([custom preference center](https://docs.knock.app/preferences/custom-preference-center#create-environment-level-default-preferences))
- Programmatic: "To manage environment defaults programmatically, use the Management API to get or update an environment's default preference set. An update replaces the existing set in full and takes effect immediately in the target environment, including production. It isn't committed or promoted." ([same page](https://docs.knock.app/preferences/custom-preference-center)). Endpoint: `PUT /v1/environments/{environment_slug}/defaults` with `{ "preference_set": … }`; "concurrent writes are last-write-wins"; `null` clears ([MAPI upsert](https://docs.knock.app/mapi-reference/environments/defaults/update)). `__persistence_strategy__` and `__strategy__` "are not supported, because defaults are always replaced in full" ([schema](https://docs.knock.app/mapi-reference/environments/defaults/schemas/environment_defaults_preference_set)).
- CLI: the full CLI command list (environment, channel, branch, workflow, email-layout, translation, partial, reusable-request, schema, commit, guide, message-type, audience, goal, variable, asset, source, warehouse, warehouse-sync) has **no preferences or defaults command** ([docs index](https://docs.knock.app/llms.txt)). So `knock workflow push --all --commit` cannot carry defaults; a small script calling the MAPI with the service token can.
- Merge: the user's own `default` set wins over the environment default, key by key ("Any preferences that are set in both places will keep the value from the recipient's `default` preference set"). Reading preferences returns the merged result: "If the user hasn't set any preferences of their own, `getPreferences()` returns the environment default set" ([custom preference center](https://docs.knock.app/preferences/custom-preference-center)).
- Workflow-level defaults: none of the pages fetched describe a per-workflow default preference distinct from the environment set. The MAPI example shows the per-workflow default living inside the environment set: `"workflows": { "new-comment": { "channel_types": { "push": false } } }`.

### Browser access with enhanced security (7)

Source: [Security and authentication](https://docs.knock.app/in-app-ui/security-and-authentication).

- The "Public API key endpoints" table lists `GET /v1/users/:id/preferences`, `GET /v1/users/:id/preferences/:id` and `PUT /v1/users/:id/preferences/:id`, plus `GET /v1/users/:id/preference_center/config`.
- With enhanced security on, "Knock will reject requests from the client using your public API key that do not include a signed user token". The token is RS256 with `sub` = user id.
- Grants: `preferences/read` ("Allow the token to read the user's preferences.") and `preferences/write` ("Allow the token to write to the user's preferences."). "Without this option [`explicit_grants`], the token will be granted access to all resources by default."
- The custom-preference-center guide shows exactly this from the browser: `knockClient.authenticate({ id: user.id }, userToken); await knockClient.user.getPreferences(); await knockClient.user.setPreferences({...})`.
- Consequence (**inference**): the user can write anything into their own set from devtools, including un-muting. That only affects their own notifications. If Cadence must enforce a send regardless (a must-deliver kind), use `override_preferences` on that workflow rather than trusting the UI to hide the toggle.

### Headless React (8)

Source: `packages/react-core/src/modules/preferences/hooks/usePreferences.ts` and `packages/client/src/clients/users/index.ts` at `f3d845e`.

- `usePreferences({ preferenceSet?, tenant? })` returns `{ preferences, setPreferences, getAllPreferences, isLoading, isValidating }`. Fetch is SWR keyed on `["preferences", preferenceSet, tenant, userId]`; it only fetches once `knock.userId` is set.
- `setPreferences(props)` calls `knock.user.setPreferences(props, { preferenceSet })` → `PUT /v1/users/{userId}/preferences/{set}` and writes the response into the SWR cache (`revalidate: false`). It returns `void`, so the caller cannot await it or catch an error. It drops the `tenant` option (irrelevant without Enterprise).
- The PUT **replaces** the whole set by default ("By default, `setPreferences` replaces any existing `PreferenceSet`, so include the complete set in your request", [custom preference center](https://docs.knock.app/preferences/custom-preference-center)). The client's `SetPreferencesProperties` type has only `workflows`, `categories`, `channel_types`, `channels`, so `__persistence_strategy__: "merge"` is not in the TypeScript type (it would need a cast). Practical pattern: spread the current `preferences` and change one key.
- `PreferenceSet` type: `{ id, categories, workflows, channel_types, channels }`, each a map or `null`. The [hook docs](https://docs.knock.app/in-app-ui/react/sdk/hooks/use-preferences) example (`preferences.workflows.map(...)`, `{ enabled }`) does not match these types; trust the source.
- There is also a tutorial that hand-builds a `PreferenceCenter` component on `@knocklabs/client` ([React preferences](https://docs.knock.app/in-app-ui/react/preferences)); it is example code, not a shipped component.

### Muted sends, batch and idempotency (9–11)

- Order of a channel step: "1. Runs through any step conditions … 2. Checks the recipient has the information required … 3. Checks the recipient's preferences to see if they have opted out … 4. Checks the channel's send windows". "If the step continues, Knock will render the template … and enqueue a message" ([channel step](https://docs.knock.app/designing-workflows/channel-step#channel-step-execution)). Preferences are checked per channel step, not once at trigger.
- On opt-out the step is **skipped**: "Recipient preferences opt out. If the recipient has set preferences that opt them out of this notification type or channel, the step is skipped." ([debugging workflows](https://docs.knock.app/send-notifications/debugging-workflows)). No message is created, so nothing reaches the feed and nothing is billed. Nothing documents holding a skipped message for later delivery; un-muting does not backfill.
- Batch: the batch function page says nothing about preferences ([batch](https://docs.knock.app/designing-workflows/batch-function)). Because the batch step comes before the channel step, the in-app step runs (and checks preferences) when the batch closes. **Inference:** a user who mutes mid-window gets nothing for that batch; one who un-mutes before it closes gets the whole batch. Stated caveat for conditions only: "When using a batch function, preference conditions for subsequent channel steps will only be evaluated against the first activity in the batch" ([conditions](https://docs.knock.app/preferences/preference-conditions)), so per-resource conditions on `data.*` are unreliable in batched workflows.
- Idempotency: the idempotency page does not mention preferences ([idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests)). The key dedups the trigger request; preferences act later, at the channel step. **Inference:** a trigger for a muted user returns 2xx and is cached, so retrying the same key within 24 h replays it and still produces no message, even if the user un-muted in between.

## Implications for #18 ("What can a person mute, and where do the settings live?")

- With one workflow per Notification kind, "mute this kind" is `workflows.<kind-key>: false` and needs nothing else. "Mute a group of kinds" needs workflow `categories`, which can live in `workflow.json` and be pushed with the CLI.
- Muting the in-app channel as a whole (`channel_types.in_app_feed: false`) is possible but would empty the feed; with only an in-app channel it is the same as muting everything.
- Settings live in Knock, not Cadence's DB, and the browser can read and write them directly with the signed token. Cadence does not need its own preferences table or API route unless it wants an audit trail or server-side validation.
- Defaults that differ from "everything on" go in the environment default set via the Management API (script or dashboard), not via `knock workflow push`. They are per-environment and uncommitted, so they are not versioned with the workflows.
- A muted notification is gone, not deferred. If a kind must never be missed, mark that workflow `override_preferences` and do not offer a toggle.
- Per-tenant (per-team or per-organisation) defaults and locks are Enterprise-only; on Free only per-user sets plus one environment default.

## Unclear / check by hand (#11)

- That a Free-plan Development environment shows Platform > Preferences and accepts `PUT /v1/environments/development/defaults` with the service token.
- Whether `categories` and `settings.override_preferences` round-trip through `knock workflow pull`/`push` (they are in the MAPI workflow schema, but not confirmed by a push).
- Batch timing (checked at close, not at first trigger): confirm in the workflow debugger by muting mid-window.
- Idempotent replay of a muted trigger after un-muting.
