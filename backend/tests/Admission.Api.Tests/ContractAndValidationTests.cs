using System.Net;
using System.Text;
using System.Text.Json;
using Admission.Api.Tests.Infrastructure;

namespace Admission.Api.Tests;

/// <summary>
/// The evaluator runs automated tests straight against the API, so field names must match the PDF
/// exactly, and bad input must be a clear 4xx — never a 500.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ContractAndValidationTests(TestDatabase db)
{
    private static void HasFields(JsonElement obj, params string[] names)
    {
        foreach (var n in names)
        {
            Assert.True(obj.TryGetProperty(n, out _), $"missing field '{n}' in {obj}");
        }
    }

    [Fact]
    public async Task All_eight_endpoints_return_the_documented_shapes()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var student = Api.NewStudentId();

        // 1 POST /classes
        var createRes = await http.PostAsync("/classes",
            new StringContent("""{ "name": "Class 6 - Morning Shift", "totalSeats": 120 }""", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.ReadJsonAsync();
        HasFields(created, "id", "name", "totalSeats");
        Assert.Equal("Class 6 - Morning Shift", created.GetProperty("name").GetString());
        Assert.Equal(120, created.GetProperty("totalSeats").GetInt32());
        var classId = created.GetProperty("id").GetString()!;
        Assert.StartsWith("c_", classId);

        // 2 GET /classes
        var list = await (await http.GetAsync("/classes")).ReadJsonAsync();
        Assert.Equal(JsonValueKind.Array, list.ValueKind);
        var item = list.EnumerateArray().Single(c => c.GetProperty("id").GetString() == classId);
        HasFields(item, "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
        Assert.Equal(120, item.GetProperty("availableSeats").GetInt32());

        // 4 POST /classes/{id}/holds
        var holdRes = await http.HoldAsync(classId, student);
        Assert.Equal(HttpStatusCode.Created, holdRes.StatusCode);
        var hold = await holdRes.ReadJsonAsync();
        HasFields(hold, "holdId", "classId", "studentId", "status", "expiresAt");
        Assert.Equal(classId, hold.GetProperty("classId").GetString());
        Assert.Equal(student, hold.GetProperty("studentId").GetString());
        Assert.Equal("HELD", hold.GetProperty("status").GetString());
        var expiresAt = hold.GetProperty("expiresAt").GetString()!;
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", expiresAt); // like "2026-11-01T04:10:00Z"
        var holdId = hold.GetProperty("holdId").GetString()!;
        Assert.StartsWith("h_", holdId);

        // 3 GET /classes/{id}
        var one = await http.GetClassAsync(classId);
        HasFields(one, "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats");
        Assert.Equal(1, one.GetProperty("heldSeats").GetInt32());
        Assert.Equal(119, one.GetProperty("availableSeats").GetInt32());

        // 5 GET /holds/{id} (no header in the contract)
        var got = await (await http.GetAsync($"/holds/{holdId}")).ReadJsonAsync();
        HasFields(got, "holdId", "classId", "status", "expiresAt");
        Assert.Equal(expiresAt, got.GetProperty("expiresAt").GetString());
        Assert.False(got.TryGetProperty("studentId", out _), "GET /holds must not leak the student id");

        // 8 GET /me/holds
        var mine = await (await http.MyHoldsAsync(student)).ReadJsonAsync();
        var mineItem = Assert.Single(mine.EnumerateArray());
        HasFields(mineItem, "holdId", "classId", "className", "status", "expiresAt");

        // 6 POST /holds/{id}/confirm
        var confirmRes = await http.ConfirmAsync(holdId, student);
        Assert.Equal(HttpStatusCode.OK, confirmRes.StatusCode);
        var confirmed = await confirmRes.ReadJsonAsync();
        HasFields(confirmed, "holdId", "status");
        Assert.Equal("CONFIRMED", confirmed.GetProperty("status").GetString());

        // 7 DELETE /holds/{id} → 204 (on a fresh hold)
        var other = Api.NewStudentId();
        var holdToCancel = await http.HoldIdAsync(classId, other);
        var del = await http.CancelAsync(holdToCancel, other);
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        Assert.Equal(0, (await del.Content.ReadAsByteArrayAsync()).Length);
    }

    [Theory]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": 0 }")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": -5 }")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": 1.5 }")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": \"120\" }")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": 99999999999 }")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": null }")]
    [InlineData("{ \"name\": \"Class 6\" }")]
    [InlineData("{ \"name\": \"   \", \"totalSeats\": 10 }")]
    [InlineData("{ \"name\": 42, \"totalSeats\": 10 }")]
    [InlineData("{ \"totalSeats\": 10 }")]
    [InlineData("[ 1, 2, 3 ]")]
    [InlineData("\"just a string\"")]
    [InlineData("{ \"name\": \"Class 6\", \"totalSeats\": 10")]
    [InlineData("not json at all")]
    [InlineData("")]
    public async Task Create_class_rejects_bad_input_with_400(string body)
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var res = await app.CreateClient().PostAsync("/classes", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var error = (await res.ReadJsonAsync()).GetProperty("error");
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("message").GetString()));
    }

    [Fact]
    public async Task Create_class_rejects_a_name_longer_than_100_characters()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var res = await app.CreateClient().PostAsync("/classes", new StringContent(
            JsonSerializer.Serialize(new { name = new string('x', 101), totalSeats = 10 }), Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Theory]
    [InlineData(null)]                    // missing
    [InlineData("")]                      // empty
    [InlineData("1234567890123456")]      // 16 digits
    [InlineData("123456789012345678")]    // 18 digits
    [InlineData("2015269123456789X")]     // letter
    [InlineData("2015-269-1234-5678")]    // separators are not digits
    public async Task Hold_requires_a_valid_17_digit_student_id(string? studentId)
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(5);

        var res = await http.HoldAsync(classId, studentId);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("INVALID_STUDENT_ID", await res.ErrorCodeAsync());
    }

    [Fact]
    public async Task Header_is_required_on_confirm_cancel_and_my_holds()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(5);
        var holdId = await http.HoldIdAsync(classId, Api.NewStudentId());

        Assert.Equal(HttpStatusCode.BadRequest, (await http.ConfirmAsync(holdId, null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.CancelAsync(holdId, null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.MyHoldsAsync(null)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.MyHoldsAsync("abc")).StatusCode);
    }

    [Fact]
    public async Task Unknown_or_malformed_ids_are_404_not_500()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var student = Api.NewStudentId();

        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/classes/c_aaaaaaaaaaaaaaaaaaaa")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/classes/not-an-id")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/classes/' OR 1=1 --")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.HoldAsync("c_aaaaaaaaaaaaaaaaaaaa", student)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/holds/h_aaaaaaaaaaaaaaaaaaaa")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/holds/123")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.ConfirmAsync("h_aaaaaaaaaaaaaaaaaaaa", student)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.CancelAsync("h_aaaaaaaaaaaaaaaaaaaa", student)).StatusCode);

        var empty = await (await http.MyHoldsAsync(student)).ReadJsonAsync();
        Assert.Empty(empty.EnumerateArray());
    }

    [Fact]
    public async Task Responses_carry_security_headers_and_no_server_banner()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var res = await app.CreateClient().GetAsync("/classes");

        Assert.Equal("nosniff", res.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", res.Headers.GetValues("X-Frame-Options").Single());
        Assert.False(res.Headers.Contains("Server"));
    }
}
