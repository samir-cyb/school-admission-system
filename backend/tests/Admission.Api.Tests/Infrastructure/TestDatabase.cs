using Npgsql;

namespace Admission.Api.Tests.Infrastructure;

/// <summary>
/// Creates a throw-away PostgreSQL database for one test run and drops it afterwards.
/// Row locks are a real-database feature, so the tests never use an in-memory provider.
///
/// Server: <c>TEST_DB_CONNECTION</c> (any database on the server; we create our own next to it).
/// Inside docker compose it points at the <c>db</c> service.
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private const string DefaultServer =
        "Host=localhost;Port=5432;Username=admission;Password=admission_local_pw;Database=postgres";

    private readonly string _serverConnection =
        Environment.GetEnvironmentVariable("TEST_DB_CONNECTION") is { Length: > 0 } cs ? cs : DefaultServer;

    public string DatabaseName { get; } = $"admission_test_{Guid.NewGuid():N}";

    public string ConnectionString => new NpgsqlConnectionStringBuilder(_serverConnection)
    {
        Database = DatabaseName,
        Pooling = true,
    }.ConnectionString;

    public async Task InitializeAsync()
    {
        await using var conn = new NpgsqlConnection(_serverConnection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{DatabaseName}\"", conn);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(_serverConnection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{DatabaseName}\" WITH (FORCE)", conn);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<long> ScalarAsync(string sql, params (string Name, object Value)[] args)
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in args) cmd.Parameters.AddWithValue(name, value);
        return Convert.ToInt64(await cmd.ExecuteScalarAsync());
    }

    public async Task<string?> StringAsync(string sql, params (string Name, object Value)[] args)
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var (name, value) in args) cmd.Parameters.AddWithValue(name, value);
        return (string?)await cmd.ExecuteScalarAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<TestDatabase>
{
    public const string Name = "api";
}
