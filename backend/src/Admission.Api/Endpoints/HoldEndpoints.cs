using Admission.Api.Domain;
using Admission.Api.Services;

namespace Admission.Api.Endpoints;

public static class HoldEndpoints
{
    public static IEndpointRouteBuilder MapHoldEndpoints(this IEndpointRouteBuilder app)
    {
        // #4 POST /classes/{classId}/holds — header X-Student-Id
        app.MapPost("/classes/{classId}/holds", async (string classId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var student = StudentId.FromRequest(request);
            var created = await holds.CreateAsync(classId, student, ct);
            return Results.Created($"/holds/{created.HoldId}", created);
        });

        // #5 GET /holds/{holdId} — no header in the PDF contract
        app.MapGet("/holds/{holdId}", async (string holdId, HoldService holds, CancellationToken ct) =>
            Results.Ok(await holds.GetAsync(holdId, ct)));

        // #6 POST /holds/{holdId}/confirm — header X-Student-Id
        app.MapPost("/holds/{holdId}/confirm", async (string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var student = StudentId.FromRequest(request);
            return Results.Ok(await holds.ConfirmAsync(holdId, student, ct));
        });

        // #7 DELETE /holds/{holdId} — header X-Student-Id, 204 on success
        app.MapDelete("/holds/{holdId}", async (string holdId, HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var student = StudentId.FromRequest(request);
            await holds.CancelAsync(holdId, student, ct);
            return Results.NoContent();
        });

        // #8 GET /me/holds — header X-Student-Id
        app.MapGet("/me/holds", async (HttpRequest request, HoldService holds, CancellationToken ct) =>
        {
            var student = StudentId.FromRequest(request);
            return Results.Ok(await holds.ListForStudentAsync(student, ct));
        });

        return app;
    }
}
