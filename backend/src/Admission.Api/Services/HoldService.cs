using System.Data;
using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Dapper;
using Microsoft.Extensions.Options;
using Npgsql;

namespace Admission.Api.Services;

public sealed class HoldService(NpgsqlDataSource db, IOptions<AdmissionOptions> options, ILogger<HoldService> logger)
{
    /// <summary>Effective status: a HELD row whose time is up is reported as EXPIRED, sweeper or not.</summary>
    private const string SelectHoldSql = """
        SELECT h.id           AS HoldId,
               h.class_id     AS ClassId,
               c.name         AS ClassName,
               h.student_id   AS StudentId,
               CASE WHEN h.status = 'HELD' AND h.expires_at <= now() THEN 'EXPIRED' ELSE h.status END AS Status,
               h.expires_at   AS ExpiresAt,
               h.created_at   AS CreatedAt,
               h.confirmed_at AS ConfirmedAt
        FROM holds h
        JOIN classes c ON c.id = h.class_id
        """;

    /// <summary>
    /// PDF §1.5 rule 1: held + confirmed must never exceed totalSeats, however many requests arrive at once.
    ///
    /// The whole check-and-insert runs in one transaction that first takes a row lock on the class
    /// (<c>SELECT … FOR UPDATE</c>). Every other request for the same class blocks on that lock until we
    /// commit, then re-counts and sees our new hold. The lock lives in PostgreSQL, so it also serialises
    /// requests coming from a second backend process (bonus §1.6). Different classes never wait for each other.
    /// </summary>
    public async Task<HoldCreatedResponse> CreateAsync(string classId, StudentId student, CancellationToken ct)
    {
        if (!Ids.IsClassId(classId)) throw ClassService.NotFound();

        var duration = options.Value.HoldDurationSeconds;

        await using var conn = await db.OpenConnectionAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 1. Per-class mutex inside the database.
        var totalSeats = await conn.ExecuteScalarAsync<int?>(new CommandDefinition(
            "SELECT total_seats FROM classes WHERE id = @classId FOR UPDATE",
            new { classId }, tx, cancellationToken: ct));

        if (totalSeats is null) throw ClassService.NotFound();

        // 2. Persist expiry for this class's stale holds (keeps the partial unique index accurate).
        await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE holds SET status = 'EXPIRED', expired_at = statement_timestamp()
            WHERE class_id = @classId AND status = 'HELD' AND expires_at <= statement_timestamp()
            """, new { classId }, tx, cancellationToken: ct));

        // 3. PDF rule 3: one active (HELD or CONFIRMED) application per student per class.
        var existingHoldId = await conn.ExecuteScalarAsync<string?>(new CommandDefinition("""
            SELECT id FROM holds
            WHERE class_id = @classId AND student_id = @studentId AND status IN ('HELD', 'CONFIRMED')
            LIMIT 1
            """, new { classId, studentId = student.Value }, tx, cancellationToken: ct));

        if (existingHoldId is not null)
        {
            throw ApiException.Conflict(ErrorCodes.ActiveHoldExists,
                "This student already has an active application in this class.", existingHoldId);
        }

        // 4. Count occupied seats while holding the lock.
        var occupied = await conn.ExecuteScalarAsync<long>(new CommandDefinition("""
            SELECT count(*) FROM holds
            WHERE class_id = @classId AND status IN ('HELD', 'CONFIRMED')
            """, new { classId }, tx, cancellationToken: ct));

        if (occupied >= totalSeats.Value)
        {
            throw ApiException.Conflict(ErrorCodes.NoSeatsAvailable, "No seats are available in this class.");
        }

        // 5. Take the seat. Expiry is computed from the database clock, so every process agrees on it.
        var holdId = Ids.NewHoldId();
        HoldRow created;
        try
        {
            created = await conn.QuerySingleAsync<HoldRow>(new CommandDefinition("""
                INSERT INTO holds (id, class_id, student_id, status, created_at, expires_at)
                VALUES (@holdId, @classId, @studentId, 'HELD', statement_timestamp(),
                        date_trunc('second', statement_timestamp()) + make_interval(secs => @duration))
                RETURNING id AS HoldId, class_id AS ClassId, student_id AS StudentId, status AS Status, expires_at AS ExpiresAt
                """, new { holdId, classId, studentId = student.Value, duration }, tx, cancellationToken: ct));
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            // Backstop: the partial unique index caught a duplicate active application.
            throw ApiException.Conflict(ErrorCodes.ActiveHoldExists,
                "This student already has an active application in this class.");
        }

        await tx.CommitAsync(ct);

        logger.LogInformation("Hold {HoldId} created for student {Student} in class {ClassId}", holdId, student, classId);
        return new HoldCreatedResponse(created.HoldId, created.ClassId, created.StudentId, created.Status, created.ExpiresAt);
    }

    public async Task<HoldResponse> GetAsync(string holdId, CancellationToken ct)
    {
        var row = await FindAsync(holdId, ct) ?? throw NotFound();
        return new HoldResponse(row.HoldId, row.ClassId, row.ClassName, row.Status, row.ExpiresAt, row.CreatedAt, row.ConfirmedAt);
    }

    /// <summary>
    /// PDF rules 4 and 5: only the owner's own, unexpired HELD hold can be confirmed, and confirming the
    /// same hold again is a no-op that still returns 200 (confirmedSeats increases only once).
    /// One conditional UPDATE is atomic, so parallel confirms cannot double count.
    /// </summary>
    public async Task<HoldConfirmedResponse> ConfirmAsync(string holdId, StudentId student, CancellationToken ct)
    {
        if (!Ids.IsHoldId(holdId)) throw NotFound();

        await using var conn = await db.OpenConnectionAsync(ct);
        var updated = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE holds SET status = 'CONFIRMED', confirmed_at = now()
            WHERE id = @holdId AND student_id = @studentId AND status = 'HELD' AND expires_at > now()
            """, new { holdId, studentId = student.Value }, cancellationToken: ct));

        if (updated == 1)
        {
            logger.LogInformation("Hold {HoldId} confirmed by student {Student}", holdId, student);
            return new HoldConfirmedResponse(holdId, HoldStatus.Confirmed);
        }

        var row = await FindAsync(holdId, ct) ?? throw NotFound();
        if (row.StudentId != student.Value) throw NotOwner();

        return row.Status switch
        {
            HoldStatus.Confirmed => new HoldConfirmedResponse(holdId, HoldStatus.Confirmed), // idempotent
            HoldStatus.Expired => throw ApiException.Conflict(ErrorCodes.HoldExpired,
                "This application has expired and its seat was released."),
            _ => throw ApiException.Conflict(ErrorCodes.HoldNotActive,
                "This application was cancelled and cannot be confirmed."),
        };
    }

    /// <summary>Cancels the owner's HELD hold, freeing the seat. Cancelling twice is harmless (204).</summary>
    public async Task CancelAsync(string holdId, StudentId student, CancellationToken ct)
    {
        if (!Ids.IsHoldId(holdId)) throw NotFound();

        await using var conn = await db.OpenConnectionAsync(ct);
        var updated = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE holds SET status = 'CANCELLED', cancelled_at = now()
            WHERE id = @holdId AND student_id = @studentId AND status = 'HELD' AND expires_at > now()
            """, new { holdId, studentId = student.Value }, cancellationToken: ct));

        if (updated == 1)
        {
            logger.LogInformation("Hold {HoldId} cancelled by student {Student}", holdId, student);
            return;
        }

        var row = await FindAsync(holdId, ct) ?? throw NotFound();
        if (row.StudentId != student.Value) throw NotOwner();

        switch (row.Status)
        {
            case HoldStatus.Cancelled:
                return; // already cancelled: DELETE is idempotent
            case HoldStatus.Confirmed:
                throw ApiException.Conflict(ErrorCodes.HoldNotActive,
                    "A confirmed admission cannot be cancelled here.");
            default:
                throw ApiException.Conflict(ErrorCodes.HoldExpired,
                    "This application has already expired.");
        }
    }

    public async Task<IReadOnlyList<MyHoldResponse>> ListForStudentAsync(StudentId student, CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        var rows = await conn.QueryAsync<HoldRow>(new CommandDefinition(
            SelectHoldSql + " WHERE h.student_id = @studentId ORDER BY h.created_at DESC, h.id",
            new { studentId = student.Value }, cancellationToken: ct));

        return rows
            .Select(r => new MyHoldResponse(r.HoldId, r.ClassId, r.ClassName, r.Status, r.ExpiresAt, r.CreatedAt, r.ConfirmedAt))
            .ToList();
    }

    /// <summary>
    /// Persists EXPIRED for holds whose time is up. Called by <see cref="HoldExpiryService"/>.
    /// SKIP LOCKED lets several backend processes sweep at once without blocking each other.
    /// </summary>
    public async Task<int> ExpireDueHoldsAsync(CancellationToken ct)
    {
        const int batchSize = 500;
        var total = 0;

        await using var conn = await db.OpenConnectionAsync(ct);
        while (!ct.IsCancellationRequested)
        {
            var n = await conn.ExecuteAsync(new CommandDefinition("""
                WITH due AS (
                    SELECT id FROM holds
                    WHERE status = 'HELD' AND expires_at <= now()
                    ORDER BY expires_at
                    LIMIT @batchSize
                    FOR UPDATE SKIP LOCKED
                )
                UPDATE holds h SET status = 'EXPIRED', expired_at = now()
                FROM due WHERE h.id = due.id
                """, new { batchSize }, cancellationToken: ct));

            total += n;
            if (n < batchSize) break;
        }

        return total;
    }

    private async Task<HoldRow?> FindAsync(string holdId, CancellationToken ct)
    {
        if (!Ids.IsHoldId(holdId)) return null;

        await using var conn = await db.OpenConnectionAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<HoldRow>(new CommandDefinition(
            SelectHoldSql + " WHERE h.id = @holdId", new { holdId }, cancellationToken: ct));
    }

    private static ApiException NotFound() => ApiException.NotFound(ErrorCodes.HoldNotFound, "Application (hold) not found.");

    private static ApiException NotOwner() => ApiException.Forbidden("This application belongs to another student.");
}
