namespace Admission.Api.Data;

// Plain rows that Dapper fills. Column aliases in SQL match these property names
// (case-insensitive), so no snake_case mapping magic is needed.

internal sealed class ClassRow
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int TotalSeats { get; set; }
    public long HeldSeats { get; set; }
    public long ConfirmedSeats { get; set; }
    public DateTime CreatedAt { get; set; }
}

internal sealed class HoldRow
{
    public string HoldId { get; set; } = "";
    public string ClassId { get; set; } = "";
    public string ClassName { get; set; } = "";
    public string StudentId { get; set; } = "";
    /// <summary>Effective status: a HELD row past its expiry is reported as EXPIRED.</summary>
    public string Status { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}
