---
name: dotnet-desktop-app
description: Conventions for building and reviewing Windows desktop apps on WPF + .NET 10 with MVVM. Use when working on any *.xaml, App.xaml.cs, MainWindow.xaml.cs, *ViewModel.cs, *View.xaml, or a .csproj targeting net10.0-windows with UseWPF. Triggers on CommunityToolkit.Mvvm, ObservableObject, [ObservableProperty], [RelayCommand], [NotifyCanExecuteChangedFor], IDbContextFactory, Host.CreateApplicationBuilder, Serilog, DispatcherUnhandledException, xunit.v3, Microsoft.Testing.Platform, and on the phrases "WPF app", "desktop app", "MVVM view model", "XAML binding", "data grid binding", "publish single file", "self-contained exe", "win-x64", "WinUI vs WPF", "DevExpress WPF". Covers project layout, async loading rules, DI wiring, SQLite money/text-search traps, settings persistence, logging, headless view-model tests, and the exact publish command.
---

# WPF desktop apps on .NET 10

**Platform choice.** WPF on .NET 10 LTS (EOL 2028-11-14). Pick WinUI 3 only if you need
Fluent/WinAppSDK APIs and accept MSIX packaging; pick Avalonia only if Linux/macOS is a hard
requirement — both cost this team its XAML/DevExpress/tooling muscle memory.

## Layout — three projects, non-negotiable

```
src/<App>.Core/          net10.0          models, EF Core, services, ALL view models. No WPF.
src/<App>.App/           net10.0-windows  XAML, App.xaml.cs host bootstrap, converters.
tests/<App>.Core.Tests/  net10.0          xUnit v3. Runs on Linux CI.
```

`.Core` must never reference `PresentationFramework`, `PresentationCore`, `WindowsBase` or
`Dispatcher`. Assert it in a test. UI services (dialogs, clipboard, pickers) get an interface
in `.Core` and an implementation in `.App`.

## Versions (verified 2026-07-27 against nuget.org / release-metadata — re-check before bumping)

| Package | Version |
|---|---|
| .NET SDK / runtime | 10.0.302 / 10.0.10 (LTS) |
| CommunityToolkit.Mvvm | 8.4.2 |
| Microsoft.Extensions.* (Hosting, Logging.Abstractions, DI.Abstractions) | 10.0.10 |
| Microsoft.EntityFrameworkCore.Sqlite | 10.0.10 |
| Serilog | 4.4.0 |
| Serilog.Extensions.Logging | 10.0.0 |
| Serilog.Sinks.Console | 6.1.1 |
| Serilog.Sinks.File | 7.0.0 |
| xunit.v3 | 3.2.2 |

## MVVM

Partial properties, not fields — the 8.4 analyzers push you there and the generated code is
nullable-correct:

```csharp
public partial class AssetsViewModel : ObservableObject
{
    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasError))]
    public partial string? ErrorMessage { get; set; }

    public bool HasError => !string.IsNullOrEmpty(ErrorMessage);
}
```

Requires LangVersion 13+; `net10.0` defaults to C# 14, so never lower it.
`partial void OnErrorMessageChanged(string? value)` still works.

**Commands take no CancellationToken parameter.** `[RelayCommand] private Task LoadAsync() =>
ReloadAsync();` — one private `ReloadAsync` owns the `CancellationTokenSource`. Giving the
command its own token *and* keeping a CTS gives you two competing tokens and flaky tests.

## Async and the UI thread

1. **Never `ConfigureAwait(false)` in a view model.** Continuations must resume on the WPF
   `SynchronizationContext` or `ObservableCollection` mutation throws.
2. Every async operation: `IsBusy = true`, `try` -> `catch (OperationCanceledException) { }`
   -> `catch (Exception ex) { _log.LogError(ex, ...); ErrorMessage = ex.Message; }`
   -> `finally { IsBusy = false; }`.
3. Cancel the in-flight load before starting a new one: `Cancel()`, `Dispose()`, replace the CTS.
4. **No `async void`, ever, in `.Core`.** A generated `partial void OnXChanged` hook cannot
   await. Use `partial void OnXChanged(T v) => _ = DebouncedReloadAsync();` where
   `DebouncedReloadAsync` is a `private async Task` whose entire body sits inside try/catch so it
   can never throw. Two carve-outs, in `.App` only: `protected override async void OnStartup`
   (whole body in try/catch), and exactly one blocking
   `_host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult()` in `OnExit`, where the
   dispatcher is already shutting down. Nowhere else may you block.
5. `App.xaml.cs` wires all three nets: `DispatcherUnhandledException` (`e.Handled = true`, show
   a message, keep running), `AppDomain.CurrentDomain.UnhandledException`,
   `TaskScheduler.UnobservedTaskException`. All three log through Serilog first.
6. EF Core `DbContext` is not thread-safe. Inject `IDbContextFactory<T>` via
   `AddDbContextFactory<T>` and create a short-lived context per operation.

## EF Core + SQLite — two traps that bite every time

- **Money.** SQLite has no decimal; comparison and ordering fall back to client evaluation, and
  a `decimal`->`string` converter orders lexicographically ('9.00' > '1000.00') and cannot be
  aggregated in SQL. Store exact integer minor units (`long PriceCents`) and expose
  `[NotMapped] decimal Price => PriceCents / 100m`. Aggregate over the `long`.
- **Case-insensitive search.** `string.Contains` translates to `instr(...)>0`, which is
  case-SENSITIVE. Upper-case the term on the client, then `a.Name.ToUpper().Contains(t)` ->
  `instr(upper(...))`. Do not use `ToUpperInvariant()` inside the query — it does not translate.

## Hosting, settings, logging, globalization

- `Host.CreateApplicationBuilder(...)` in `OnStartup`; `await host.StartAsync()`; resolve the
  main window from DI; stop the host and `Log.CloseAndFlush()` in `OnExit`.
- Views get their view model by constructor injection. No `new MainViewModel()` in XAML, no
  service locator, no static `App.Services` outside the composition root.
- Settings: JSON under `Environment.SpecialFolder.LocalApplicationData`. Write atomically —
  serialize to `settings.json.tmp`, then `File.Move(tmp, path, overwrite: true)`. Corrupt or
  missing returns defaults; it never throws.
- Logging: `builder.Logging.AddSerilog(Log.Logger)`. Console + rolling file
  (`RollingInterval.Day`, `retainedFileCountLimit: 14`). Structured properties, not
  interpolation: `_log.LogInformation("Loaded {Count} assets in {Elapsed}ms", n, ms)`.
- **Never set `InvariantGlobalization=true` in a WPF app** — `StringFormat=C` then renders the
  generic currency sign. And WPF's `FrameworkElement.Language` defaults to `en-US` regardless of
  `CurrentCulture`, so `OnStartup` must call
  `FrameworkElement.LanguageProperty.OverrideMetadata(typeof(FrameworkElement), new
  FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)))`.

## Tests

xunit.v3 3.2.2 pulls Microsoft.Testing.Platform 1.9.1 (above the 1.7 floor `dotnet test` MTP
mode requires). Repo root needs:

```json
{ "sdk": { "version": "10.0.100", "rollForward": "latestFeature" },
  "test": { "runner": "Microsoft.Testing.Platform" } }
```

Without it the .NET 10 SDK runs VSTest and errors on an MTP project. Do **not** add
`Microsoft.NET.Test.Sdk` or `xunit.runner.visualstudio`. Test project needs
`<OutputType>Exe</OutputType>` — the xunit targets hard-error otherwise. In MTP mode paths are
options: `dotnet test --project X.csproj`, `--solution X.sln`.

`xunit.analyzers` ships with it and **xUnit1051 is a warning**: under warnings-as-errors, every
await that takes a token must pass `TestContext.Current.CancellationToken` or the build fails.

Test against real SQLite in-memory (`Data Source=:memory:`, one `SqliteConnection` held open for
the fixture's lifetime), not the in-memory provider — you want real translation failures. Make
debounce intervals injectable so timing tests are deterministic. Cover at minimum: the error
path sets `ErrorMessage` and clears `IsBusy`; cancellation does not surface as an error.

## Publishing

```powershell
dotnet publish src\<App>.App\<App>.App.csproj -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish\win-x64
```

`IncludeNativeLibrariesForSelfExtract` is required — SQLite's `e_sqlite3` is otherwise left
beside the EXE. Swap `win-x64` for `win-arm64` as needed.
**Never set `PublishTrimmed=true`.** WPF is not trim-safe; it builds, then fails at runtime with
missing-type errors on the first XAML load.

## Prohibitions

- No code-behind logic beyond `InitializeComponent()` and pure view concerns.
- No `Thread.Sleep`, `.Result`, `.Wait()`; no `async void` outside the two carve-outs above.
- No `Application.ThemeMode` — experimental, emits `WPF0001`, breaks the warnings gate.
- No inline `#pragma` to pass the build. Relax a rule in `.editorconfig` with a justification.
- `TreatWarningsAsErrors=true` pairs with `AnalysisLevel=latest`, not `latest-recommended` — the
  latter turns CA1031/CA1848/CA1311 on and makes the mandated code shape a build error.

## DevExpress WPF — usually not worth it here

The built-in `DataGrid` handles grouping, sorting, virtualization and templated columns fine.
Add DevExpress WPF only for pivot grids, scheduler, ribbon or reporting. It is **commercial**:
paid per-developer subscription, 30-day trial, licence key plus the authenticated DevExpress
NuGet feed on every dev box *and* on CI — an agent without that feed fails immediately. Decide
before writing XAML against it, not after.

## Exit criteria

`dotnet build -c Release -warnaserror` (0 warnings) · `dotnet test` green ·
`dotnet format --verify-no-changes` exit 0 · the app opens a window with real data ·
the single-file publish runs with `DOTNET_ROOT` cleared.
