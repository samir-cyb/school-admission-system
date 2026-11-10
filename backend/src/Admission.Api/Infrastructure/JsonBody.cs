using System.Text.Json;

namespace Admission.Api.Infrastructure;

/// <summary>
/// Strict, hand-rolled body parsing. Model binding would happily turn <c>"12"</c> or <c>12.0</c>
/// into an int, or throw an exception that ends up as a 500. Parsing ourselves gives exact types
/// and a clear 400 message for every bad input.
/// </summary>
public static class JsonBody
{
    public static async Task<JsonElement> ReadObjectAsync(HttpRequest request, CancellationToken ct)
    {
        JsonDocument doc;
        try
        {
            doc = await JsonDocument.ParseAsync(request.Body, new JsonDocumentOptions { MaxDepth = 8 }, ct);
        }
        catch (JsonException)
        {
            throw ApiException.BadRequest(ErrorCodes.InvalidJson, "Request body must be a valid JSON object.");
        }

        using (doc)
        {
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                throw ApiException.BadRequest(ErrorCodes.InvalidJson, "Request body must be a JSON object.");
            }

            return doc.RootElement.Clone();
        }
    }

    /// <summary>Finds a property by name, case-insensitively (matches ASP.NET's default binding behaviour).</summary>
    public static bool TryGet(JsonElement obj, string name, out JsonElement value)
    {
        foreach (var p in obj.EnumerateObject())
        {
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = p.Value;
                return true;
            }
        }

        value = default;
        return false;
    }
}
