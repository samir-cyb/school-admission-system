using System.Text.Json.Serialization;

namespace Admission.Api.Contracts;

// Response shapes. Property names serialise to camelCase and match the PDF contract exactly
// (see the API table in README.md). Extra fields are allowed by the PDF; none of the required ones may be removed.

/// <summary>#1 POST /classes → 201</summary>
public sealed record ClassCreatedResponse(string Id, string Name, int TotalSeats, DateTime CreatedAt);

/// <summary>#2 GET /classes item, #3 GET /classes/{id}</summary>
public sealed record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats,
    DateTime CreatedAt);

/// <summary>#4 POST /classes/{id}/holds → 201</summary>
public sealed record HoldCreatedResponse(string HoldId, string ClassId, string StudentId, string Status, DateTime ExpiresAt);

/// <summary>#5 GET /holds/{id} → 200. Deliberately no studentId: the endpoint is public per the PDF.</summary>
public sealed record HoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTime? ConfirmedAt);

/// <summary>#6 POST /holds/{id}/confirm → 200</summary>
public sealed record HoldConfirmedResponse(string HoldId, string Status);

/// <summary>#8 GET /me/holds item</summary>
public sealed record MyHoldResponse(
    string HoldId,
    string ClassId,
    string ClassName,
    string Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DateTime? ConfirmedAt);
