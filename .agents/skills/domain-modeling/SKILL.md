---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when discussing codebase terminology, writing, editing, auditing or pruning a GLOSSARY.md, or recording, editing or pruning ADRs.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `GLOSSARY.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

Most repos have a single context:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `GLOSSARY-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Create files lazily: only when you have something to write. If no `GLOSSARY.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

## Before the first question: audit what exists

When the session will review, prune or build on an existing `GLOSSARY.md` or `docs/adr/`, find the facts first, for every entry, not just the ones that look wrong. Spot-checking leaves wrong entries in place and turns fact-finding into questions for the user.

Send a sub-agent to check each glossary term:

- **Domain or implementation?** A concept of this business, or code and general programming (tables, columns, components, framework words)?
- **Which word does the product use?** Count the term and its rivals across code and UI. Never mint or confirm a term without the counts.
- **Does the definition match what the code does?** Read the code behind each kept term, not just whether the word exists.

And each ADR, giving every one a verdict with a `file:line` to back it: **matches the code**, **stale** (the code has moved on, or now does a rejected option), or **unverified**. No ADR goes into a round without a verdict.

Then each round puts only decisions to the user: keep or cut, which word wins, what the business promises. Put the facts in the question.

## During the session

### Grill the business rules, not the storage

Reading the schema pulls questions toward tables and columns. Pull them back to what the business promises: who keeps, loses or gets back what, and when.

- **Scenarios before schema.** Before any question about storage, walk through named personas, one for each kind of actor and purchase in the code (bought for yourself, bought for others, claimed by someone else). Ask what happens to each of them at every step.
- **Ask who loses.** For each decision, ask who loses money or access if it's wrong, and whether they'd notice. Ask it of technology choices too: a database or concurrency choice can be what quietly enforces a business rule.
- **Confusion is a cue.** When a sentence is hard to say, or a word means two things in the code (an "admin" or a "team"), stop and test scenarios. Then mint the glossary terms that pull the two meanings apart.

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `GLOSSARY.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update GLOSSARY.md inline

When a term is resolved, update `GLOSSARY.md` right there. Don't batch these up: capture them as they happen. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` should be totally devoid of implementation details. Do not treat `GLOSSARY.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse**: the cost of changing your mind later is meaningful
2. **Surprising without context**: a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off**: there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

List the business-rule decisions and the storage decisions separately, and apply the three tests to each list. A decision about people's money or access usually passes.

When a recommendation would change an existing ADR, follow [ADR-FORMAT.md](./ADR-FORMAT.md)'s rules for changing one, and say in the recommendation what it costs: a new number, a deleted file, a link that now points elsewhere.
