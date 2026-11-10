using System.Text.Json;
using Admission.Api.Infrastructure;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class ClassEndpoints
{
    public const int MaxNameLength = 100;
    public const int MaxSeats = 10_000;

    public static IEndpointRouteBuilder MapClassEndpoints(this IEndpointRouteBuilder app)
    {
        // #1 POST /classes
        app.MapPost("/classes", async (HttpRequest request, ClassService classes, CancellationToken ct) =>
        {
            var body = await JsonBody.ReadObjectAsync(request, ct);
            var (name, totalSeats) = ValidateCreate(body);
            var created = await classes.CreateAsync(name, totalSeats, ct);
            return Results.Created($"/classes/{created.Id}", created);
        });

        // #2 GET /classes
        app.MapGet("/classes", async (ClassService classes, CancellationToken ct) =>
            Results.Ok(await classes.ListAsync(ct)));

        // #3 GET /classes/{classId}
        app.MapGet("/classes/{classId}", async (string classId, ClassService classes, CancellationToken ct) =>
            Results.Ok(await classes.GetAsync(classId, ct)));

        return app;
    }

    internal static (string Name, int TotalSeats) ValidateCreate(JsonElement body)
    {
        var errors = new List<string>();
        string name = "";
        var totalSeats = 0;

        if (!JsonBody.TryGet(body, "name", out var nameEl) || nameEl.ValueKind != JsonValueKind.String)
        {
            errors.Add("'name' is required and must be a string.");
        }
        else
        {
            name = nameEl.GetString()!.Trim();
            if (name.Length == 0) errors.Add("'name' must not be empty.");
            else if (name.Length > MaxNameLength) errors.Add($"'name' must be at most {MaxNameLength} characters.");
            else if (name.Any(char.IsControl)) errors.Add("'name' must not contain control characters.");
        }

        if (!JsonBody.TryGet(body, "totalSeats", out var seatsEl) || seatsEl.ValueKind != JsonValueKind.Number)
        {
            errors.Add("'totalSeats' is required and must be a whole number.");
        }
        else if (!seatsEl.TryGetInt32(out totalSeats))
        {
            errors.Add("'totalSeats' must be a whole number.");
        }
        else if (totalSeats is < 1 or > MaxSeats)
        {
            errors.Add($"'totalSeats' must be between 1 and {MaxSeats}.");
        }

        if (errors.Count > 0)
        {
            throw ApiException.BadRequest(ErrorCodes.ValidationFailed, string.Join(" ", errors));
        }

        return (name, totalSeats);
    }
}
