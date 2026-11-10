using System.Threading.RateLimiting;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Endpoints;
using Admission.Api.Infrastructure;
using Admission.Api.Migrations;
using Admission.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http.Timeouts;
using Microsoft.Extensions.Options;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(kestrel =>
{
    kestrel.AddServerHeader = false;
    kestrel.Limits.MaxRequestBodySize = 16 * 1024; // the largest valid body is ~150 bytes
});

// ---- configuration (env vars, see "Configuration" in README.md) ----
builder.Services.AddOptions<AdmissionOptions>()
    .Configure<IConfiguration>(AdmissionOptions.Bind)
    .ValidateOnStart();

// ---- data + domain services ----
builder.Services.AddDatabase();
builder.Services.AddSingleton<ClassService>();
builder.Services.AddSingleton<HoldService>();
builder.Services.AddHostedService<HoldExpiryService>();

// ---- errors: one JSON shape, never a stack trace ----
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();

// ---- CORS: only the configured frontend origins ----
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>()
    .Configure<IOptions<AdmissionOptions>>((cors, opts) => cors.AddDefaultPolicy(policy => policy
        .WithOrigins(opts.Value.CorsOrigins)
        .WithMethods("GET", "POST", "DELETE")
        .WithHeaders("Content-Type", StudentId.HeaderName)
        .WithExposedHeaders("Date") // the UI uses it to correct for clock skew in the countdown
        .SetPreflightMaxAge(TimeSpan.FromMinutes(10))));

// ---- rate limiting: generous per-IP window so load tests are never throttled ----
builder.Services.AddRateLimiter(limiter =>
{
    limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    limiter.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new ErrorBody(new ErrorDetail(ErrorCodes.RateLimited, "Too many requests. Please slow down.")), ct);
    };
    limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var perMinute = ctx.RequestServices.GetRequiredService<IOptions<AdmissionOptions>>().Value.RateLimitPerMinute;
        if (perMinute <= 0) return RateLimitPartition.GetNoLimiter("disabled");

        var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = perMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    });
});

builder.Services.AddRequestTimeouts(t => t.DefaultPolicy = new RequestTimeoutPolicy { Timeout = TimeSpan.FromSeconds(30) });

var app = builder.Build();

app.UseExceptionHandler();
app.UseSecurityHeaders();
app.UseStatusCodePages(async ctx =>
{
    // Unknown route / wrong method: still answer with the JSON error shape.
    var res = ctx.HttpContext.Response;
    var (code, message) = res.StatusCode switch
    {
        404 => (ErrorCodes.NotFound, "Resource not found."),
        405 => (ErrorCodes.ValidationFailed, "Method not allowed on this resource."),
        _ => (ErrorCodes.ValidationFailed, "The request could not be processed."),
    };
    await res.WriteAsJsonAsync(new ErrorBody(new ErrorDetail(code, message)));
});
app.UseCors();
app.UseRateLimiter();
app.UseRequestTimeouts();

app.MapGet("/health", async (NpgsqlDataSource db, CancellationToken ct) =>
{
    await using var conn = await db.OpenConnectionAsync(ct);
    await conn.ExecuteScalarAsync<int>("SELECT 1");
    return Results.Ok(new { status = "ok" });
});
app.MapClassEndpoints();
app.MapHoldEndpoints();

await MigrationRunner.RunAsync(app.Services);

app.Run();

/// <summary>Exposed for WebApplicationFactory in the integration tests.</summary>
public partial class Program { }
