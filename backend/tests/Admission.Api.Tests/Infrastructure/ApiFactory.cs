using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Admission.Api.Tests.Infrastructure;

/// <summary>
/// Boots the real API in memory against the test database. Each instance is an independent
/// app host with its own connection pool and background sweeper — two instances on one database
/// behave like two backend processes (bonus §1.6).
/// </summary>
public sealed class ApiFactory(string connectionString, int holdDurationSeconds = 600) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = connectionString,
            ["HOLD_DURATION_SECONDS"] = holdDurationSeconds.ToString(),
            ["EXPIRY_SWEEP_SECONDS"] = "1",
            ["RATE_LIMIT_PER_MINUTE"] = "0",
        }));
    }
}

/// <summary>Small helpers so tests read like the API contract.</summary>
public static class Api
{
    public const string Header = "X-Student-Id";

    private static int _studentSeq;

    /// <summary>A fresh, valid 17-digit birth registration number.</summary>
    public static string NewStudentId() =>
        "2015" + Interlocked.Increment(ref _studentSeq).ToString("D6") + Random.Shared.NextInt64(0, 10_000_000).ToString("D7");

    public static async Task<string> CreateClassAsync(this HttpClient http, int seats, string name = "Class 6 - Morning Shift")
    {
        var res = await http.PostAsJsonAsync("/classes", new { name, totalSeats = seats });
        Assert.Equal(System.Net.HttpStatusCode.Created, res.StatusCode);
        return (await res.ReadJsonAsync()).GetProperty("id").GetString()!;
    }

    public static Task<HttpResponseMessage> HoldAsync(this HttpClient http, string classId, string? studentId) =>
        http.SendAsync(With(new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds"), studentId));

    public static Task<HttpResponseMessage> ConfirmAsync(this HttpClient http, string holdId, string? studentId) =>
        http.SendAsync(With(new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm"), studentId));

    public static Task<HttpResponseMessage> CancelAsync(this HttpClient http, string holdId, string? studentId) =>
        http.SendAsync(With(new HttpRequestMessage(HttpMethod.Delete, $"/holds/{holdId}"), studentId));

    public static Task<HttpResponseMessage> MyHoldsAsync(this HttpClient http, string? studentId) =>
        http.SendAsync(With(new HttpRequestMessage(HttpMethod.Get, "/me/holds"), studentId));

    public static async Task<string> HoldIdAsync(this HttpClient http, string classId, string studentId)
    {
        var res = await http.HoldAsync(classId, studentId);
        Assert.Equal(System.Net.HttpStatusCode.Created, res.StatusCode);
        return (await res.ReadJsonAsync()).GetProperty("holdId").GetString()!;
    }

    public static async Task<JsonElement> GetClassAsync(this HttpClient http, string classId)
    {
        var res = await http.GetAsync($"/classes/{classId}");
        Assert.Equal(System.Net.HttpStatusCode.OK, res.StatusCode);
        return await res.ReadJsonAsync();
    }

    public static async Task<JsonElement> ReadJsonAsync(this HttpResponseMessage res)
    {
        var text = await res.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    public static async Task<string?> ErrorCodeAsync(this HttpResponseMessage res) =>
        (await res.ReadJsonAsync()).GetProperty("error").GetProperty("code").GetString();

    private static HttpRequestMessage With(HttpRequestMessage req, string? studentId)
    {
        if (studentId is not null) req.Headers.TryAddWithoutValidation(Header, studentId);
        return req;
    }
}
