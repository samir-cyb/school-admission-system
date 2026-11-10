using Admission.Api.Infrastructure;

namespace Admission.Api.Domain;

/// <summary>
/// The student's identity: the 17-digit birth registration number sent in <c>X-Student-Id</c>.
/// There is no login (PDF §1.3), so this header is the whole "auth" model.
/// </summary>
public readonly record struct StudentId
{
    public const string HeaderName = "X-Student-Id";
    public const int Length = 17;

    public string Value { get; }

    private StudentId(string value) => Value = value;

    public static bool TryParse(string? raw, out StudentId id)
    {
        id = default;
        if (raw is null || raw.Length != Length) return false;

        foreach (var c in raw)
        {
            if (c is < '0' or > '9') return false; // ASCII digits only; no spaces, no Bangla digits on the wire
        }

        id = new StudentId(raw);
        return true;
    }

    /// <summary>Reads and validates the header, or throws 400 INVALID_STUDENT_ID.</summary>
    public static StudentId FromRequest(HttpRequest request)
    {
        var values = request.Headers[HeaderName];

        if (values.Count == 0 || string.IsNullOrEmpty(values[0]))
        {
            throw ApiException.BadRequest(ErrorCodes.InvalidStudentId,
                $"The {HeaderName} header is required (17-digit birth registration number).");
        }

        if (values.Count > 1 || !TryParse(values[0], out var id))
        {
            throw ApiException.BadRequest(ErrorCodes.InvalidStudentId,
                $"{HeaderName} must be exactly {Length} digits (0-9).");
        }

        return id;
    }

    /// <summary>Log-safe form: <c>2015*********7890</c>.</summary>
    public string Masked => string.Concat(Value.AsSpan(0, 4), new string('*', Length - 8), Value.AsSpan(Length - 4));

    public override string ToString() => Masked;
}
