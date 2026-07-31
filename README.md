# Run one agent iteration — start here

This folder is a **ready-to-use repository**. It contains no application code. What it contains is
everything an AI coding agent needs to build one, the same way twice:

* **skills** — the rules the agent must obey, read automatically on every run
* **prompts** — the brief for each app, pasted once
* **gates** — the commands that decide whether the work is actually finished

You do not need to write code, and you do not need to use a terminal. Pick one of the three ways
below, follow the numbered steps, and you will end up with a working application and four numbers
to write down.

**Time:** 20–60 minutes for the first run, most of it waiting.

---

## 1. Pick the app you can actually build

| # | App | Needs installed | Recommended |
| - | --- | --- | --- |
| 1 | **Orders screen — React + DevExtreme DataGrid** | Node 22.13+ (or 20.19+) | **Start here.** Verified end to end — see `VERIFIED.md`. |
| 2 | The same grid, in Angular | Node 22.13+ and .NET 10 SDK | Only if you want the Angular comparison. |
| 3 | AssetTracker — WPF desktop app | .NET 10 SDK, Windows | Windows only. |
| 4 | Weather API — .NET minimal API | .NET 10 SDK | Good second run; no API key needed. |

Check what you have:

```
node -v        # want v22.13 or newer (v20.19+ also works)
dotnet --version   # want 10.x, only for apps 2, 3 and 4
```

App 1 needs a **DevExtreme trial key** — free, 30 days, from <https://js.devexpress.com/Download/>.
The app still runs without it; it just shows a licence banner. Put the key in `.env.local` inside
the generated app, never in git. The skill says the same thing and the agent will ask.

---

## 2. Preconditions — do these once, before any of the three ways

1. **Copy this folder** somewhere sensible and make it a git repository:

   ```
   git init
   git add .
   git commit -m "Skills and prompts, before any feature code"
   ```

   This matters. The agent's rules live in files; if they are not committed, the GitHub cloud
   agent cannot see them at all (way 3 runs in a sandbox that only has what is in git).

2. **Leave the folder layout alone.** Every one of the three ways reads from these exact paths:

   ```
   .claude/skills/<name>/SKILL.md    read by Claude Code, and by VS Code
   .github/skills/<name>/SKILL.md    read by VS Code, and by the GitHub cloud agent
   .github/copilot-instructions.md   read by Copilot on every request
   prompts/<name>.PROMPT.md          the brief you paste or reference
   scripts/verify.sh / verify.ps1    the gates
   ```

   The two `skills/` folders hold **identical copies** of the same files. That is deliberate — the
   three surfaces do not all read the same path. If you edit one, copy it to the other.

3. **You have a paid plan** for whichever tool you are testing. Copilot Business/Enterprise for
   ways 1 and 3; Claude Pro, Max, Team or Enterprise for way 2.

---

## 3. Way 1 — Copilot agent mode, in VS Code

*Synchronous. You watch every edit land. Nothing runs in the cloud.*

**Also need:** VS Code with the **GitHub Copilot Chat** extension installed and signed in.

1. **Open this folder** in VS Code — `File → Open Folder`. Open the folder itself, not its parent.
   The agent sees nothing outside the workspace folder.
2. **Open the chat pane** — `Ctrl+Alt+I` (`Cmd+Alt+I` on macOS), or `View → Chat`.
3. **Switch the mode picker to `Agent`.** It sits under the chat box. If it says `Ask`, the agent
   will answer you but will not edit a single file. Pick a model next to it.
4. **Paste this**, replacing the file name if you chose a different app:

   > Build the app described in `#prompts/react-devextreme-grid.PROMPT.md`. Follow it exactly,
   > including the Acceptance criteria and Out of scope sections. Create the app in a subfolder
   > named `orders-grid`. Do not stop to confirm — work until every acceptance criterion passes.

   The `#` is how VS Code pulls a file into context, so you do not have to paste 500 lines.
5. **Approve the tool calls** as they come up. The skill loads itself when its description matches
   what you asked for; you should see it read `SKILL.md` early on.
6. When it stops, **review the diff and click `Keep` or `Undo`**, then run the gates yourself
   (section 6). Copilot stops when *it* judges the work done — not when the gates pass.

---

## 4. Way 2 — the Claude Code desktop app

*The same engine as the CLI, with a window. The only one of the three where you can hand the agent
a stop condition it is obliged to satisfy.*

**Also need:** the Claude desktop app, and Git installed (on Windows a local session will not start
without it).

1. **Open the `Code` tab** at the top of the app.
2. **Choose `Local`**, click **`Select folder`**, and pick this folder. Pick a model.
3. **Paste the brief:**

   > Build the app described in `@prompts/react-devextreme-grid.PROMPT.md`. Follow it exactly,
   > including the Acceptance criteria and Out of scope sections. Create the app in a subfolder
   > named `orders-grid`.

   `@` pulls a file into context here, the same way `#` does in VS Code.
4. **Set the stop condition** — this is the step that has no equivalent in the other two ways.
   Send, as a second message:

   > /goal In the `orders-grid` folder, `npm run typecheck`, `npm run lint`, `npm test` and
   > `npm run check:clean` all exit 0, with no warnings suppressed and no test weakened.

   A small fast model now re-reads that condition after every turn. If it does not hold, Claude
   keeps working with the reason attached, instead of announcing that it is finished.
5. **Review the diff** — click the `+128 −0` indicator — and `Accept` or `Reject` per file.
   `Manual` is the default permission mode; `Accept edits` is faster and `Plan` edits nothing.
6. When something comes out wrong, **put the fix in `SKILL.md`, not in a follow-up prompt.**
   A prompt fixes one run. A rule fixes every run after it.

---

## 5. Way 3 — the GitHub cloud agent, from an issue

*You assign the work and walk away. It comes back as a draft pull request it is not allowed to
merge.*

**Also need:** this folder pushed to a **GitHub** repository. Azure Repos cannot hand work to the
cloud agent — check this before anything else, because nothing below will work otherwise.

1. **Push the repo to GitHub**, then **open a new issue**. Title it after the app, and paste the
   *Requirements* and *Acceptance criteria* sections of the prompt file into the body.
2. **Assign Copilot.** In the issue's right-hand sidebar, click **`Assignees`** and pick
   **`Copilot`**. (You can also start from the repository's **`Agents`** tab, or the **`Task`**
   button on your GitHub dashboard.)
3. **Fill in `Optional prompt`** in the dialog that appears, and pick the base branch:

   > Follow `.github/skills/react-devextreme-grid/SKILL.md` and the full brief in
   > `prompts/react-devextreme-grid.PROMPT.md`. Create the app in a subfolder named `orders-grid`.

   Then start the session.
4. **Wait.** It opens a **draft pull request** and streams its progress into it. Editing the issue
   from this point on reaches nothing — the agent took a copy when you assigned it.
5. **Steer it with a comment** on the pull request mentioning `@copilot`. Then review and merge
   yourself: the agent cannot mark its own PR ready for review, cannot approve it and cannot merge
   it. Its Actions workflows also sit idle until someone with write access clicks
   **`Approve and run workflows`**.

---

## 6. What "done" means

Not "it looks finished". These commands, run inside the generated app folder, all exiting 0:

```
cd orders-grid
npm run typecheck     # tsc --noEmit
npm run lint          # eslint . --max-warnings 0   <- the flag matters, see below
npm test              # unit tests over the query engine and column definitions
npm run check:clean   # no TODO, no `as any`, no @ts-expect-error
npm run build         # production build succeeds
```

Or run all of them at once:

```
bash scripts/verify.sh orders-grid          # macOS, Linux, Git Bash
powershell -File scripts/verify.ps1 orders-grid   # Windows
```

The script exits `0` when everything passes and `2` when anything fails. Exit code 2 is what
Claude Code hooks treat as blocking — `.claude/settings.json` in this folder already wires it up
as a `Stop` hook, so the agent physically cannot finish a session with a red gate.

**If the agent ever suggests loosening a gate — suppressing a warning, deleting a test, adding
`as any` — the answer is no.** That is the single most useful thing to watch for, and it is the
difference between a tool that saves time and a tool that moves the work to code review.

---

## 7. What to record

Four numbers and two sentences per app. `RUN-CHECKLIST.md` is a one-page form for exactly this.

| Record | Why |
| --- | --- |
| Turns to green | how many times you had to come back |
| Nudges needed | how often it stopped and asked |
| Human-active minutes | the time you could not spend elsewhere |
| Agent-wait minutes | the split matters more than the total |
| Criteria passed unedited | or did somebody loosen a gate |

**Do not record lines of code or AI acceptance rate.** Both reward volume, neither tells you
whether the work was right, and both are trivially gamed by an agent that writes more.

---

## 8. Traps we already hit, so you do not have to

These are real, reproduced errors — not hypotheticals. Each one is already written into the skill,
so a compliant agent avoids it; they are listed here so you recognise them if it does not.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `TS2614: Module 'devextreme-react/data-grid' has no exported member 'ExportingEvent'` | Event types were imported from the React wrapper package | Import event types from `devextreme/ui/data_grid`. Only `DataGridRef` comes from the React package. |
| `TS2749: 'Column' refers to a value, but is being used as a type` | Same mistake, for the column type | `import type { Column } from 'devextreme/ui/data_grid'` |
| Lint "passes" but the code is full of warnings | `eslint .` exits 0 on warnings | The gate must be `eslint . --max-warnings 0` |
| `A config object has a "plugins" key defined as an array of strings` | Used `reactHooks.configs['recommended-latest']` | Use `reactHooks.configs.flat['recommended-latest']` |
| `TS2593: Cannot find name 'describe'` | `"vitest/globals"` missing from tsconfig `types` | Add it |
| The grid loads every row and the pager is wrong | A plain array was passed as `dataSource`, or `load` returned a bare array | `CustomStore` + `<RemoteOperations filtering sorting paging />`, and `load` returns `{ data, totalCount }` |
| Console warning `W1011` | `keyExpr` set on the grid as well as `key` on the store | Declare the key once, on the store |
| `npm install` fails on peer versions | A caret on `devextreme` | Pin `devextreme` and `devextreme-react` to the same exact version. It installs fine today and breaks the moment a newer version ships. |
| Angular scaffold fails at the very first command | Angular CLI refuses to run outside its supported Node engine range | Use the Node version the prompt states |

---

## 9. What is in this folder

```
README.md                  this file
RUN-CHECKLIST.md           the one-page form to fill in
VERIFIED.md                proof that this produces a passing app, with the actual gate output
.editorconfig              analyzer severities — part of the gates
.gitignore
.github/
  copilot-instructions.md  read by Copilot on every request, in every surface
  skills/<name>/SKILL.md   the rules — read by VS Code and by the GitHub cloud agent
.claude/
  settings.json            the Stop hook that blocks a finish on a red gate
  skills/<name>/SKILL.md   the same rules — read by Claude Code and by VS Code
prompts/<name>.PROMPT.md   the brief for each app
scripts/verify.sh          the gates, one command
scripts/verify.ps1         the same, for Windows PowerShell
docs/adr/                  one file per decision, so a choice survives the person who made it
```

Nothing here is specific to one vendor. The same skill file drives Copilot in VS Code, the GitHub
cloud agent and Claude Code — which is the whole point: the comparison is between the harnesses,
not between two different sets of instructions.
