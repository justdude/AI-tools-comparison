# Repository instructions

These apply to every request, in every surface: Copilot in VS Code and Visual Studio, the GitHub
cloud agent, and Claude Code. They are deliberately short — the detailed, per-stack rules live in
the skill files under `.github/skills/` and `.claude/skills/`, which are read automatically when
their description matches the task.

## Before writing any code

Read the skill for the stack you are working in. If a skill exists for it, its rules win over any
habit or default you would otherwise apply. If the brief and the skill disagree, follow the skill
and say so.

## Definition of done

Done means the gates pass, not that the code looks finished. Run them and paste the output:

```
bash scripts/verify.sh <app-folder>          # or: powershell -File scripts/verify.ps1 <app-folder>
```

Never report success without having run them.

## Things that are never acceptable

* Suppressing a warning to get past a gate — no `#pragma`, no `eslint-disable`, no
  `<NoWarn>`. Either fix the code, or relax the rule in `.editorconfig` in its own commit with a
  comment explaining why.
* Weakening or deleting a test so a build goes green.
* `as any`, `: any`, `@ts-expect-error`, or `!` to silence the type checker.
* A lint gate without `--max-warnings 0`. A bare `eslint .` exits 0 on warnings and is not a gate.
* Committing a licence key, a token or a `.env.local`.
* Loading a full dataset client-side for anything that can grow. Server-side paging, always.

## Repository conventions

* One test project per source project, and tests run headless in CI.
* Architecture decisions go in `docs/adr/`, one file per decision — not in a commit message.
* Exact version pins stay exact. If you need to bump one, do it in its own commit and re-run every
  gate.
* Do not add dependencies that the brief did not ask for.

## When something is wrong

Put the fix in the skill file, not in your reply. A reply fixes one run; a rule fixes every run
after it.
