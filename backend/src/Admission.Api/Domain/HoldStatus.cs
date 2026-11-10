namespace Admission.Api.Domain;

/// <summary>Hold states exactly as spelled in the PDF contract.</summary>
public static class HoldStatus
{
    public const string Held = "HELD";
    public const string Confirmed = "CONFIRMED";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";
}
