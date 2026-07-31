# 1. Record architecture decisions in this folder

Date: 2026-07-31
Status: accepted

## Context

An agent makes a lot of small structural choices in one session — which library, which folder, why
the store is separate from the component. Those choices end up in code that looks arbitrary six
weeks later, and the reasoning is gone: it was in a chat transcript nobody kept, or in a commit
message nobody reads.

This bites harder with an agent than with a person, because the agent has no memory between
sessions. Next week it will reopen the same question and may answer it differently.

## Decision

Every decision that would be expensive to reverse gets one file in `docs/adr/`, numbered, with the
same four headings as this one: Context, Decision, Consequences, and a Status.

The agent writes it as part of the work, not afterwards. `.github/copilot-instructions.md` says so,
so every surface picks it up.

## Consequences

* A reviewer can ask "why is this like this?" and get an answer without archaeology.
* The next agent session reads `docs/adr/` and inherits the reasoning instead of re-litigating it.
* One more file per decision. That is the cost, and it is small.
* An ADR is never edited to change its decision. It gets a new ADR that supersedes it, and the old
  one's Status becomes `superseded by 000N`.
