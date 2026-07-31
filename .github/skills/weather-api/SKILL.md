---
name: weather-api
description: Conventions for the WeatherApi .NET 10 minimal-API weather backend (src/WeatherApi, tests/WeatherApi.Tests). Use when editing Program.cs, Endpoints/*.cs, Weather/*.cs, Diagnostics/*.cs, WeatherApi.csproj, Directory.Packages.props, Dockerfile or openapi/WeatherApi.json; when adding or changing a /forecast endpoint, an Open-Meteo call, a typed HttpClient, HybridCache usage, a ProblemDetails response, a health check, or a WebApplicationFactory test. Triggers on the words developers type here - "weather api", "forecast endpoint", "open-meteo", "geocoding", "add resilience", "AddStandardResilienceHandler", "Microsoft.Extensions.Caching.Hybrid", "AddHybridCache", "Microsoft.AspNetCore.OpenApi", "regenerate the openapi document", "add a second weather provider", "why is my OpenAPI summary empty", "why did the provider get called twice", "no tests were found", "multiple entry points".
---

# WeatherApi conventions

## 0. Licence gate - read before shipping

Open-Meteo's free API is **non-commercial only** (CC-BY 4.0; < 10 000 calls/day,
5 000/hour, 600/minute). No key, no account. **Any** product with subscriptions or
ads is commercial use and needs a paid plan: base URL becomes
`https://customer-api.open-meteo.com/v1/` plus an `apikey` query parameter.
Keep that switch a **config change only** (`OpenMeteo:BaseAddress`, `OpenMeteo:ApiKey`).
Never hard-code the host. Paid alternatives: Tomorrow.io, WeatherAPI.com, AccuWeather -
all key-gated, all commercial.

## 1. Architecture and dependency direction

```
Endpoints/  -> Weather/ (IWeatherService) -> Weather/OpenMeteoClient (typed HttpClient)
Contracts/  = public wire DTOs. Weather/OpenMeteo*.cs = internal provider DTOs.
```

- Endpoints never see a provider DTO. Providers never see a `Contracts` type.
- Mapping lives in one place: `Weather/WeatherMapper.cs`.
- Adding a provider means a new `IWeatherProvider` implementation. It does **not**
  mean touching `Contracts/` or `Endpoints/`.

## 2. Non-negotiables

1. **Every endpoint handler is a named `static` method**, referenced from `MapGet`.
   Never a lambda. The C# compiler does not emit XML doc comments for lambdas, so a
   lambda handler silently produces an OpenAPI operation with no summary. This is the
   single most common regression in this repo.
2. **`CancellationToken` is the last parameter of every async method**, threaded
   endpoint -> service -> cache factory -> `HttpClient`. No `.Result`, no `.Wait()`,
   no `CancellationToken.None` outside `Program.cs`.
3. **Never bind Open-Meteo time strings to `DateTime` with System.Text.Json.**
   Open-Meteo returns `"2026-07-28T15:45"` - no seconds - and STJ throws on it.
   Provider DTOs declare these as `string`; map with
   `DateTime.ParseExact(s, "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture)` and
   `DateOnly.ParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture)`.
4. **One resilience handler per client.** `AddStandardResilienceHandler` only. Never
   stack it with a hand-rolled Polly pipeline or `Microsoft.Extensions.Http.Polly`.
   Its validator enforces `TotalRequestTimeout > AttemptTimeout` and
   `CircuitBreaker.SamplingDuration >= 2 x AttemptTimeout` - violating either throws
   at startup, not at request time. `DelayBackoffType` needs `using Polly;`.
5. **Cache provider results, not HTTP responses**, for `/forecast`. `HybridCache`
   keyed on rounded coordinates + day count is the anti-hammering layer.
   The `GetOrCreateAsync` factory must return `ValueTask<T>`, not `Task<T>`.
   `OutputCache` is used **only** on the OpenAPI document endpoint. Do not stack them
   on the same resource; it makes the "provider called once" test vacuous.
6. **All errors are RFC 9457 `application/problem+json`.** Enabled by
   `AddProblemDetails()` + `UseExceptionHandler()` + `UseStatusCodePages()`.
   Domain failures map through `IExceptionHandler`, never through a `try/catch` in an
   endpoint. Provider failure -> 502. Provider timeout -> 504. Unknown city -> 404.
   Bad input -> 400. Never leak a provider URL, stack trace or exception message
   into `detail` outside Development.
7. **Cache keys round coordinates to 2 decimals** (`lat.ToString("F2")`). Open-Meteo's
   grid is ~1 km; unrounded floats give you a 100 % miss rate and a rate-limit ban.
8. **Central package management only.** Versions live in `Directory.Packages.props`.
   A `Version=` attribute in a `.csproj` is a bug.
9. **`Program.cs` runs at build time.** `Microsoft.Extensions.ApiDescription.Server`
   generates the OpenAPI document by launching the entry point against a mock server,
   so startup logic executes during `dotnet build`. A bad config value becomes a
   *build* error. Guard anything that must not run then with
   `if (Assembly.GetEntryAssembly()?.GetName().Name != "GetDocument.Insider")`.

## 3. Units - stated, never assumed

Celsius, km/h, mm, metres. Timestamps are **local to the requested location**
(`timezone=auto`), ISO-8601 without offset; `utcOffsetSeconds` is returned alongside.
Every 200 response carries a `units` object. If you change a unit, change it in
`OpenMeteoClient`'s query string, in `Contracts/UnitsDto`, and in the tests, or the
response starts lying.

## 4. Testing - Microsoft Testing Platform, not VSTest

- `xunit.v3` 3.2.x **is** MTP (it resolves to `xunit.v3.mtp-v1`). The test project sets
  `<OutputType>Exe</OutputType>` and `<TestingPlatformDotnetTestSupport>true</...>`.
- **Never add `Microsoft.NET.Test.Sdk` or `xunit.runner.visualstudio` here.** They are
  the VSTest path and are mutually exclusive with MTP: together they produce CS0017
  ("more than one entry point") or a silent "no tests were found". If you genuinely
  need VSTest, swap `xunit.v3` for `xunit.v3.mtp-off` - do not run both.
- `WebApplicationFactory<Program>` + a `StubHttpMessageHandler` wired via
  `services.AddHttpClient<OpenMeteoClient>().ConfigurePrimaryHttpMessageHandler(...)`
  in `ConfigureTestServices`. Last registration wins; the resilience handler survives.
- **A test that touches the network is a broken test.** Fixtures in
  `tests/WeatherApi.Tests/Fixtures/*.json` are verbatim captures of real responses.
- Assert on status code **and** `Content-Type: application/problem+json` for failures.
- Retry assertions are `>= 2` calls, never an exact count - jitter is on.
- Cache assertions use the **lat/lon** shape only. The `?city=` shape costs two
  upstream calls on a cold cache (geocode + forecast), so "called exactly once" is
  false there by construction.

## 5. Prohibitions

- No Swashbuckle, no NSwag. `Microsoft.AspNetCore.OpenApi` + Scalar only.
- No `IMemoryCache` or `IDistributedCache` injected directly - `HybridCache` only.
- No `HttpClient` constructed with `new`. Typed clients from DI only.
- No permanent (301) redirects on dev routes - browsers cache them forever. Use 302.
- No `EnforceCodeStyleInBuild` / analyzer warnings-as-errors. `dotnet format` is the
  style gate; the compiler is the type gate. Keep them separate.
- No secrets or keys committed for the free tier - there is nothing to secure, and
  adding a fake key invites a real one.
- No `catch (Exception)` in an endpoint method.

## 6. Exit criteria - a change is done when all five pass

Run in **PowerShell 7+ (`pwsh`)**; Windows PowerShell 5.1 mangles UTF-8 output.

```powershell
dotnet format WeatherApi.sln --verify-no-changes            # lint gate
dotnet build -c Release -warnaserror                        # type gate, 0 warnings
dotnet test  -c Release                                     # all green, no network
git status --porcelain -- src/WeatherApi/openapi/WeatherApi.json   # MUST print nothing
docker build -t weather-api:local .                         # image builds
```

`git status --porcelain` is deliberate: unlike `git diff --exit-code`, it fails on an
**untracked** document as well as a drifted one. `git diff` exits 0 for untracked
files, so it would gate nothing on a fresh clone. If that line prints anything, the
public contract changed or was never committed - review it, then commit it in the
same PR as the code.