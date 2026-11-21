using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace QuranShikkha.Infrastructure.Content;

/// <summary>Loads the whole Quran in the background after startup so the first visitor does not wait for 114 surahs.</summary>
public sealed class WarmupService(IServiceScopeFactory scopes, ILogger<WarmupService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(3), ct);
            using var s = scopes.CreateScope();
            var all = await s.ServiceProvider.GetRequiredService<IContentService>().GetAllAyahsAsync(ct);
            log.LogInformation("Quran loaded: {Ayahs} ayahs", all.Count);
        }
        catch (Exception e) when (e is not OperationCanceledException) { log.LogWarning("Warm-up skipped: {Type}", e.GetType().Name); }
    }
}
