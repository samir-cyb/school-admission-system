using System.Net.Sockets;
using System.Text.Json;
using Admission.Api.Domain;
using Admission.Api.Endpoints;
using Admission.Api.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace Admission.Api.Tests;

/// <summary>
/// Pure logic, no database, no HTTP host: the rules every request depends on.
/// </summary>
public sealed class StudentIdTests
{
    [Theory]
    [InlineData("20152691234567890")]
    [InlineData("00000000000000000")]
    public void Accepts_exactly_17_ascii_digits(string raw)
    {
        Assert.True(StudentId.TryParse(raw, out var id));
        Assert.Equal(raw, id.Value);
    }

    [Theory]
    [InlineData("")]
    [InlineData("2015269123456789")]       // 16
    [InlineData("201526912345678901")]     // 18
    [InlineData("2015269123456789a")]      // letter
    [InlineData("২০১৫২৬৯১২৩৪৫৬৭৮৯০")]      // Bangla digits are converted by the UI, not the API
    [InlineData(" 2015269123456789")]      // whitespace
    [InlineData("2015-26912345678")]       // separator
    public void Rejects_anything_else(string raw) => Assert.False(StudentId.TryParse(raw, out _));

    [Fact]
    public void Rejects_null() => Assert.False(StudentId.TryParse(null, out _));

    [Fact]
    public void Masks_the_number_for_logs()
    {
        StudentId.TryParse("20152691234567890", out var id);
        Assert.Equal("2015*********7890", id.Masked);
        Assert.Equal(id.Masked, id.ToString()); // logging an id can never leak it in full
    }

    [Fact]
    public void Missing_header_is_a_400_with_a_clear_code()
    {
        var ctx = new DefaultHttpContext();
        var ex = Assert.Throws<ApiException>(() => StudentId.FromRequest(ctx.Request));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal(ErrorCodes.InvalidStudentId, ex.Code);
    }

    [Fact]
    public void Repeated_header_values_are_rejected()
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Headers.Append(StudentId.HeaderName, "20152691234567890");
        ctx.Request.Headers.Append(StudentId.HeaderName, "20152691234567891");
        Assert.Throws<ApiException>(() => StudentId.FromRequest(ctx.Request));
    }
}

public sealed class IdTests
{
    [Fact]
    public void New_ids_have_the_documented_shape()
    {
        Assert.Matches("^c_[a-z2-7]{20}$", Ids.NewClassId());
        Assert.Matches("^h_[a-z2-7]{20}$", Ids.NewHoldId());
    }

    [Fact]
    public void Ids_are_unique_and_unguessable()
    {
        var ids = Enumerable.Range(0, 10_000).Select(_ => Ids.NewHoldId()).ToHashSet();
        Assert.Equal(10_000, ids.Count);
    }

    [Theory]
    [InlineData("c_123")]
    [InlineData("C_AAAAAAAAAAAAAAAAAAAA")]
    [InlineData("h_aaaaaaaaaaaaaaaaaaaa")] // a hold id is not a class id
    [InlineData("c_aaaaaaaaaaaaaaaaaaa1")] // '1' is not in the base32 alphabet
    [InlineData("' OR 1=1 --")]
    [InlineData("")]
    public void Malformed_class_ids_are_rejected_before_any_sql(string value) => Assert.False(Ids.IsClassId(value));
}

public sealed class OptionsTests
{
    private static AdmissionOptions Bind(params (string Key, string Value)[] values)
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value))
            .Build();
        var o = new AdmissionOptions();
        AdmissionOptions.Bind(o, cfg);
        return o;
    }

    [Fact]
    public void Defaults_match_the_brief()
    {
        var o = Bind();
        Assert.Equal(600, o.HoldDurationSeconds);
        Assert.Contains("http://localhost:5173", o.CorsOrigins);
    }

    [Fact]
    public void Reads_hold_duration_and_cors_from_environment()
    {
        var o = Bind(("HOLD_DURATION_SECONDS", "45"), ("CORS_ORIGINS", "http://a.test/, http://b.test"));
        Assert.Equal(45, o.HoldDurationSeconds);
        Assert.Equal(new[] { "http://a.test", "http://b.test" }, o.CorsOrigins);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("0")]
    [InlineData("-5")]
    [InlineData("86401")]
    public void Invalid_hold_duration_fails_fast(string value) =>
        Assert.Throws<OptionsValidationException>(() => Bind(("HOLD_DURATION_SECONDS", value)));
}

public sealed class CreateClassValidationTests
{
    private static JsonElement Json(string text) => JsonDocument.Parse(text).RootElement.Clone();

    [Fact]
    public void Trims_the_name_and_accepts_whole_seats()
    {
        var (name, seats) = ClassEndpoints.ValidateCreate(Json("""{ "name": "  Class 6 - Morning Shift  ", "totalSeats": 120 }"""));
        Assert.Equal("Class 6 - Morning Shift", name);
        Assert.Equal(120, seats);
    }

    [Fact]
    public void Property_names_are_case_insensitive()
    {
        var (_, seats) = ClassEndpoints.ValidateCreate(Json("""{ "Name": "X", "TotalSeats": 3 }"""));
        Assert.Equal(3, seats);
    }

    [Theory]
    [InlineData("""{ "name": "X", "totalSeats": 10001 }""")]
    [InlineData("""{ "name": "X", "totalSeats": 2.5 }""")]
    [InlineData("""{ "name": "X", "totalSeats": true }""")]
    [InlineData("""{ "name": "Bad\u0007Name", "totalSeats": 5 }""")]
    [InlineData("""{ "name": [], "totalSeats": 5 }""")]
    public void Rejects_bad_values_with_a_validation_error(string body)
    {
        var ex = Assert.Throws<ApiException>(() => ClassEndpoints.ValidateCreate(Json(body)));
        Assert.Equal(400, ex.StatusCode);
        Assert.Equal(ErrorCodes.ValidationFailed, ex.Code);
    }

    [Fact]
    public void Reports_every_problem_at_once()
    {
        var ex = Assert.Throws<ApiException>(() => ClassEndpoints.ValidateCreate(Json("{}")));
        Assert.Contains("name", ex.Message);
        Assert.Contains("totalSeats", ex.Message);
    }
}

public sealed class ErrorMappingTests
{
    [Fact]
    public void Expected_failures_keep_their_status_and_code()
    {
        var (status, code, _, holdId) = ApiExceptionHandler.Map(ApiException.Conflict(ErrorCodes.ActiveHoldExists, "x", "h_abc"));
        Assert.Equal(409, status);
        Assert.Equal(ErrorCodes.ActiveHoldExists, code);
        Assert.Equal("h_abc", holdId);
    }

    [Fact]
    public void Malformed_json_is_400_not_500()
    {
        var (status, code, _, _) = ApiExceptionHandler.Map(new JsonException("bad"));
        Assert.Equal(400, status);
        Assert.Equal(ErrorCodes.InvalidJson, code);
    }

    [Fact]
    public void Oversized_body_is_413()
    {
        var (status, _, _, _) = ApiExceptionHandler.Map(new BadHttpRequestException("too big", 413));
        Assert.Equal(413, status);
    }

    [Fact]
    public void Database_down_is_503()
    {
        var (status, code, _, _) = ApiExceptionHandler.Map(new InvalidOperationException("wrap", new SocketException()));
        Assert.Equal(503, status);
        Assert.Equal(ErrorCodes.ServiceUnavailable, code);
    }

    [Fact]
    public void Unknown_failures_never_leak_internal_details()
    {
        var (status, _, message, _) = ApiExceptionHandler.Map(new InvalidOperationException("SELECT * FROM secret_table"));
        Assert.Equal(500, status);
        Assert.DoesNotContain("secret_table", message);
    }
}
