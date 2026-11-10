using Admission.Api.Contracts;
using Admission.Api.Data;
using Admission.Api.Domain;
using Admission.Api.Infrastructure;
using Dapper;
using Npgsql;

namespace Admission.Api.Services;

public sealed class ClassService(NpgsqlDataSource db)
{
    // Seat counts are derived, never stored. Only *unexpired* HELD rows occupy a seat, which is why
    // a seat frees itself at expiresAt even before the background sweeper runs.
    private const string SelectClassesSql = """
        SELECT c.id          AS Id,
               c.name        AS Name,
               c.total_seats AS TotalSeats,
               c.created_at  AS CreatedAt,
               count(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > now()) AS HeldSeats,
               count(h.id) FILTER (WHERE h.status = 'CONFIRMED')                      AS ConfirmedSeats
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id AND h.status IN ('HELD', 'CONFIRMED')
        """;

    public async Task<ClassCreatedResponse> CreateAsync(string name, int totalSeats, CancellationToken ct)
    {
        var id = Ids.NewClassId();
        await using var conn = await db.OpenConnectionAsync(ct);
        var createdAt = await conn.ExecuteScalarAsync<DateTime>(new CommandDefinition(
            "INSERT INTO classes (id, name, total_seats) VALUES (@id, @name, @totalSeats) RETURNING created_at",
            new { id, name, totalSeats }, cancellationToken: ct));

        return new ClassCreatedResponse(id, name, totalSeats, createdAt);
    }

    public async Task<IReadOnlyList<ClassResponse>> ListAsync(CancellationToken ct)
    {
        await using var conn = await db.OpenConnectionAsync(ct);
        var rows = await conn.QueryAsync<ClassRow>(new CommandDefinition(
            SelectClassesSql + " GROUP BY c.id ORDER BY c.created_at, c.id", cancellationToken: ct));
        return rows.Select(ToResponse).ToList();
    }

    public async Task<ClassResponse> GetAsync(string classId, CancellationToken ct)
    {
        if (!Ids.IsClassId(classId)) throw NotFound();

        await using var conn = await db.OpenConnectionAsync(ct);
        var row = await conn.QuerySingleOrDefaultAsync<ClassRow>(new CommandDefinition(
            SelectClassesSql + " WHERE c.id = @classId GROUP BY c.id", new { classId }, cancellationToken: ct));

        return row is null ? throw NotFound() : ToResponse(row);
    }

    internal static ApiException NotFound() =>
        ApiException.NotFound(ErrorCodes.ClassNotFound, "Class not found.");

    private static ClassResponse ToResponse(ClassRow r)
    {
        var held = (int)r.HeldSeats;
        var confirmed = (int)r.ConfirmedSeats;
        var available = Math.Max(0, r.TotalSeats - held - confirmed);
        return new ClassResponse(r.Id, r.Name, r.TotalSeats, held, confirmed, available, r.CreatedAt);
    }
}
