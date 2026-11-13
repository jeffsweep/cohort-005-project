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

  it("uses a kind's own template in place of the message when it has one", () => {
    const [{ workflow }] = generateWorkflows([
      { ...passThrough, markdownBody: "{{ total_activities }} new things" },
    ]);

    expect(workflow.steps).toEqual([
      {
        ...inAppStep,
        template: {
          markdown_body: "{{ total_activities }} new things",
          action_url: "{{ data.url }}",
        },
      },
    ]);
  });

  it("writes the lesson-added sentence from the batch's total count", () => {
    const lessonAdded = generateWorkflows(NOTIFICATION_KINDS).find(
      (w) => w.key === "lesson-added"
    );

    expect(lessonAdded?.workflow).toEqual({
      $schema: "https://schemas.knock.app/cli/workflow.json",
      name: "Lesson added",
      steps: [
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
        {
          ...inAppStep,
          template: {
            markdown_body:
              "{{ total_activities }} new {% if total_activities == 1 %}lesson{% else %}lessons{% endif %} on {{ data.courseTitle }}",
            action_url: "{{ data.url }}",
          },
        },
      ],
    });
  });

  it("overrides preferences only for always-on kinds", () => {
    const [alwaysOn, mutable] = generateWorkflows([
      { ...passThrough, key: "refund-approved", alwaysOn: true },
      passThrough,
    ]);

    expect(alwaysOn.workflow.settings).toEqual({ override_preferences: true });
    expect(mutable.workflow).not.toHaveProperty("settings");
  });

  it("makes Knock ignore mutes only for refund outcomes and role changes", () => {
    const ignoringMutes = generateWorkflows(NOTIFICATION_KINDS)
      .filter(({ workflow }) => workflow.settings?.override_preferences)
      .map(({ key }) => key);

    expect(ignoringMutes).toEqual([
      "refund-approved",
      "refund-declined",
      "role-changed",
    ]);
  });
});
