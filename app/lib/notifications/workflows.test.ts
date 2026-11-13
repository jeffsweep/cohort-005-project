import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS, type NotificationKind } from "./catalogue";
import { generateWorkflows } from "./workflows";

const passThrough: NotificationKind = {
  key: "enrolled",
  name: "Enrolled",
  label: "someone enrolls on my course",
  group: "My courses",
  alwaysOn: false,
  batched: false,
};

const inAppStep = {
  ref: "in_app_feed_1",
  name: "In-app feed",
  type: "channel",
  channel_key: "in-app",
  template: {
    markdown_body: "{{ data.message }}",
    action_url: "{{ data.url }}",
  },
};

describe("generateWorkflows", () => {
  it("generates one workflow per kind in the catalogue", () => {
    expect(generateWorkflows(NOTIFICATION_KINDS).map((w) => w.key)).toEqual(
      NOTIFICATION_KINDS.map((kind) => kind.key)
    );
  });

  it("makes a pass-through workflow with one in-app channel step", () => {
    expect(generateWorkflows([passThrough])).toEqual([
      {
        key: "enrolled",
        workflow: {
          $schema: "https://schemas.knock.app/cli/workflow.json",
          name: "Enrolled",
          steps: [inAppStep],
        },
      },
    ]);
  });

  it("batches a batched kind per course for a day, on the latest workflow version", () => {
    const [{ workflow }] = generateWorkflows([
      { ...passThrough, key: "lesson-added", batched: true },
    ]);

    expect(workflow.steps).toEqual([
      {
        ref: "batch_1",
        name: "Batch per course",
        type: "batch",
        settings: {
          batch_key: "data.courseId",
          batch_window_type: "fixed",
          batch_window: { unit: "days", value: 1 },
          batch_order: "asc",
          batch_execution_mode: "accumulate",
          workflow_version_mode: "latest",
        },
      },
      inAppStep,
    ]);
  });

  it("overrides preferences only for always-on kinds", () => {
    const [alwaysOn, mutable] = generateWorkflows([
      { ...passThrough, key: "refund-approved", alwaysOn: true },
      passThrough,
    ]);

    expect(alwaysOn.workflow.settings).toEqual({ override_preferences: true });
    expect(mutable.workflow).not.toHaveProperty("settings");
  });
});
