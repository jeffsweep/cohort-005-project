# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.

## Comments say why, not what

A comment earns its place by saying something the code cannot: a reason, a
constraint, a gotcha. Name the function or variable instead of narrating
what the next lines do.

## Name a condition with three or more parts

When an `if` joins three or more checks, pull it into a named function or
variable that says what it asks. An inline
event handler with such a condition becomes a named handler.

## Database writes take one object of named values

A service function that writes takes `db` first, then one object:
`saveNote(db, { userId, lessonId, body, now })`. Two ids side by side are
easy to swap; named fields are not.

## A new foreign key says what happens on delete

Every new `.references()` sets `onDelete`. Decide whether the row goes with
its parent (`"cascade"`) or blocks the delete, and write it down, so deleting
a Lesson or a User never fails on rows nobody thought about.
