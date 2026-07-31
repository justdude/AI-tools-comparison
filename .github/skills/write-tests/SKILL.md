---
name: write-tests
description: Write or extend automated tests for .NET (xUnit v3/NUnit, ASP.NET Core, EF Core) and frontend (Angular/React) code without copying bugs into the assertions. Use when asked to "write tests", "add unit tests", "increase coverage", "cover this endpoint/service/component", "improve test quality", "kill surviving mutants", "add integration tests", "add E2E tests", or when touching *Tests.cs, *.Tests.csproj, *.spec.ts, *.test.tsx, *.e2e.ts, stryker-config.json, vitest.config.ts, playwright.config.ts, global.json, WebApplicationFactory or Testcontainers. Enforces contract-first authoring (read the OpenAPI doc, acceptance criteria and public signatures - never the method bodies under test), Arrange-Act-Assert, and a mutation-score gate via Stryker.NET on changed files instead of line coverage alone. Also use to review existing tests that pass but assert nothing meaningful.
---

# Writing tests that can actually fail

A test written by reading the implementation asserts what the code *does*, not what it *should
do*: it passes on day one, passes after the bug ships, and coverage never notices.

## 1. The blackout rule (non-negotiable)

While generating tests for a unit you may read: the OpenAPI/Swagger document, `.http` files and
contract fixtures; the issue / acceptance criteria / spec / ADR; **public signatures only**
(`dotnet build` output, XML doc comments, interfaces, DTOs, `record` definitions, EF Core
entity + configuration classes, `.d.ts`, component props); existing tests, test data builders
and `WebApplicationFactory` setup; runtime behaviour (run the app, hit the endpoint, render the
component). You may **not** read the method bodies of the code under test.

If the contract is ambiguous, **stop and ask** - do not open the file to resolve it. An
ambiguity you resolve by reading the implementation is a requirement you failed to test.

Step 1 of every run, in any tool: list the paths you are about to test, one per line, in
`$(git rev-parse --git-dir)/write-tests-blackout.txt` (inside `.git/`, so it is never
committed and does not depend on which skills folder hosts this file), and state them back to
the user. Empty the file when the tests are green. **Claude Code** can additionally enforce it
with a `PreToolUse` hook (`matcher: "Read|Grep"`, `type: "command"`); exit code 2 blocks the
call and returns stderr to the agent:

```bash
#!/usr/bin/env bash
b="$(git rev-parse --git-dir 2>/dev/null)/write-tests-blackout.txt"; [ -s "$b" ] || exit 0
p=$(jq -r '.tool_input.file_path // .tool_input.path // empty'); [ -n "$p" ] || exit 0
if grep -qxF "$(realpath --relative-to="$(git rev-parse --show-toplevel)" "$p")" "$b"; then
  echo "BLOCKED by write-tests: $p is under test. Derive the expectation from the contract (OpenAPI / acceptance criteria / public signature) or ask the user." >&2
  exit 2
fi
```

**GitHub Copilot / Visual Studio 2026 (18.5+)** discovers this same file from `.claude/skills/`,
`.github/skills/` and `.agents/skills/`, but skills are instructions, not interceptors - there
is no hook equivalent. Everything else here is tool-neutral; on that side the mutation gate in
section 3 is the real safety net, not an optional extra.

## 2. .NET tests

- Frameworks: **xUnit v3** (`xunit.v3`, 3.2.x) or **NUnit 4**, both on **Microsoft.Testing.Platform** (MTP).
- Enable the MTP mode of `dotnet test` (.NET 10 SDK+) in **`global.json`** at the repo root:
  `{ "test": { "runner": "Microsoft.Testing.Platform" } }`. Do **not** use the legacy
  `TestingPlatformDotnetTestSupport` bridge - that runs VSTest mode, where every option below
  must be passed after a `--` separator and is otherwise rejected.
- `--coverage` requires `Microsoft.Testing.Extensions.CodeCoverage` in each test project
  (`dotnet add package Microsoft.Testing.Extensions.CodeCoverage`).
- Name `MethodUnderTest_Scenario_ExpectedOutcome` (`Calculate_PriceIsZero_ThrowsArgumentOutOfRange`);
  one behaviour per test; body is `// Arrange` `// Act` `// Assert`, with exactly one Act.
- Assert on the contract: status code + problem-details shape, returned value, domain event
  raised. Never assert on `_repository.Verify(...)` alone - that asserts the implementation you
  were not allowed to read.
- Boundaries are mandatory: `0`, `-1`, `int.MaxValue`, empty collection, `null`, first/last
  valid value, and the exception message text.
- ASP.NET Core: integration-test through `WebApplicationFactory<TProgram>`. EF Core: prefer a
  real provider (Testcontainers / SQL Server LocalDB) over `UseInMemoryDatabase`, which
  silently accepts queries the real provider rejects.

```bash
dotnet test --coverage --coverage-output-format cobertura --minimum-expected-tests 1
```

`--minimum-expected-tests` fails the run if a project discovers zero tests (1 is the default -
raise it to a real per-project count). This produces the coverage report; it is **not** the
gate. The gate is section 3.

## 3. Mutation testing - the quality gate

```bash
dotnet tool install -g dotnet-stryker       # install latest; do not pin a stale version
cd tests/MyProject.Tests && dotnet stryker  # or: dotnet stryker --solution ./MySln.sln
```

`stryker-config.json` next to the test project (the `stryker-config` wrapper is required):

```json
{ "stryker-config": {
  "reporters": ["html", "markdown", "progress"],
  "thresholds": { "high": 85, "low": 70, "break": 60 },
  "since": { "target": "origin/main" },
  "mutate": ["!**/Migrations/*", "!**/*.Designer.cs"],
  "ignore-methods": ["*Log*", "ToString", "ConfigureAwait"]
} }
```

Read `StrykerOutput/<timestamp>/reports/`: **killed** = a test caught the change (good);
**survived** = it went unnoticed, your assertions are too weak, fix them; **timeout** = the mutant
hung, inspect it or raise the timeout. Stryker exits non-zero below `break` - that exit code is
the gate. Do **not** chase 100%: surviving mutants in logging or guard-clause noise are
acceptable, in pricing, auth or persistence they are not.

## 4. Frontend tests

- **Vitest 4.x** + `@vitest/coverage-v8`; **@testing-library/react 16.x**. Angular 21+
  (incl. 22) ships Vitest as the default runner - same rules via `@testing-library/angular`.
- Query by accessible role/name (`getByRole('button', { name: /save/i })`), never by CSS class,
  `data-testid` as a first choice, or component internals.
- Drive with `@testing-library/user-event`, not raw `fireEvent`; put `test.coverage.thresholds`
  in `vitest.config.ts` so the run fails on its own.
- **Playwright 1.x** for E2E (`--only-changed` needs >= 1.46): web-first assertions
  (`await expect(locator).toBeVisible()`), never `waitForTimeout`.

## 5. Prohibitions

Never, to make a check pass:

- delete, rename, `Skip =`, `[Ignore]`, `Assert.Ignore`, `.skip`, `.todo`, `test.fixme` or
  otherwise weaken a test; never narrow the run with `--filter`/`--treenode-filter`
- loosen an assertion (`Assert.NotNull` replacing an equality check, `toBeTruthy()` replacing
  `toEqual`); never assert a value you copied from actual output
- `#pragma warning disable`, `[ExcludeFromCodeCoverage]`, `<NoWarn>`, or lower an analyzer
  severity in `.editorconfig`
- add entries to `mutate`/`ignore-methods`, change `since.target` or the Stryker baseline, or
  lower `thresholds.break` / `coverage.thresholds`
- edit the code under test. If a test fails because the implementation is wrong, **say so and
  stop.** That failing test is the deliverable.

## 6. When things go wrong

- **Test already red on the merge base** - record it, exclude it from your gate, never fix it silently.
- **`dotnet-stryker` missing / no network** - run coverage, review surviving-mutant candidates by
  hand, report the gate as UNVERIFIED. Never claim a score you did not measure.
- **Stryker "no test project found"** - run from the test project directory or pass `--solution`.
- **Stryker `--since` fails in CI** - shallow clone; fix the checkout (`fetch-depth: 0` or
  `git fetch --unshallow origin main`), never by dropping `--since`.
- **Stryker times out** - narrow with `--mutate` to the changed files; do not raise `break`.
- **`dotnet test`: unrecognized option `--coverage`** - `global.json` lacks the MTP runner, or the
  CodeCoverage package is not referenced. Fix the setup, not the command.
- **Build fails** - fix the test project only; a compile error in the code under test is a blocker
  to report, not to patch.

## 7. Exit criteria - run these, all must pass

```bash
git fetch origin main && BASE=$(git merge-base origin/main HEAD)  # not a moving branch tip
dotnet build -warnaserror                                         # exit 0
dotnet test --coverage --coverage-output-format cobertura \
            --minimum-expected-tests 1                            # exit 0
cd tests/MyProject.Tests && dotnet stryker --since:"$BASE" --break-at 60   # exit 0
npx vitest run --coverage --changed "$BASE"                       # exit 0
npx playwright test --only-changed="$BASE"                        # exit 0

test "$(git diff "$BASE" -- '*Tests*' '*.spec.*' '*.test.*' \
  | grep -cE '^-[[:space:]]*(Assert[.<]|expect\()|^-.*\.Should\(\)')" -eq 0   # no assertion deleted
test "$(git diff "$BASE" -- '*Tests*' '*.spec.*' '*.test.*' \
  | grep -cE '^\+.*(Skip[[:space:]]*=|\[Ignore|Assert\.Ignore|\.skip\(|\.todo\(|fixme)')" -eq 0  # none disabled
```

Not done until every command above exits 0. "Looks reasonable" is not an exit criterion.
