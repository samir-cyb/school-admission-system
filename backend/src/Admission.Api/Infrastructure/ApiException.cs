namespace Admission.Api.Infrastructure;

/// <summary>Machine-readable error codes. The frontend maps these to bn/en messages.</summary>
public static class ErrorCodes
{
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string InvalidJson = "INVALID_JSON";
    public const string InvalidStudentId = "INVALID_STUDENT_ID";
    public const string ClassNotFound = "CLASS_NOT_FOUND";
    public const string HoldNotFound = "HOLD_NOT_FOUND";
    public const string NoSeatsAvailable = "NO_SEATS_AVAILABLE";
    public const string ActiveHoldExists = "ACTIVE_HOLD_EXISTS";
    public const string HoldExpired = "HOLD_EXPIRED";
    public const string HoldNotActive = "HOLD_NOT_ACTIVE";
    public const string Forbidden = "FORBIDDEN";
    public const string PayloadTooLarge = "PAYLOAD_TOO_LARGE";
    public const string RateLimited = "RATE_LIMITED";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string NotFound = "NOT_FOUND";
    public const string InternalError = "INTERNAL_ERROR";
}

/// <summary>
/// An expected, client-facing failure. Thrown by services and turned into
/// <c>{ "error": { "code", "message" } }</c> by <see cref="ApiExceptionHandler"/>.
/// </summary>
public sealed class ApiException(int statusCode, string code, string message, string? holdId = null)
    : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;

    /// <summary>Optional pointer to a related hold (e.g. the existing active one on 409).</summary>
    public string? HoldId { get; } = holdId;

    public static ApiException BadRequest(string code, string message) => new(StatusCodes.Status400BadRequest, code, message);
    public static ApiException NotFound(string code, string message) => new(StatusCodes.Status404NotFound, code, message);
    public static ApiException Conflict(string code, string message, string? holdId = null) => new(StatusCodes.Status409Conflict, code, message, holdId);
    public static ApiException Forbidden(string message) => new(StatusCodes.Status403Forbidden, ErrorCodes.Forbidden, message);
}

public sealed record ErrorBody(ErrorDetail Error);

public sealed record ErrorDetail(string Code, string Message)
{
    /// <summary>Only present when the error points at an existing hold.</summary>
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? HoldId { get; init; }
}
