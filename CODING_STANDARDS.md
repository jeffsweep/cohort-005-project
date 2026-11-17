# Coding standards

These are the judgement calls a reviewer makes from a diff. Anything a tool
can check lives in `npm run check`, not here.

## Wrap related writes in a transaction

Two writes that must both land, or neither, go in a transaction. If the second
one fails and the first stayed, you have invented a state nothing knows how to
read. (The refund bug: the refund was approved, the enrollment was never
ended, and the learner kept the course.)

## Check permission in the action, not only the loader

A loader guard does not protect an action. They are separate requests. For a
week anybody who was signed in could approve a refund by posting to
`/admin/refunds`.

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Derive, do not store

If a value can be worked out from another value you already hold, work it out.
Storing it gives you two things that must agree, and one day they will not.

```ts
// Bad
const [items, setItems] = useState(rows);
const [count, setCount] = useState(rows.length);

// Good
const [items, setItems] = useState(rows);
const count = items.length;
```

## Prefer composition to configuration

A function that takes a `mode` flag and branches on it is two functions that
have not been separated yet. The same goes for a component with a `variant`
prop that changes what it renders rather than how it looks.

## Soft-delete anything a person can point at

If another row references it, or a person has a link to it, do not delete it.
Mark it deleted and filter it out on read. Deleting a lesson used to take the
learners' notes and bookmarks with it.

## Paginate anything that can grow

A query with no limit is fine on a seeded database and fatal on a real one.
If the row count is a function of how long the product has been alive, add a
limit. The instructor's students page timed out on the first big course.

## Never mutate a value you were handed

Take a copy, change the copy, hand the copy back. A caller that passed you
something does not expect to find it different afterwards.

## Status strings are enums in the schema

A status string that the code compares against is an enum in
`app/db/schema.ts`, not a literal repeated in six places. Refund status was
`"pending"` in four files and `"Pending"` in one.

## Comments say why, not what

Name and extract until a comment is unnecessary. A comment earns its place
only for a _why_ the code cannot express: a constraint, a decision, a link to
the ADR behind it. A comment that restates _what_ the code does goes stale the
first time the code changes. Commented-out code is deleted; git has it.

## Split a component when it grows a second reason to change

A component that both fetches and lays out is two components. Pull the layout
out and pass it what it needs.

## Catch the narrowest thing you can

A bare `catch` that swallows everything hides the bug you are about to spend
a day on.

## Tests describe behaviour

- Name a test for the behaviour, not the function: `"refuses a refund after
the window closes"`, not `"refund test 3"`.
- Do not mock what you own. Use the real module.
- Keep the fixture close to the test. A shared fixture that every test bends
  is worse than a little duplication.

## A change does one thing

If the title needs an "and", it is two changes.
