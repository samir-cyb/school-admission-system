namespace Admission.Api.Infrastructure;

/// <summary>Hardening headers for a JSON-only API (see "Security" in README.md).</summary>
public static class SecurityHeaders
{
    public static void Apply(IHeaderDictionary h)
    {
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        h["Cross-Origin-Resource-Policy"] = "same-site";
        h["Cache-Control"] = "no-store";
        h.Remove("Server");
        h.Remove("X-Powered-By");
    }

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use((ctx, next) =>
        {
            ctx.Response.OnStarting(() =>
            {
                Apply(ctx.Response.Headers);
                return Task.CompletedTask;
            });
            return next(ctx);
        });
}
