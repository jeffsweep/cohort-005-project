import type { NotificationKind } from "./catalogue";

// ─── Knock workflow generator ───
// Turns the catalogue into one Knock workflow definition per kind, in the
// format the Knock CLI reads from knock/workflows/<key>/workflow.json.
// `npm run knock:sync` (scripts/knock-sync.ts) writes and pushes them.

type Step = Record<string, unknown>;

export type WorkflowDefinition = {
  $schema: string;
  name: string;
  settings?: { override_preferences: true };
  steps: Step[];
};

export type GeneratedWorkflow = { key: string; workflow: WorkflowDefinition };

function inAppStep(markdownBody = "{{ data.message }}"): Step {
  return {
    ref: "in_app_feed_1",
    name: "In-app feed",
    type: "channel",
    channel_key: "in-app",
    template: {
      markdown_body: markdownBody,
      // Knock requires an action_url on in-app steps.
      action_url: "{{ data.url }}",
    },
  };
}

const batchPerCourseStep: Step = {
  ref: "batch_1",
  name: "Batch per course",
  type: "batch",
  settings: {
    batch_key: "data.courseId",
    batch_window_type: "fixed",
    batch_window: { unit: "days", value: 1 },
    batch_order: "asc",
    batch_execution_mode: "accumulate",
    // Without this, a re-sync during an open batch starts a second batch.
    workflow_version_mode: "latest",
  },
};

export function generateWorkflows(
  kinds: readonly NotificationKind[]
): GeneratedWorkflow[] {
  return kinds.map((kind) => ({
    key: kind.key,
    workflow: {
      $schema: "https://schemas.knock.app/cli/workflow.json",
      name: kind.name,
      ...(kind.alwaysOn && { settings: { override_preferences: true } }),
      steps: kind.batched
        ? [batchPerCourseStep, inAppStep(kind.markdownBody)]
        : [inAppStep(kind.markdownBody)],
    },
  }));
}
