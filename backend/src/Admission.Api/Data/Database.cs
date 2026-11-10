using Npgsql;

namespace Admission.Api.Data;

internal static class Database
{
    /// <summary>
    /// Registers one pooled <see cref="NpgsqlDataSource"/>. The connection string comes from
    /// <c>ConnectionStrings__Default</c> (PDF §1.2: changeable through an environment variable).
    /// </summary>
    public static IServiceCollection AddDatabase(this IServiceCollection services) =>
        services.AddSingleton(sp =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            var cs = cfg.GetConnectionString("Default");
            if (string.IsNullOrWhiteSpace(cs))
            {
                throw new InvalidOperationException("Connection string 'ConnectionStrings__Default' is not configured.");
            }

            var builder = new NpgsqlConnectionStringBuilder(cs)
            {
                // Two backend processes (bonus §1.6) must fit under PostgreSQL's max_connections.
                // Extra requests wait for a pooled connection instead of failing.
                MaxPoolSize = 40,
                Timeout = 15,
                CommandTimeout = 30,
            };

            return new NpgsqlDataSourceBuilder(builder.ConnectionString)
                .UseLoggerFactory(sp.GetRequiredService<ILoggerFactory>())
                .Build();
        });
}
