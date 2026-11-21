using QuranShikkha.Core.Content;

namespace QuranShikkha.Infrastructure.Qf;

public static class CacheHelper
{
    public static async Task<string> GetOrAddAsync(ICacheStore cache, string key, TimeSpan ttl, Func<Task<string>> fetch, CancellationToken ct)
    {
        var hit = await cache.GetAsync(key, ct);
        if (hit != null) return hit;
        var fresh = await fetch();
        await cache.SetAsync(key, fresh, ttl, ct);
        return fresh;
    }
}
