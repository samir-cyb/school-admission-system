using System.Net.Sockets;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Npgsql;

namespace Admission.Api.Infrastructure;

/// <summary>
/// The single place that turns exceptions into JSON errors.
/// Rule from the PDF: bad input must never become a 500, and nothing internal
/// (stack traces, SQL, exception text) may leak into a response.
/// </summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ctx.RequestAborted.IsCancellationRequested)
        {
            return true; // client went away; nothing to write
        }

        var (status, code, message, holdId) = Map(ex);

        // Expected 4xx outcomes (409 no seat, 400 bad input, …) are not logged: under a load test they
        // would flood the log. ExceptionHandlerMiddleware's own logging is switched off in appsettings.
        if (status >= 500)
        {
            logger.LogError(ex, "Request {Method} {Path} failed with {Status}", ctx.Request.Method, ctx.Request.Path, status);
        }

        if (ctx.Response.HasStarted)
        {
            return true;
        }

        ctx.Response.Clear();
        ctx.Response.StatusCode = status;
        SecurityHeaders.Apply(ctx.Response.Headers);
        await ctx.Response.WriteAsJsonAsync(new ErrorBody(new ErrorDetail(code, message) { HoldId = holdId }), ct);
        return true;
    }

    internal static (int Status, string Code, string Message, string? HoldId) Map(Exception ex) => ex switch
    {
        ApiException api => (api.StatusCode, api.Code, api.Message, api.HoldId),

        BadHttpRequestException { StatusCode: StatusCodes.Status413PayloadTooLarge } =>
            (413, ErrorCodes.PayloadTooLarge, "Request body is too large (max 16 KB).", null),
        BadHttpRequestException bad =>
            (bad.StatusCode is >= 400 and < 500 ? bad.StatusCode : 400, ErrorCodes.ValidationFailed, "The request is malformed.", null),
        JsonException =>
            (400, ErrorCodes.InvalidJson, "Request body is not valid JSON.", null),

        _ when IsDatabaseUnavailable(ex) =>
            (503, ErrorCodes.ServiceUnavailable, "The database is unavailable. Please try again shortly.", null),

        _ => (500, ErrorCodes.InternalError, "An unexpected error occurred.", null),
    };

    private static bool IsDatabaseUnavailable(Exception ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
        {
            switch (e)
            {
                case SocketException:
                case TimeoutException:
                case PostgresException pg when pg.SqlState.StartsWith("08", StringComparison.Ordinal) // connection exception
                                            || pg.SqlState.StartsWith("57P", StringComparison.Ordinal) // admin shutdown / cannot connect now
                                            || pg.SqlState == "53300": // too many connections
                case NpgsqlException { IsTransient: true }:
                    return true;
            }
        }

        return false;
    }
}
