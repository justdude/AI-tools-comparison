# Build "AssetTracker" — a production WPF desktop app on .NET 10

Build the whole thing: create the folder, scaffold the solution, write every file, run the
gates, and paste the real output. Do not stop at a skeleton and do not leave TODOs.

## Context

- **Stack:** WPF on .NET 10 LTS (SDK 10.0.302 / runtime 10.0.10, EOL 2028-11-14), C# 14,
  MVVM via CommunityToolkit.Mvvm source generators, DI via `Microsoft.Extensions.Hosting`,
  EF Core 10 + SQLite, Serilog, xUnit v3 on Microsoft.Testing.Platform.
- **OS:** Windows. All commands below are PowerShell.
- **Target folder:** `C:\src\AssetTracker` (create it).
- **Licensing: every package here is free and open source (MIT / Apache-2.0). No API keys, no
  accounts, no commercial licences, no network access at runtime.** Do **not** add DevExpress,
  Telerik or Syncfusion: the built-in WPF `DataGrid` is sufficient, and DevExpress would need a
  paid per-developer subscription plus an authenticated NuGet feed on every dev box and on CI.
- **Prerequisite check:** run `dotnet --list-sdks`. You need `10.0.100` or later. If it is
  missing, stop and tell me to install the .NET 10 SDK from
  https://dotnet.microsoft.com/download/dotnet/10.0 before continuing.

The app is an **IT asset inventory**: a searchable grid of hardware assets with a detail pane,
async loading, persisted settings and disk logging. It seeds its own SQLite database on first
run, so it works with no server, no key and no network.

## Scaffold

```powershell
New-Item -ItemType Directory -Force -Path C:\src\AssetTracker | Out-Null
cd C:\src\AssetTracker
git init
dotnet new gitignore
dotnet new sln -n AssetTracker
dotnet new classlib -n AssetTracker.Core       -o src\AssetTracker.Core         -f net10.0
dotnet new wpf      -n AssetTracker.App        -o src\AssetTracker.App
dotnet new classlib -n AssetTracker.Core.Tests -o tests\AssetTracker.Core.Tests -f net10.0
del src\AssetTracker.Core\Class1.cs
del tests\AssetTracker.Core.Tests\Class1.cs

dotnet sln add src\AssetTracker.Core\AssetTracker.Core.csproj `
               src\AssetTracker.App\AssetTracker.App.csproj `
               tests\AssetTracker.Core.Tests\AssetTracker.Core.Tests.csproj
dotnet add src\AssetTracker.App reference src\AssetTracker.Core
dotnet add tests\AssetTracker.Core.Tests reference src\AssetTracker.Core

dotnet add src\AssetTracker.Core package CommunityToolkit.Mvvm --version 8.4.2
dotnet add src\AssetTracker.Core package Microsoft.EntityFrameworkCore.Sqlite --version 10.0.10
dotnet add src\AssetTracker.Core package Microsoft.Extensions.Logging.Abstractions --version 10.0.10
dotnet add src\AssetTracker.Core package Microsoft.Extensions.DependencyInjection.Abstractions --version 10.0.10

dotnet add src\AssetTracker.App package Microsoft.Extensions.Hosting --version 10.0.10
dotnet add src\AssetTracker.App package Serilog --version 4.4.0
dotnet add src\AssetTracker.App package Serilog.Extensions.Logging --version 10.0.0
dotnet add src\AssetTracker.App package Serilog.Sinks.Console --version 6.1.1
dotnet add src\AssetTracker.App package Serilog.Sinks.File --version 7.0.0

dotnet add tests\AssetTracker.Core.Tests package xunit.v3 --version 3.2.2
```

Notes on the scaffold — do not "fix" these:
- `dotnet new wpf` is invoked **without** `-f`. The .NET 10 SDK default is `net10.0` and the
  template emits `<TargetFramework>net10.0-windows</TargetFramework>`. Leave that value alone.
- `AssetTracker.Core` and the test project stay on plain `net10.0` so tests run on Linux CI.
- `xunit.v3` is the **only** test package. Adding `Microsoft.NET.Test.Sdk` or
  `xunit.runner.visualstudio` breaks the runner (see requirement 1).

Final tree to end up with:

```
C:\src\AssetTracker\
  global.json  Directory.Build.props  .editorconfig  .gitignore  AssetTracker.sln  README.md
  .claude\skills\dotnet-desktop-app\SKILL.md      <- I paste this separately; create the dirs
  .github\workflows\ci.yml
  src\AssetTracker.Core\
    Models\Asset.cs  Models\AssetCategory.cs  Models\AssetStatus.cs
    Models\AssetQuery.cs  Models\AssetStats.cs
    Data\AssetDbContext.cs  Data\IAssetRepository.cs  Data\AssetRepository.cs
    Data\DatabaseInitializer.cs
    Settings\AppSettings.cs  Settings\IAppSettingsService.cs  Settings\JsonAppSettingsService.cs
    Infrastructure\IAppPaths.cs  Infrastructure\AppPaths.cs  Infrastructure\IClock.cs
    Infrastructure\SystemClock.cs
    ViewModels\MainViewModel.cs  ViewModels\AssetRowViewModel.cs
  src\AssetTracker.App\
    App.xaml  App.xaml.cs  MainWindow.xaml  MainWindow.xaml.cs
    Converters\BoolToVisibilityConverter.cs  AssemblyInfo.cs (from template)
  tests\AssetTracker.Core.Tests\
    SqliteFixture.cs  TestDbContextFactory.cs  AssetRepositoryTests.cs
    DatabaseInitializerTests.cs  JsonAppSettingsServiceTests.cs  MainViewModelTests.cs
    ArchitectureTests.cs
  publish\   (created by the publish step)
```

## Requirements

### 1. `global.json` (repo root) — required, `dotnet test` fails without it

```json
{
  "sdk": { "version": "10.0.100", "rollForward": "latestFeature" },
  "test": { "runner": "Microsoft.Testing.Platform" }
}
```

`xunit.v3` 3.2.2 pulls `xunit.v3.mtp-v1` -> `Microsoft.Testing.Platform` 1.9.1, above the 1.7
floor that native MTP `dotnet test` requires. On the .NET 10 SDK `dotnet test` defaults to
VSTest and errors on an MTP project unless this `test.runner` opt-in is present. In MTP mode,
paths become options: `dotnet test --project X.csproj`, not `dotnet test X.csproj`.

### 2. `Directory.Build.props` (repo root)

```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnableNETAnalyzers>true</EnableNETAnalyzers>
    <AnalysisLevel>latest</AnalysisLevel>
  </PropertyGroup>
</Project>
```

Do **not** set `LangVersion` (`net10.0` already defaults to C# 14, which `[ObservableProperty]`
on partial properties needs). Do **not** set `InvariantGlobalization` — it makes `StringFormat=C`
render the generic currency sign instead of a real symbol.

`.editorconfig` at the repo root: 4-space indent for `*.cs`, 2-space for `*.xaml`/`*.json`/
`*.yml`, `end_of_line = crlf`, `insert_final_newline = true`, `charset = utf-8`. Plus these five
suppressions, each with the comment shown — they exist because the code shape this prompt
mandates would otherwise fail the warnings-as-errors gate:

```ini
[*.cs]
# Broad catch is deliberate: an unhandled exception in a command kills the WPF process.
dotnet_diagnostic.CA1031.severity = none
# LoggerMessage source-generated delegates are overkill for a single-screen desktop app.
dotnet_diagnostic.CA1848.severity = none
# ConfigureAwait(false) is wrong in a WPF view model; continuations must resume on the UI context.
dotnet_diagnostic.CA2007.severity = none
# Culture-default ToUpper() is what EF Core translates to SQLite upper(); ToUpperInvariant() does not translate.
dotnet_diagnostic.CA1311.severity = none
dotnet_diagnostic.CA1862.severity = none
```

Never use an inline `#pragma` to pass the build.

### 3. Domain (`AssetTracker.Core/Models`)

`Asset`: `int Id`, `string Tag`, `string Name`, `AssetCategory Category`, `AssetStatus Status`,
`string? AssignedTo`, `DateOnly PurchasedOn`, `long PurchasePriceCents`, `DateTime LastSeenUtc`,
`string? Notes`, plus

```csharp
[NotMapped]
public decimal PurchasePrice
{
    get => PurchasePriceCents / 100m;
    set => PurchasePriceCents = (long)decimal.Round(value * 100m, 0, MidpointRounding.AwayFromZero);
}
```

**Money is stored as INTEGER minor units — not decimal, not TEXT.** SQLite has no decimal type;
a `decimal`->`string` converter orders lexicographically ('9.00' > '1000.00') and cannot be
aggregated in SQL. Cents sum, order and compare exactly.

`AssetCategory` enum: `Laptop, Desktop, Monitor, Phone, Tablet, Printer, Server, NetworkGear`.
`AssetStatus` enum: `InStock, Assigned, InRepair, Retired`.
`AssetQuery` record: `(string? Text, AssetCategory? Category, AssetStatus? Status, int Take = 500)`.
`AssetStats` record: `(int Total, int Assigned, int InRepair, decimal TotalValue)`.

### 4. Data (`AssetTracker.Core/Data`)

- `AssetDbContext : DbContext` — `DbSet<Asset>`, unique index on `Tag`,
  `builder.Entity<Asset>().Ignore(a => a.PurchasePrice)`, `Tag` and `Name` required.
- `IAssetRepository`:
  ```csharp
  bool SimulateFailure { get; set; }
  Task<IReadOnlyList<Asset>> SearchAsync(AssetQuery query, CancellationToken ct);
  Task<AssetStats> GetStatsAsync(CancellationToken ct);
  Task SaveAsync(Asset asset, CancellationToken ct);
  Task DeleteAsync(int id, CancellationToken ct);
  ```
  `SimulateFailure` is **on the interface** — the view model only ever sees the interface.
- `AssetRepository` takes `IDbContextFactory<AssetDbContext>` and creates one short-lived
  context per call. Never a shared context.
- **Text search must be written exactly like this.** `string.Contains` alone translates to
  SQLite `instr()`, which is case-sensitive, and the case-insensitivity test would fail:
  ```csharp
  var t = query.Text!.Trim().ToUpperInvariant();
  q = q.Where(a => a.Tag.ToUpper().Contains(t)
                || a.Name.ToUpper().Contains(t)
                || (a.AssignedTo != null && a.AssignedTo.ToUpper().Contains(t)));
  ```
  Use `AsNoTracking()`, then `.Take(query.Take)`.
- `GetStatsAsync` aggregates in SQL over the `long` column:
  `TotalValue = await db.Assets.SumAsync(a => a.PurchasePriceCents, ct) / 100m`.
- When `SimulateFailure` is true, `SearchAsync` awaits `Task.Delay(400, ct)` then throws
  `InvalidOperationException("Simulated backend failure.")`. This makes the error path
  demonstrable and testable — keep it.
- `DatabaseInitializer.InitializeAsync(ct)` calls `EnsureCreatedAsync()`, then seeds only if the
  table is empty: exactly **250** assets from `new Random(20260727)` so the data is identical on
  every machine. Tags `AST-0001`..`AST-0250`, realistic names per category, ~40% `Assigned` with
  a name from a fixed 20-name list, purchase dates spread over 5 years, prices 150.00–4500.00.
  Running it twice must not duplicate rows. **No EF migrations** — `EnsureCreated` keeps
  first-run setup at zero commands.

### 5. Settings + paths (`Core/Settings`, `Core/Infrastructure`)

- `AppPaths` resolves `%LOCALAPPDATA%\AssetTracker` and creates it: `SettingsFile`,
  `DatabaseFile` (`assets.db`), `LogDirectory` (`logs`).
- `AppSettings` record: `double WindowWidth = 1280`, `double WindowHeight = 800`,
  `bool WindowMaximized = false`, `string LastSearchText = ""`, `string? LastCategory = null`.
- `JsonAppSettingsService : IAppSettingsService` — `Load()` returns defaults when the file is
  missing **or** the JSON is corrupt (log a warning, never throw). `Save()` writes atomically:
  serialize to `settings.json.tmp`, then `File.Move(tmp, target, overwrite: true)`. Constructor
  takes `IAppPaths` so tests can point it at a temp directory.

### 6. View models (`Core/ViewModels`) — no WPF references allowed

`AssetRowViewModel : ObservableObject` wraps one `Asset`; `Notes` and `Status` are
`[ObservableProperty]` partial properties, everything else read-only.

`MainViewModel : ObservableObject`, constructor `(IAssetRepository repo, ILogger<MainViewModel> log)`:

- `ObservableCollection<AssetRowViewModel> Assets`.
- `[ObservableProperty] public partial string SearchText { get; set; }` and the same partial
  property form for `AssetCategory? SelectedCategory`, `AssetStatus? SelectedStatus`,
  `AssetRowViewModel? SelectedAsset`, `bool IsBusy`, `string? ErrorMessage`, `string StatusLine`,
  `AssetStats? Stats`, `bool SimulateFailure`.
- `HasError => !string.IsNullOrEmpty(ErrorMessage)`, kept fresh with
  `[NotifyPropertyChangedFor(nameof(HasError))]` on `ErrorMessage`.
- `SelectedAsset` carries `[NotifyCanExecuteChangedFor(nameof(DeleteCommand))]` and
  `[NotifyCanExecuteChangedFor(nameof(SaveNotesCommand))]`.
- **One private method owns all cancellation.** Commands take no `CancellationToken` parameter —
  a `[RelayCommand]` method with a token gets the command's own token, which would compete with
  the CTS below:
  ```csharp
  private CancellationTokenSource? _cts;

  [RelayCommand] private Task LoadAsync() => ReloadAsync();

  private async Task ReloadAsync()
  {
      _cts?.Cancel(); _cts?.Dispose();
      _cts = new CancellationTokenSource();
      var ct = _cts.Token;
      IsBusy = true; ErrorMessage = null;
      try
      {
          _repo.SimulateFailure = SimulateFailure;
          var rows  = await _repo.SearchAsync(new AssetQuery(SearchText, SelectedCategory, SelectedStatus), ct);
          var stats = await _repo.GetStatsAsync(ct);
          if (ct.IsCancellationRequested) return;
          Assets.Clear();
          foreach (var a in rows) Assets.Add(new AssetRowViewModel(a));
          Stats = stats;
          StatusLine = $"{Assets.Count} of {stats.Total} assets";
      }
      catch (OperationCanceledException) { }
      catch (Exception ex) { _log.LogError(ex, "Load failed"); ErrorMessage = ex.Message; }
      finally { if (!ct.IsCancellationRequested) IsBusy = false; }
  }
  ```
- **Debounce without `async void`.** The generated change hook returns `void`, so it must not
  await. `SearchDebounce` is a public `TimeSpan` property defaulting to 300 ms; tests set it to
  `TimeSpan.Zero`, so it must be settable and honoured:
  ```csharp
  partial void OnSearchTextChanged(string value) => _ = DebouncedReloadAsync();

  private async Task DebouncedReloadAsync()   // never throws
  {
      try
      {
          if (SearchDebounce > TimeSpan.Zero) await Task.Delay(SearchDebounce);
          await ReloadAsync();
      }
      catch (Exception ex) { _log.LogError(ex, "Debounced reload failed"); }
  }
  ```
  Same pattern for `OnSelectedCategoryChanged`, `OnSelectedStatusChanged`, `OnSimulateFailureChanged`.
- `public async Task InitializeAsync(AppSettings settings)` — assigns the restored search text
  through the generated property, then awaits exactly one `ReloadAsync()`. `App` calls this
  before showing the window, so the grid is populated when the user first sees it.
- `[RelayCommand(CanExecute = nameof(CanModify))] private async Task DeleteAsync()` — deletes
  `SelectedAsset` and removes the row. `[RelayCommand(CanExecute = nameof(CanModify))] private
  async Task SaveNotesAsync()` — persists the edited notes. `CanModify => SelectedAsset is not null`.
- Never call `ConfigureAwait(false)` anywhere in this class. No `async void`.

### 7. WPF layer (`AssetTracker.App`)

- `App.xaml`: remove `StartupUri`. `App.xaml.cs`:
  - `protected override async void OnStartup(StartupEventArgs e)` — the entire body inside
    `try { ... } catch (Exception ex) { Log.Fatal(...); MessageBox.Show(...); Shutdown(1); }`.
    This is the one permitted `async void`; it is an event-invoking override.
  - First statement of the try: apply the machine culture to WPF bindings, because
    `FrameworkElement.Language` otherwise defaults to `en-US` and `StringFormat=C` would show
    dollars on a UK machine:
    ```csharp
    FrameworkElement.LanguageProperty.OverrideMetadata(typeof(FrameworkElement),
        new FrameworkPropertyMetadata(XmlLanguage.GetLanguage(CultureInfo.CurrentCulture.IetfLanguageTag)));
    ```
  - Configure `Log.Logger` with `WriteTo.Console()` and `WriteTo.File(Path.Combine(
    paths.LogDirectory, "assettracker-.log"), rollingInterval: RollingInterval.Day,
    retainedFileCountLimit: 14)`.
  - `Host.CreateApplicationBuilder(e.Args)`; `builder.Logging.ClearProviders()`;
    `builder.Logging.AddSerilog(Log.Logger)` (from `Serilog.Extensions.Logging`).
  - Register: `IAppPaths`, `IClock`, `IAppSettingsService` (singletons),
    `AddDbContextFactory<AssetDbContext>(o => o.UseSqlite($"Data Source={paths.DatabaseFile}"))`,
    `IAssetRepository` (singleton), `DatabaseInitializer`, `MainViewModel`, `MainWindow`.
  - `await _host.StartAsync()`; `await initializer.InitializeAsync(default)`; load settings;
    resolve `MainWindow`; `await vm.InitializeAsync(settings)`; apply window size/maximized;
    `window.Show()`.
  - Wire `DispatcherUnhandledException` (log, MessageBox, `e.Handled = true` — the app stays
    alive), `AppDomain.CurrentDomain.UnhandledException`, `TaskScheduler.UnobservedTaskException`.
  - `protected override void OnExit(ExitEventArgs e)`: save settings (current geometry + search
    text), then `_host.StopAsync(TimeSpan.FromSeconds(5)).GetAwaiter().GetResult()` — the one
    permitted blocking call, the dispatcher is already shutting down — then `Log.CloseAndFlush()`.
- `MainWindow.xaml` — one screen, `DockPanel` root:
  - Top toolbar: search `TextBox` (two-way to `SearchText`, `UpdateSourceTrigger=PropertyChanged`),
    category `ComboBox`, status `ComboBox`, Refresh button (`LoadCommand`), and a
    "Simulate backend failure" `CheckBox` bound to `SimulateFailure`.
  - Indeterminate `ProgressBar`, visible only when `IsBusy`.
  - Red error banner (`Border`) visible only when `HasError`, showing `ErrorMessage` and a Retry
    button. Never a modal dialog, never fatal.
  - `DataGrid`: `AutoGenerateColumns="False"`, `IsReadOnly="True"`, `SelectionMode="Single"`,
    `EnableRowVirtualization="True"`, `ItemsSource` bound to `Assets`, `SelectedItem` two-way to
    `SelectedAsset`. Columns: Tag, Name, Category, Status, AssignedTo,
    PurchasedOn (`StringFormat=d`), PurchasePrice (`StringFormat=C`, right-aligned), LastSeenUtc.
  - Right detail pane behind a `GridSplitter`: read-only fields for the selection plus an
    editable Notes `TextBox` with Save (`SaveNotesCommand`) and Delete (`DeleteCommand`).
  - Status bar: `StatusLine` and the `Stats` numbers.
  - Code-behind holds `InitializeComponent()` and nothing else; the view model arrives by
    constructor injection and is assigned to `DataContext`.
- `BoolToVisibilityConverter` for the busy bar and the error banner.

### 8. Tests (`tests/AssetTracker.Core.Tests`) — exactly 19, all headless

Add `<OutputType>Exe</OutputType>` and `<IsTestProject>true</IsTestProject>` to the csproj. The
xunit v3 targets hard-error if `OutputType` is not `Exe`.

**Every await that accepts a `CancellationToken` must be passed
`TestContext.Current.CancellationToken`.** `xunit.analyzers` ships with `xunit.v3` and xUnit1051
is a warning; with `TreatWarningsAsErrors` it is a build failure.

Use a real SQLite in-memory database: open one `SqliteConnection("Data Source=:memory:")`, keep
it open for the fixture's lifetime, and hand it to a small
`TestDbContextFactory : IDbContextFactory<AssetDbContext>`. Do not use the EF in-memory provider.

1. free-text search matches Tag; 2. matches Name; 3. matches AssignedTo; 4. is case-insensitive
(`"lap"` and `"LAP"` return the same rows); 5. filter by category; 6. filter by status;
7. `Take` limits results; 8. `GetStatsAsync` `Total`/`Assigned`/`InRepair` are correct;
9. `GetStatsAsync` `TotalValue` equals the sum of the seeded prices to the cent; 10. seeder
creates exactly 250 rows; 11. seeder is idempotent on a second run; 12. settings round-trip
through JSON; 13. missing settings file returns defaults; 14. corrupt settings file returns
defaults and does not throw; 15. `LoadCommand` populates `Assets` and leaves `IsBusy == false`;
16. with `SimulateFailure` it sets `ErrorMessage` and `HasError`, leaves `IsBusy == false`, and
does not propagate the exception; 17. `DeleteCommand.CanExecute` is false with no selection and
true with one; 18. setting `SearchText` with `SearchDebounce = TimeSpan.Zero` reloads and
narrows the result set; 19. **architecture guard** —
`typeof(MainViewModel).Assembly.GetReferencedAssemblies()` contains no assembly named
`PresentationFramework`, `PresentationCore` or `WindowsBase`.

### 9. CI (`.github/workflows/ci.yml`)

Two jobs, both with `actions/checkout@v4` and `actions/setup-dotnet@v5` (`dotnet-version: 10.0.x`):

- `test-headless` on `ubuntu-latest`:
  `dotnet test --project tests/AssetTracker.Core.Tests/AssetTracker.Core.Tests.csproj -c Release -- --minimum-expected-tests 19`
  — it proves the view models are genuinely UI-free, because WPF assemblies cannot resolve there.
- `build-windows` on `windows-latest`: `dotnet restore`, `dotnet build -c Release -warnaserror`,
  `dotnet format --verify-no-changes`, `dotnet test -c Release -- --minimum-expected-tests 19`,
  then the publish command from requirement 11, uploading `publish/win-x64` with
  `actions/upload-artifact@v4`.

### 10. `README.md`

Prereqs, `dotnet run --project src\AssetTracker.App`, where the DB/settings/logs live
(`%LOCALAPPDATA%\AssetTracker`), how to reset (delete that folder), the four gate commands, and
the publish command.

### 11. Publish

```powershell
dotnet publish src\AssetTracker.App\AssetTracker.App.csproj -c Release -r win-x64 `
  --self-contained true -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true -o publish\win-x64
```

`IncludeNativeLibrariesForSelfExtract=true` is mandatory — SQLite's `e_sqlite3` native binary is
otherwise dropped beside the EXE instead of bundled. **Never add `PublishTrimmed=true`**: WPF is
not trim-safe and the trimmed build fails at runtime on the first XAML load. Use `win-arm64` for
ARM devices.

## Acceptance criteria

Run every command from `C:\src\AssetTracker` and paste the real output. Each must pass.

1. `dotnet --list-sdks` lists `10.0.100` or later.
2. `dotnet restore` exits 0.
3. `dotnet build -c Release -warnaserror` exits 0 and prints `0 Warning(s)`.
4. `dotnet format` then `dotnet format --verify-no-changes` — the second exits 0.
5. `dotnet test -c Release -- --minimum-expected-tests 19` exits 0 with 0 failed.
6. `dotnet test --project tests\AssetTracker.Core.Tests\AssetTracker.Core.Tests.csproj -c Release -- --minimum-expected-tests 19`
   exits 0. Test 19 is the gate that no WPF assembly is referenced from `.Core`.
7. `dotnet run --project src\AssetTracker.App` opens a window; the grid holds **250 rows** and
   the status bar reads exactly `250 of 250 assets` within **3 seconds** of the window appearing;
   the PurchasePrice column shows the local currency symbol, not `¤`.
8. Type `lap` in search: within **1 second** the grid shows only rows whose Tag/Name/AssignedTo
   contains it (case-insensitively — `LAP` gives the identical count) and the status bar count
   drops. The window never stops responding while loading.
9. Tick "Simulate backend failure" and press Refresh: a red banner reads
   `Simulated backend failure.`, the window stays responsive and the process does not exit.
   `Select-String -Path "$env:LOCALAPPDATA\AssetTracker\logs\assettracker-*.log" -Pattern 'Simulated backend failure'`
   returns at least one match. Untick and Refresh: the banner clears and 250 rows return.
10. Resize the window, type `srv` in search, close, reopen: the window returns at that size with
    `srv` in the search box, and
    `Select-String -Path "$env:LOCALAPPDATA\AssetTracker\settings.json" -Pattern 'srv'` exits 0.
11. `(Get-Item "$env:LOCALAPPDATA\AssetTracker\assets.db").Length -gt 0` is `True`. Delete
    `%LOCALAPPDATA%\AssetTracker`, rerun: the DB is recreated and reseeded to 250 rows.
12. The publish command exits 0; `publish\win-x64\AssetTracker.App.exe` exists;
    `(Get-ChildItem publish\win-x64 -File).Count -le 3` is `True`; and launching that EXE from a
    fresh PowerShell where `$env:DOTNET_ROOT=''` and the cwd is `$env:TEMP` opens the same window
    with 250 rows.

## Out of scope — do not build these

Authentication or user accounts; any server, REST API or cloud sync; MSIX packaging or an
installer; auto-update; theming, dark mode or `Application.ThemeMode` (still experimental, emits
`WPF0001`, breaks the warnings gate); localisation beyond honouring the machine culture; EF Core
migrations; charts or reporting; printing; drag-and-drop; a splash screen; export to Excel/PDF;
any commercial control library; more than the single main screen described above.
