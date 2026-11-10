using System.Globalization;
using Microsoft.Extensions.Options;

namespace Admission.Api.Infrastructure;

/// <summary>
/// Runtime settings read from environment variables (see "Configuration" in README.md).
/// Bound lazily so integration tests can override them per host.
/// </summary>
public sealed class AdmissionOptions
{
    public const int DefaultHoldDurationSeconds = 600;

    /// <summary>PDF §1.5: hold lifetime, env <c>HOLD_DURATION_SECONDS</c>, default 600.</summary>
    public int HoldDurationSeconds { get; set; } = DefaultHoldDurationSeconds;

    /// <summary>How often the background sweeper persists EXPIRED holds.</summary>
    public int ExpirySweepSeconds { get; set; } = 5;

    /// <summary>Browser origins allowed by CORS.</summary>
    public string[] CorsOrigins { get; set; } = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"];

    /// <summary>Requests per minute per client IP; 0 disables rate limiting.</summary>
    public int RateLimitPerMinute { get; set; } = 20_000;

    public static void Bind(AdmissionOptions o, IConfiguration cfg)
    {
        o.HoldDurationSeconds = ReadInt(cfg, "HOLD_DURATION_SECONDS", DefaultHoldDurationSeconds, 1, 86_400);
        o.ExpirySweepSeconds = ReadInt(cfg, "EXPIRY_SWEEP_SECONDS", 5, 1, 3_600);
        o.RateLimitPerMinute = ReadInt(cfg, "RATE_LIMIT_PER_MINUTE", 20_000, 0, 10_000_000);

        var origins = cfg["CORS_ORIGINS"];
        if (!string.IsNullOrWhiteSpace(origins))
        {
            o.CorsOrigins = origins
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => x.TrimEnd('/'))
                .ToArray();
        }
    }

    private static int ReadInt(IConfiguration cfg, string key, int fallback, int min, int max)
    {
        var raw = cfg[key];
        if (string.IsNullOrWhiteSpace(raw)) return fallback;

        if (!int.TryParse(raw.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            || value < min || value > max)
        {
            throw new OptionsValidationException(key, typeof(AdmissionOptions),
                [$"{key} must be an integer between {min} and {max}, got '{raw}'."]);
        }

        return value;
    }
}
