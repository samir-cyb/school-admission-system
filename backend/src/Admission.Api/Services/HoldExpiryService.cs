using Admission.Api.Infrastructure;
using Microsoft.Extensions.Options;

namespace Admission.Api.Services;

/// <summary>
/// PDF §1.5 rule 2: when a hold's time is up the seat goes back by itself, with no API call.
///
/// Seat availability is already correct the instant a hold expires, because every read only counts
/// HELD rows with <c>expires_at &gt; now()</c>. This service additionally writes the EXPIRED status to
/// the database every few seconds so the stored data matches what the API reports.
/// </summary>
public sealed class HoldExpiryService(IServiceScopeFactory scopes, IOptions<AdmissionOptions> options, ILogger<HoldExpiryService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(options.Value.ExpirySweepSeconds);
        using var timer = new PeriodicTimer(interval);

        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var holds = scope.ServiceProvider.GetRequiredService<HoldService>();
                var expired = await holds.ExpireDueHoldsAsync(stoppingToken);
                if (expired > 0)
                {
                    logger.LogInformation("Expired {Count} hold(s)", expired);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Database briefly unavailable, etc. Keep the service alive and try again next tick.
                logger.LogWarning(ex, "Hold expiry sweep failed; will retry");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }
}
