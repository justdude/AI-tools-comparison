# Build a production-ready .NET 10 weather backend that runs the moment it is cloned

## Context

> **Shell requirement: use PowerShell 7+ (`pwsh`), not Windows PowerShell 5.1.**
> 5.1 decodes native-command output with the console OEM codepage, so
> `curl.exe ... | ConvertFrom-Json` corrupts UTF-8 (`°C` arrives as `Â°C`) and the
> acceptance checks fail for reasons that have nothing to do with your code.
> Check with `$PSVersionTable.PSVersion`. Install: `winget install Microsoft.PowerShell`.

**Stack (every version below was verified against nuget.org and the .NET release
metadata feed on 27 July 2026 - use these exact versions):**

| Thing | Version |
|---|---|
| .NET SDK | 10.0.302 (LTS; runtime 10.0.10, released 14 Jul 2026) |
| Target framework | `net10.0` |
| `Microsoft.AspNetCore.OpenApi` | 10.0.10 |
| `Microsoft.Extensions.ApiDescription.Server` | 10.0.10 |
| `Microsoft.Extensions.Http.Resilience` | 10.8.0 |
| `Microsoft.Extensions.Caching.Hybrid` | 10.8.0 |
| `Scalar.AspNetCore` | 2.16.16 |
| `Serilog.AspNetCore` | 10.0.0 |
| `Microsoft.AspNetCore.Mvc.Testing` | 10.0.10 |
| `xunit.v3` | 3.2.2 |
| Docker base images | `mcr.microsoft.com/dotnet/sdk:10.0`, `mcr.microsoft.com/dotnet/aspnet:10.0` |

Health checks and output caching are in the ASP.NET Core shared framework - **do not add
packages for them**. Do not add `AspNetCore.HealthChecks.*`.
`Serilog.Formatting.Compact` 3.0.0 arrives transitively with `Serilog.AspNetCore` 10.0.0
(verified in its nuspec) - do not add it separately.

> **TEST RUNNER - GET THIS RIGHT OR NOTHING RUNS.**
> `xunit.v3` 3.2.2 is a metapackage that installs `xunit.v3.mtp-v1`: it is
> **Microsoft Testing Platform** based. **Do NOT add `Microsoft.NET.Test.Sdk` and do NOT
> add `xunit.runner.visualstudio`.** Those are the VSTest path and are mutually exclusive
> with MTP - together with `<OutputType>Exe</OutputType>` they produce
> `CS0017: Program has more than one entry point`, or build and then report
> "no tests were found". (xunit ships a separate `xunit.v3.mtp-off` package precisely
> because these are alternatives.) The test project needs exactly two PackageReferences:
> `xunit.v3` and `Microsoft.AspNetCore.Mvc.Testing`.

**Target folder:** create everything under `./weather-api/`. There is no existing repo -
create the folder, `git init` it, and create every file listed below.

**Team is on Windows.** In PowerShell `curl` is an alias for `Invoke-WebRequest`, so
**always write `curl.exe`** when you mean curl.

### Weather provider: Open-Meteo - NO API KEY, NO ACCOUNT

> **LICENCE - READ THIS NOW, NOT IN AN HOUR.**
> Open-Meteo's free API needs no key and no signup, which is why it is used here.
> It is **non-commercial use only**: CC-BY 4.0 attribution, under 10 000 calls/day,
> 5 000/hour, 600/minute. Websites or apps with subscriptions or advertising are
> commercial use and require a paid plan, which changes the host to
> `https://customer-api.open-meteo.com/v1/` and adds an `apikey` query parameter.
> Build both of those as **configuration** (`OpenMeteo:BaseAddress`, `OpenMeteo:ApiKey`)
> so the switch is a settings change, not a code change. Put this warning in README.md
> too. Paid key-gated alternatives for production: Tomorrow.io, WeatherAPI.com,
> AccuWeather.

**Network requirement:** the build and the whole test suite run **fully offline**.
Only the live-endpoint acceptance checks need outbound HTTPS to `api.open-meteo.com`
and `geocoding-api.open-meteo.com`. Behind a corporate proxy, point
`OpenMeteo:BaseAddress` at your proxy or set `HTTPS_PROXY`.

Both endpoints below were called live on 28 July 2026; these are their real shapes.

**Forecast** - `GET https://api.open-meteo.com/v1/forecast`
Query: `latitude`, `longitude`, `timezone=auto`, `forecast_days={1..16}`,
`current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m`,
`daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset`

```json
{ "latitude":52.52,"longitude":13.419998,"generationtime_ms":0.36,
  "utc_offset_seconds":7200,"timezone":"Europe/Berlin",
  "timezone_abbreviation":"GMT+2","elevation":38.0,
  "current_units":{"time":"iso8601","interval":"seconds","temperature_2m":"°C",
    "relative_humidity_2m":"%","apparent_temperature":"°C","is_day":"",
    "precipitation":"mm","weather_code":"wmo code","wind_speed_10m":"km/h",
    "wind_direction_10m":"°"},
  "current":{"time":"2026-07-28T15:45","interval":900,"temperature_2m":22.5,
    "relative_humidity_2m":42,"apparent_temperature":20.3,"is_day":1,
    "precipitation":0.0,"weather_code":2,"wind_speed_10m":13.6,
    "wind_direction_10m":292},
  "daily_units":{ "...": "..." },
  "daily":{"time":["2026-07-28","2026-07-29"],"weather_code":[3,3],
    "temperature_2m_max":[23.4,29.8],"temperature_2m_min":[12.8,16.8],
    "precipitation_sum":[0.0,0.0],"wind_speed_10m_max":[16.3,13.0],
    "sunrise":["2026-07-28T05:20","2026-07-29T05:21"],
    "sunset":["2026-07-28T21:05","2026-07-29T21:03"]}}
```

`forecast_days=17` returns **HTTP 400** from Open-Meteo (verified) - validate `1..16`
yourself so the caller gets your ProblemDetails, not theirs.

**Geocoding** - `GET https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=en&format=json`

```json
{"results":[{"id":703448,"name":"Kyiv","latitude":50.45466,"longitude":30.5238,
  "elevation":179.0,"feature_code":"PPLC","country_code":"UA","timezone":"Europe/Kyiv",
  "population":2952301,"country":"Ukraine","admin1":"Kyiv City"}],
 "generationtime_ms":1.58}
```

**When nothing matches, the `results` key is absent entirely** - the body is literally
`{"generationtime_ms":0.10871887}` (verified live). Model `Results` as a nullable array
and treat null-or-empty as "not found". Do not assume an empty array.

> **LANDMINE:** Open-Meteo returns `"2026-07-28T15:45"` - **no seconds**.
> `System.Text.Json` requires at least `yyyy-MM-ddTHH:mm:ss` and throws on that.
> Declare every provider time field as `string` and map with
> `DateTime.ParseExact(s, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture)`
> and `DateOnly.ParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture)`.

## Scaffold

Create exactly this tree:

```
weather-api/
├─ .claude/skills/weather-api/SKILL.md      (paste the companion skill here)
├─ .editorconfig  .gitignore  .dockerignore  README.md  LICENSE-NOTICE.md
├─ global.json  Directory.Build.props  Directory.Packages.props  WeatherApi.sln
├─ Dockerfile
├─ src/WeatherApi/
│  ├─ WeatherApi.csproj  Program.cs
│  ├─ appsettings.json  appsettings.Development.json
│  ├─ Properties/launchSettings.json
│  ├─ Endpoints/ForecastEndpoints.cs
│  ├─ Contracts/ForecastResponse.cs        (all public wire DTOs, one file)
│  ├─ Weather/IWeatherService.cs  WeatherService.cs  WeatherMapper.cs
│  ├─ Weather/OpenMeteoClient.cs  OpenMeteoOptions.cs  OpenMeteoModels.cs
│  ├─ Weather/WmoWeatherCode.cs  WeatherProviderException.cs
│  ├─ Diagnostics/ProviderHealthCheck.cs  WeatherExceptionHandler.cs
│  └─ openapi/WeatherApi.json              (generated at build, committed)
└─ tests/WeatherApi.Tests/
   ├─ WeatherApi.Tests.csproj
   ├─ WeatherApiFactory.cs  StubHttpMessageHandler.cs
   ├─ ForecastEndpointTests.cs  GeocodingTests.cs  ErrorContractTests.cs
   ├─ CachingTests.cs  HealthCheckTests.cs  OpenApiDocumentTests.cs
   └─ Fixtures/forecast.json  geocode-kyiv.json  geocode-empty.json
```

Bootstrap (pwsh):

```powershell
mkdir weather-api; cd weather-api; git init
dotnet new sln -n WeatherApi
mkdir src, tests
dotnet new web      -n WeatherApi       -o src/WeatherApi         -f net10.0
dotnet new classlib -n WeatherApi.Tests -o tests/WeatherApi.Tests -f net10.0
Remove-Item tests/WeatherApi.Tests/Class1.cs
dotnet sln add src/WeatherApi/WeatherApi.csproj tests/WeatherApi.Tests/WeatherApi.Tests.csproj
```

Then **overwrite both `.csproj` files by hand** (do not use `dotnet add package` -
this repo uses Central Package Management).

`global.json`:
`{"sdk":{"version":"10.0.302","rollForward":"latestFeature","allowPrerelease":false}}`
(10.0.302 is the SDK that actually ships in the 10.0.10 release; do not pin 10.0.100,
which is not installed anywhere and only works by accident via roll-forward.)

`Directory.Build.props` sets, for all projects: `net10.0`, `ImplicitUsings=enable`,
`Nullable=enable`, `TreatWarningsAsErrors=true`, `InvariantGlobalization=true`, and
**explicitly**:

```xml
<EnforceCodeStyleInBuild>false</EnforceCodeStyleInBuild>
<CodeAnalysisTreatWarningsAsErrors>false</CodeAnalysisTreatWarningsAsErrors>
```

Those two matter: with `-warnaserror` they would otherwise promote every IDE####
style diagnostic and CA#### analyzer warning to a build error, and freshly generated
code fails on cosmetics (IDE0005, IDE0055) rather than on real defects. Style is
gated separately by `dotnet format`. The compiler + nullable warnings remain errors -
that is the type gate.

`Directory.Packages.props` sets `ManagePackageVersionsCentrally=true` and holds every
version from the table above as `<PackageVersion>`.

`src/WeatherApi/WeatherApi.csproj` additionally sets:

```xml
<GenerateDocumentationFile>true</GenerateDocumentationFile>
<NoWarn>$(NoWarn);CS1591</NoWarn>
<OpenApiGenerateDocuments>true</OpenApiGenerateDocuments>
<OpenApiDocumentsDirectory>$(MSBuildProjectDirectory)/openapi</OpenApiDocumentsDirectory>
```
and references `Microsoft.Extensions.ApiDescription.Server` with `PrivateAssets="all"`.
The generated file takes the project's name, so it lands at `openapi/WeatherApi.json`.

`tests/WeatherApi.Tests/WeatherApi.Tests.csproj`:

```xml
<OutputType>Exe</OutputType>
<TestingPlatformDotnetTestSupport>true</TestingPlatformDotnetTestSupport>
<IsPackable>false</IsPackable>
<GenerateDocumentationFile>false</GenerateDocumentationFile>
```
PackageReferences: **only** `xunit.v3` and `Microsoft.AspNetCore.Mvc.Testing`, plus a
ProjectReference to `src/WeatherApi`, plus `Fixtures/*.json` with
`CopyToOutputDirectory=PreserveNewest`.

`src/WeatherApi/Properties/launchSettings.json` - **the port is load-bearing**; every
acceptance command below uses 5080. Write exactly one profile, HTTP only (an https
profile triggers a `dotnet dev-certs https --trust` prompt on Windows):

```json
{ "profiles": { "http": {
    "commandName": "Project",
    "applicationUrl": "http://localhost:5080",
    "launchBrowser": false,
    "environmentVariables": { "ASPNETCORE_ENVIRONMENT": "Development" } } } }
```

**Final scaffold steps, in this order** (they make acceptance criteria 3 and 8 meaningful):

```powershell
dotnet format WeatherApi.sln          # normalise style so --verify-no-changes passes
dotnet build -c Release               # generates openapi/WeatherApi.json
git add -A
git commit -m "Initial WeatherApi scaffold"
```

## Requirements

1. **Two endpoint shapes, one route.**
   - `GET /forecast?lat={-90..90}&lon={-180..180}&days={1..16}`
   - `GET /forecast?city={name}&days={1..16}` - geocode the name first, then forecast.
   - `days` defaults to `7`. Exactly one of `(lat AND lon)` or `city` must be supplied;
     supplying both, neither, or only one of lat/lon is a 400.

2. **Named static handler methods, never lambdas.** Write
   `app.MapGet("/forecast", ForecastEndpoints.GetForecastAsync)`. The C# compiler does
   not emit XML doc comments for lambdas, so a lambda handler produces an OpenAPI
   operation with an empty summary. Put `<summary>`, `<remarks>`, `<param>` and
   `<returns>` XML doc comments on every handler method; `<GenerateDocumentationFile>`
   plus the `Microsoft.AspNetCore.OpenApi` source generator pulls them into the
   document automatically.

3. **Typed `HttpClient` for the provider, with resilience.** (`DelayBackoffType`
   requires `using Polly;`.)
   ```csharp
   builder.Services.AddHttpClient<OpenMeteoClient>((sp, c) => { /* BaseAddress from options */ })
       .AddStandardResilienceHandler(o =>
       {
           o.AttemptTimeout.Timeout        = TimeSpan.FromSeconds(5);
           o.TotalRequestTimeout.Timeout   = TimeSpan.FromSeconds(30);
           o.Retry.MaxRetryAttempts        = 3;
           o.Retry.BackoffType             = DelayBackoffType.Exponential;
           o.Retry.UseJitter               = true;
           o.Retry.Delay                   = TimeSpan.FromMilliseconds(500);
           o.CircuitBreaker.SamplingDuration  = TimeSpan.FromSeconds(30);
           o.CircuitBreaker.FailureRatio      = 0.5;
           o.CircuitBreaker.MinimumThroughput = 5;
           o.CircuitBreaker.BreakDuration     = TimeSpan.FromSeconds(15);
       });
   ```
   These values satisfy the options validator, which throws at **startup** if
   `TotalRequestTimeout <= AttemptTimeout` or
   `CircuitBreaker.SamplingDuration < 2 x AttemptTimeout`. Do not lower them casually.
   Register `OpenMeteoOptions` with
   `AddOptions<T>().BindConfiguration("OpenMeteo").ValidateDataAnnotations().ValidateOnStart()`.

4. **`HybridCache` in front of the provider.** `AddHybridCache` with
   `DefaultEntryOptions { Expiration = 10 min, LocalCacheExpiration = 10 min }`.
   `WeatherService` calls
   `cache.GetOrCreateAsync($"fc:{lat:F2}:{lon:F2}:{days}", ct => ..., cancellationToken: ct)`.
   The factory must return `ValueTask<T>`, not `Task<T>`.
   Geocoding results cache for 24 h under `geo:{name.ToLowerInvariant()}`.
   **Round coordinates to 2 decimals in the key** - Open-Meteo's grid is ~1 km, and
   unrounded doubles give a 100 % miss rate.
   Separately: `AddOutputCache()` + `app.UseOutputCache()` + `app.MapOpenApi().CacheOutput()`
   so the OpenAPI document is not re-serialised per request. Do **not** put output caching
   on `/forecast` - it would make requirement 10's cache test vacuous.

5. **RFC 9457 ProblemDetails everywhere.** `builder.Services.AddProblemDetails(o =>
   o.CustomizeProblemDetails = ctx => ctx.ProblemDetails.Extensions["traceId"] =
   Activity.Current?.Id ?? ctx.HttpContext.TraceIdentifier);` plus
   `app.UseExceptionHandler(); app.UseStatusCodePages();`.
   Register `WeatherExceptionHandler : IExceptionHandler` via `AddExceptionHandler<T>()`;
   it maps `WeatherProviderException` -> **502** ("Upstream weather provider failed"),
   `Polly.Timeout.TimeoutRejectedException`/`TaskCanceledException` (when the caller has
   **not** cancelled) -> **504**, and returns `false` for everything else. City not found
   -> **404** returned directly from the handler via `TypedResults.Problem(...)`.
   Invalid input -> **400**. Never put a provider URL or exception message into `detail`
   outside Development. Every failure response must be `application/problem+json`.

6. **`CancellationToken` through every layer** - endpoint parameter -> service ->
   `GetOrCreateAsync` factory -> `HttpClient.GetAsync`. No `.Result`, no `.Wait()`,
   no `CancellationToken.None` outside `Program.cs`.

7. **Response contract** (200), units stated explicitly:
   ```json
   { "location": {"name":"Kyiv","country":"Ukraine","admin1":"Kyiv City",
       "latitude":50.45,"longitude":30.52,"timezone":"Europe/Kyiv",
       "utcOffsetSeconds":10800,"elevationMetres":179.0},
     "units": {"temperature":"°C","windSpeed":"km/h","precipitation":"mm",
       "elevation":"m","time":"local time of the location, ISO-8601, no offset"},
     "current": {"observedAtLocal":"2026-07-28T15:45:00","temperature":22.5,
       "apparentTemperature":20.3,"relativeHumidityPercent":42,"precipitation":0.0,
       "windSpeed":13.6,"windDirectionDegrees":292,"isDay":true,
       "weatherCode":2,"condition":"Partly cloudy"},
     "daily": [{"date":"2026-07-28","temperatureMax":23.4,"temperatureMin":12.8,
       "precipitationSum":0.0,"windSpeedMax":16.3,
       "sunriseLocal":"2026-07-28T05:20:00","sunsetLocal":"2026-07-28T21:05:00",
       "weatherCode":3,"condition":"Overcast"}],
     "provider":"open-meteo","retrievedAtUtc":"2026-07-28T13:45:12.345Z" }
   ```
   `name`/`country`/`admin1` are `null` for the lat/lon shape. Use `record` types with
   `camelCase` JSON. `WmoWeatherCode.Describe(int)` maps the full WMO table:
   0 Clear sky, 1 Mainly clear, 2 Partly cloudy, 3 Overcast, 45 Fog, 48 Depositing rime
   fog, 51/53/55 Light/Moderate/Dense drizzle, 56/57 Light/Dense freezing drizzle,
   61/63/65 Slight/Moderate/Heavy rain, 66/67 Light/Heavy freezing rain,
   71/73/75 Slight/Moderate/Heavy snowfall, 77 Snow grains,
   80/81/82 Slight/Moderate/Violent rain showers, 85/86 Slight/Heavy snow showers,
   95 Thunderstorm, 96/99 Thunderstorm with slight/heavy hail, else "Unknown".

8. **Health checks.** `AddHealthChecks()` with a self check tagged `live` and a
   `ProviderHealthCheck` tagged `ready` that issues one short-timeout Open-Meteo request.
   On provider failure it returns `HealthStatus.Degraded`, **not** `Unhealthy` - a dead
   upstream must not get your pod killed. Degraded serialises to HTTP 200 with body
   `Degraded`, which is why the acceptance check accepts `Healthy` **or** `Degraded`.
   Map `/health/live` (predicate: tag `live`) and `/health/ready` (predicate: tag `ready`).

9. **Structured logging + OpenAPI + a UI a human can see.**
   Serilog via `builder.Services.AddSerilog((sp, cfg) => cfg.ReadFrom.Configuration(...)
   .ReadFrom.Services(sp).Enrich.FromLogContext()
   .WriteTo.Console(new CompactJsonFormatter()))`, plus `app.UseSerilogRequestLogging()`.
   Log provider calls with message templates and named properties (`{Latitude}`,
   `{Longitude}`, `{Days}`, `{ElapsedMs}`) - never string interpolation.
   `AddOpenApi()` + `MapOpenApi()` + `MapScalarApiReference()`. Scalar 2.16.16 embeds its
   own JS bundle, so the UI works offline; its default prefix is `/scalar` and
   `/scalar/v1` selects the `v1` document. `GET /` redirects to `/scalar/v1` with a
   **temporary** redirect - `Results.Redirect("/scalar/v1", permanent: false)`. Never 301
   here: browsers cache permanent redirects indefinitely and you will be unable to
   repoint `/` later without clearing every developer's cache.

10. **Integration tests - the network is off limits.**
    `WeatherApiFactory : WebApplicationFactory<Program>` overriding
    `ConfigureWebHost` -> `builder.ConfigureTestServices(s =>
    s.AddHttpClient<OpenMeteoClient>().ConfigurePrimaryHttpMessageHandler(() => Stub))`
    (last registration wins; the resilience handler stays in place). Add
    `public partial class Program { }` at the bottom of `Program.cs` so the factory can
    reference it. `StubHttpMessageHandler` serves the `Fixtures/*.json` files by URL
    substring and counts requests. Minimum 12 tests covering:
    lat/lon 200 + exact JSON field assertions; city 200 with populated location;
    unknown city (the `geocode-empty.json` fixture, which has **no** `results` key)
    -> 404 `application/problem+json`; `lat=999` -> 400; both `city` and `lat` -> 400;
    `days=0` and `days=17` -> 400; provider 500 -> 502 with `application/problem+json`
    and stub call count `>= 2` (retry fired - assert a range, never an exact count,
    jitter is on); **two identical `GET /forecast?lat=52.52&lon=13.41&days=3` calls ->
    forecast stub called exactly once** (HybridCache; use the lat/lon shape - the
    `?city=` shape costs two upstream calls on a cold cache, so "exactly once" is false
    there); two identical `?city=Kyiv` calls -> geocode fixture served exactly once;
    `/health/live` and `/health/ready` -> 200; `/openapi/v1.json` -> 200 and contains
    `"/forecast"` and a non-empty `summary`.

11. **Dockerfile** - multi-stage, `sdk:10.0` -> `aspnet:10.0`, `USER $APP_UID`,
    `EXPOSE 8080` (the .NET 8+ images already default `ASPNETCORE_HTTP_PORTS=8080`).
    Pass `-p:OpenApiGenerateDocuments=false` to `dotnet publish`: the document is already
    committed, and build-time generation launches the app inside the image for no reason.
    `.dockerignore` excludes `bin`, `obj`, `.git`, `.vs`.

12. **README.md** - the licence warning above verbatim at the top, the pwsh 7 requirement,
    then the three commands to run it, the two endpoint shapes with real example URLs,
    the units table, and the error-code table.

13. **Know that `Program.cs` executes during `dotnet build`.** `Microsoft.Extensions.ApiDescription.Server`
    generates the OpenAPI document by launching your entry point against a mock server, so
    startup logic runs at build time and a bad config value becomes a *build* error with a
    `GetDocument.Insider` stack trace. Guard anything that must not run then with
    `if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")`.

## Acceptance criteria

Run from `weather-api/` in **pwsh 7+**.

### Block A - offline. These must pass with the network cable unplugged.

1. `dotnet format WeatherApi.sln --verify-no-changes` exits **0** (lint gate).
2. `dotnet build -c Release -warnaserror` exits **0** and prints **0 warnings** (type gate).
3. `dotnet test -c Release` exits **0**, and no test makes a real HTTP call.
   Test count threshold:
   ```powershell
   $n = (Get-ChildItem tests -Recurse -Filter *.cs |
         Select-String -Pattern '^\s*\[(Fact|Theory)\b' -AllMatches).Count
   if ($n -lt 12) { Write-Error "only $n tests"; exit 1 }
   ```
4. The committed OpenAPI document matches what the build regenerates, and is actually
   tracked by git:
   ```powershell
   dotnet build -c Release --no-incremental
   $s = git status --porcelain -- src/WeatherApi/openapi/WeatherApi.json
   if ($s) { Write-Error "OpenAPI doc untracked or drifted: $s"; exit 1 }
   ```
   `git status --porcelain` is used deliberately instead of `git diff --exit-code`:
   `git diff` exits **0** for an **untracked** file, so on a fresh clone it would pass
   without checking anything.
5. Generation is deterministic across repeated builds:
   ```powershell
   $h1 = (Get-FileHash src\WeatherApi\openapi\WeatherApi.json).Hash
   dotnet build -c Release --no-incremental | Out-Null
   $h2 = (Get-FileHash src\WeatherApi\openapi\WeatherApi.json).Hash
   if ($h1 -ne $h2) { Write-Error "OpenAPI generation is not deterministic"; exit 1 }
   ```
   The file must also contain `"/forecast"` and a non-empty `"summary"` for it:
   ```powershell
   $d = Get-Content src\WeatherApi\openapi\WeatherApi.json -Raw | ConvertFrom-Json
   if (-not $d.paths.'/forecast'.get.summary) { Write-Error "empty summary"; exit 1 }
   ```
6. No placeholders anywhere in the app source:
   ```powershell
   $m = Get-ChildItem -Path src\WeatherApi -Recurse -Filter *.cs |
        Select-String -Pattern 'TODO|NotImplementedException|NotSupportedException'
   if ($m) { $m; exit 1 }
   ```
   (`Select-String -Path src\WeatherApi\**\*.cs` does **not** work - PowerShell provider
   wildcards are not recursive, so `**` matches exactly one directory level and misses
   `Program.cs` entirely.)

### Block B - online. Requires outbound HTTPS to open-meteo.com.

7. `dotnet run --project src/WeatherApi` starts and binds `http://localhost:5080`; then
   in a second shell:
   - `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5080/forecast?city=Kyiv"` prints **200**
   - `(curl.exe -s "http://localhost:5080/forecast?city=Kyiv" | ConvertFrom-Json).daily.Count` is **7**
   - `(curl.exe -s "http://localhost:5080/forecast?city=Kyiv" | ConvertFrom-Json).units.windSpeed` is **km/h**
     (ASCII on purpose - `°C` round-trips only in pwsh 7, not Windows PowerShell 5.1)
   - `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5080/forecast?lat=52.52&lon=13.41&days=3"` prints **200**
   - `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5080/forecast?lat=999&lon=0"` prints **400**
   - `curl.exe -s -D - -o NUL "http://localhost:5080/forecast?lat=999&lon=0"` contains `application/problem+json`
   - `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5080/forecast?city=Xxqqzz"` prints **404**
   - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5080/health/live` prints **200**
   - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:5080/health/ready` prints **200**,
     and `curl.exe -s http://localhost:5080/health/ready` prints **Healthy** or **Degraded**
     (Degraded is the correct, by-design answer when the upstream is unreachable - see
     requirement 8)
8. Browsing to `http://localhost:5080/` lands on the Scalar UI at `/scalar/v1`, which
   lists `GET /forecast` **with a visible summary and parameter descriptions**
   (empty summaries mean requirement 2 was violated). Criterion 5's `summary` check is
   the scriptable form of this.
9. `docker build -t weather-api:local .` exits **0**; then
   `docker run --rm -p 8080:8080 weather-api:local` and
   `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/health/ready` prints **200**.
   *(Requires Docker Desktop in Linux-container mode.)*

## Out of scope

Do not build: a database, EF Core, migrations, or any persistence. Authentication,
authorisation, API keys or rate limiting of *your* API. A frontend beyond the Scalar UI.
Redis or any L2 `IDistributedCache` (HybridCache's L1 is enough - leave a one-line
comment showing where `AddStackExchangeRedisCache` would go). OpenTelemetry exporters,
Aspire, Kubernetes manifests, Helm charts, CI YAML. Historical or archive weather
endpoints, air quality, marine, or radar. Multi-provider abstraction beyond the single
`IWeatherProvider` interface - do not write a second provider. Localisation of condition
strings. Do not gold-plate: when a requirement is met, stop.