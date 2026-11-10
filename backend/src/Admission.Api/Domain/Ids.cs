using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Admission.Api.Domain;

/// <summary>
/// Public ids look like the PDF examples (<c>c_…</c>, <c>h_…</c>) but carry 100 random bits,
/// so nobody can guess or enumerate another student's hold id.
/// </summary>
public static partial class Ids
{
    private const string Alphabet = "abcdefghijklmnopqrstuvwxyz234567"; // RFC 4648 base32, lowercase
    private const int RandomChars = 20;

    public static string NewClassId() => "c_" + RandomPart();

    public static string NewHoldId() => "h_" + RandomPart();

    public static bool IsClassId(string? value) => value is not null && ClassIdPattern().IsMatch(value);

    public static bool IsHoldId(string? value) => value is not null && HoldIdPattern().IsMatch(value);

    private static string RandomPart() =>
        string.Create(RandomChars, 0, static (span, _) =>
        {
            for (var i = 0; i < span.Length; i++)
            {
                span[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            }
        });

    [GeneratedRegex("^c_[a-z2-7]{20}$", RegexOptions.CultureInvariant)]
    private static partial Regex ClassIdPattern();

    [GeneratedRegex("^h_[a-z2-7]{20}$", RegexOptions.CultureInvariant)]
    private static partial Regex HoldIdPattern();
}
