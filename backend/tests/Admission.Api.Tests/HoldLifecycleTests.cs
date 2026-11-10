using System.Net;
using Admission.Api.Tests.Infrastructure;

namespace Admission.Api.Tests;

[Collection(ApiCollection.Name)]
public sealed class HoldLifecycleTests(TestDatabase db)
{
    [Fact]
    public async Task Hold_expires_by_itself_and_the_seat_comes_back()
    {
        await using var app = new ApiFactory(db.ConnectionString, holdDurationSeconds: 2);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(1);
        var student = TestApi.NewStudentId();
        var holdId = await http.HoldIdAsync(classId, student);

        // Seat is taken while the hold is alive.
        Assert.Equal(HttpStatusCode.Conflict, (await http.HoldAsync(classId, TestApi.NewStudentId())).StatusCode);

        await Task.Delay(TimeSpan.FromSeconds(3.5)); // no API call in between

        var hold = await (await http.GetAsync($"/holds/{holdId}")).ReadJsonAsync();
        Assert.Equal("EXPIRED", hold.GetProperty("status").GetString());

        var cls = await http.GetClassAsync(classId);
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());

        var confirm = await http.ConfirmAsync(holdId, student);
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("HOLD_EXPIRED", await confirm.ErrorCodeAsync());

        // The background sweeper has also written EXPIRED into the table.
        Assert.Equal("EXPIRED", await db.StringAsync("SELECT status FROM holds WHERE id = @h", ("h", holdId)));

        // Someone else can now take the seat.
        Assert.Equal(HttpStatusCode.Created, (await http.HoldAsync(classId, TestApi.NewStudentId())).StatusCode);
    }

    [Fact]
    public async Task Cancel_frees_the_seat_and_the_student_can_apply_again()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(1);
        var a = TestApi.NewStudentId();
        var b = TestApi.NewStudentId();

        var holdA = await http.HoldIdAsync(classId, a);
        Assert.Equal(HttpStatusCode.Conflict, (await http.HoldAsync(classId, b)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await http.CancelAsync(holdA, a)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await http.CancelAsync(holdA, a)).StatusCode); // idempotent

        var status = await (await http.GetAsync($"/holds/{holdA}")).ReadJsonAsync();
        Assert.Equal("CANCELLED", status.GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.Created, (await http.HoldAsync(classId, b)).StatusCode);

        var cancelledConfirm = await http.ConfirmAsync(holdA, a);
        Assert.Equal(HttpStatusCode.Conflict, cancelledConfirm.StatusCode);
        Assert.Equal("HOLD_NOT_ACTIVE", await cancelledConfirm.ErrorCodeAsync());
    }

    [Fact]
    public async Task One_active_application_per_student_per_class()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(10);
        var otherClass = await http.CreateClassAsync(10, "Class 6 - Day Shift");
        var student = TestApi.NewStudentId();

        var first = await http.HoldIdAsync(classId, student);
        var second = await http.HoldAsync(classId, student);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("ACTIVE_HOLD_EXISTS", await second.ErrorCodeAsync());

        // Still blocked after confirming (a confirmed admission is also "active").
        Assert.Equal(HttpStatusCode.OK, (await http.ConfirmAsync(first, student)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.HoldAsync(classId, student)).StatusCode);

        // A different class (another shift) is allowed.
        Assert.Equal(HttpStatusCode.Created, (await http.HoldAsync(otherClass, student)).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_can_confirm_or_cancel()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var classId = await http.CreateClassAsync(3);
        var owner = TestApi.NewStudentId();
        var stranger = TestApi.NewStudentId();
        var holdId = await http.HoldIdAsync(classId, owner);

        Assert.Equal(HttpStatusCode.Forbidden, (await http.ConfirmAsync(holdId, stranger)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await http.CancelAsync(holdId, stranger)).StatusCode);

        // Still HELD and confirmable by the owner.
        Assert.Equal(HttpStatusCode.OK, (await http.ConfirmAsync(holdId, owner)).StatusCode);

        // A confirmed admission cannot be cancelled.
        var cancel = await http.CancelAsync(holdId, owner);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
    }

    [Fact]
    public async Task My_holds_lists_only_my_applications_newest_first_with_class_name()
    {
        await using var app = new ApiFactory(db.ConnectionString);
        var http = app.CreateClient();
        var morning = await http.CreateClassAsync(5, "Class 7 - Morning Shift");
        var day = await http.CreateClassAsync(5, "Class 7 - Day Shift");
        var me = TestApi.NewStudentId();
        var someoneElse = TestApi.NewStudentId();

        var older = await http.HoldIdAsync(morning, me);
        await Task.Delay(50);
        var newer = await http.HoldIdAsync(day, me);
        await http.HoldIdAsync(morning, someoneElse);

        var list = await (await http.MyHoldsAsync(me)).ReadJsonAsync();
        var items = list.EnumerateArray().ToList();

        Assert.Equal(2, items.Count);
        Assert.Equal(newer, items[0].GetProperty("holdId").GetString());
        Assert.Equal(older, items[1].GetProperty("holdId").GetString());
        Assert.Equal("Class 7 - Day Shift", items[0].GetProperty("className").GetString());
        Assert.Equal(day, items[0].GetProperty("classId").GetString());
    }
}
