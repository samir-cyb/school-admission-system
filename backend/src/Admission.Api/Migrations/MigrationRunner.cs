using System.Reflection;
using Dapper;
using Npgsql;

namespace Admission.Api.Migrations;

/// <summary>
/// Applies embedded <c>Migrations/*.sql</c> files in name order, once each.
/// A PostgreSQL advisory lock makes it safe when several backend processes start together.
/// </summary>
internal static class MigrationRunner
{
    private const long AdvisoryLockKey = 727_001;

    public static async Task RunAsync(IServiceProvider services, CancellationToken ct = default)
    {
        var dataSource = services.GetRequiredService<NpgsqlDataSource>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Migrations");

        await using var conn = await OpenWithRetryAsync(dataSource, logger, ct);
        await conn.ExecuteAsync("SELECT pg_advisory_lock(@key)", new { key = AdvisoryLockKey });
        try
        {
            await conn.ExecuteAsync("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version    varchar(64) PRIMARY KEY,
                    applied_at timestamptz NOT NULL DEFAULT now()
                )
                """);

            var applied = (await conn.QueryAsync<string>("SELECT version FROM schema_migrations")).ToHashSet();

            foreach (var (version, sql) in LoadScripts())
            {
                if (applied.Contains(version)) continue;

                await using var tx = await conn.BeginTransactionAsync(ct);
                await conn.ExecuteAsync(sql, transaction: tx);
                await conn.ExecuteAsync("INSERT INTO schema_migrations (version) VALUES (@version)", new { version }, tx);
                await tx.CommitAsync(ct);
                logger.LogInformation("Applied migration {Version}", version);
            }
        }
        finally
        {
            await conn.ExecuteAsync("SELECT pg_advisory_unlock(@key)", new { key = AdvisoryLockKey });
        }
    }

    private static IEnumerable<(string Version, string Sql)> LoadScripts()
    {
        var asm = Assembly.GetExecutingAssembly();
        foreach (var name in asm.GetManifestResourceNames()
                     .Where(n => n.EndsWith(".sql", StringComparison.Ordinal))
                     .Order(StringComparer.Ordinal))
        {
            using var stream = asm.GetManifestResourceStream(name)!;
            using var reader = new StreamReader(stream);
            // "migrations/0001_init.sql" → "0001_init"
            yield return (Path.GetFileNameWithoutExtension(name), reader.ReadToEnd());
        }
    }

    /// <summary>The database container can still be starting; wait for it instead of crashing.</summary>
    private static async Task<NpgsqlConnection> OpenWithRetryAsync(NpgsqlDataSource ds, ILogger logger, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await ds.OpenConnectionAsync(ct);
            }
            catch (Exception ex) when (attempt < 30 && ex is NpgsqlException or System.Net.Sockets.SocketException or TimeoutException)
            {
                logger.LogWarning("Database not reachable yet (attempt {Attempt}/30): {Message}", attempt, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }
    }
}
