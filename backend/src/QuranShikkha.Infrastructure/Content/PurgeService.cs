using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QuranShikkha.Core.Content;

namespace QuranShikkha.Infrastructure.Content;

/// <summary>Enforces the 1-week cache limit by deleting expired QF cache rows and stale Word rows.</summary>
public sealed class PurgeService(IServiceScopeFactory scopes, ILogger<PurgeService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var s = scopes.CreateScope();
                var n = await s.ServiceProvider.GetRequiredService<ICacheStore>().PurgeExpiredAsync(ct);
                if (n > 0) log.LogInformation("Purged {Count} expired cache rows", n);
            }
            catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning(e, "Cache purge failed"); }
            await Task.Delay(TimeSpan.FromHours(6), ct);
        }
    }
}
