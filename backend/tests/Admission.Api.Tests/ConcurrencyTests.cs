using System.Net;
using Admission.Api.Tests.Infrastructure;

namespace Admission.Api.Tests;

/// <summary>
/// PDF §1.7: "at least one concurrency test — send many requests at once and show that
/// no more seats are held than exist." These are those tests.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ConcurrencyTests(TestDatabase db)
{
    [Fact]
    public async Task Many_parallel_applications_never_hold_more_seats_than_exist()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        const int seats = 10;
        const int applicants = 150;
        var classId = await http.CreateClassAsync(seats);

        // Release every request at the same instant.
        var start = new TaskCompletionSource();
        var requests = Enumerable.Range(0, applicants).Select(async _ =>
        {
            var student = TestApi.NewStudentId();
            await start.Task;
            return await http.HoldAsync(classId, student);
        }).ToList();
        start.SetResult();
        var responses = await Task.WhenAll(requests);

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(applicants - seats, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        foreach (var r in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            Assert.Equal("NO_SEATS_AVAILABLE", await r.ErrorCodeAsync());
        }

        var cls = await http.GetClassAsync(classId);
        Assert.Equal(seats, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("availableSeats").GetInt32());

        // The database itself agrees.
        var stored = await db.ScalarAsync(
            "SELECT count(*) FROM holds WHERE class_id = @c AND status IN ('HELD','CONFIRMED')", ("c", classId));
        Assert.Equal(seats, stored);
    }

    [Fact]
    public async Task Same_student_applying_in_parallel_gets_exactly_one_hold()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(50);
        var student = TestApi.NewStudentId();

        var responses = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => http.HoldAsync(classId, student)));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Equal(19, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(1, (await http.GetClassAsync(classId)).GetProperty("heldSeats").GetInt32());
    }

    /// <summary>
    /// Bonus §1.6: two backend processes on different ports sharing one database.
    /// Two independent app hosts = two connection pools, two sweepers, no shared memory.
    /// Only the PostgreSQL row lock can keep them consistent.
    /// </summary>
    [Fact]
    public async Task Two_app_instances_on_one_database_never_oversell()
    {
        await using var app1 = new ApiFactory(db.ConnectionString);
        await using var app2 = new ApiFactory(db.ConnectionString);
        var http1 = app1.CreateClient();
        var http2 = app2.CreateClient();
        const int seats = 10;
        var classId = await http1.CreateClassAsync(seats);

        var start = new TaskCompletionSource();
        var requests = Enumerable.Range(0, 120).Select(async i =>
        {
            var student = TestApi.NewStudentId();
            await start.Task;
            return await (i % 2 == 0 ? http1 : http2).HoldAsync(classId, student);
        }).ToList();
        start.SetResult();
        var responses = await Task.WhenAll(requests);

        Assert.Equal(seats, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(seats, (await http2.GetClassAsync(classId)).GetProperty("heldSeats").GetInt32());
        Assert.Equal(seats, await db.ScalarAsync(
            "SELECT count(*) FROM holds WHERE class_id = @c AND status IN ('HELD','CONFIRMED')", ("c", classId)));
    }

    [Fact]
    public async Task Confirming_the_same_hold_many_times_counts_once()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(5);
        var student = TestApi.NewStudentId();
        var holdId = await http.HoldIdAsync(classId, student);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => http.ConfirmAsync(holdId, student)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        foreach (var r in responses)
        {
            var body = await r.ReadJsonAsync();
            Assert.Equal(holdId, body.GetProperty("holdId").GetString());
            Assert.Equal("CONFIRMED", body.GetProperty("status").GetString());
        }

        var cls = await http.GetClassAsync(classId);
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(4, cls.GetProperty("availableSeats").GetInt32());
    }
}
