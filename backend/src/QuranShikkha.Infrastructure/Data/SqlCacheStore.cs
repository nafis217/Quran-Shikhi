using Microsoft.EntityFrameworkCore;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Entities;

namespace QuranShikkha.Infrastructure.Data;

public sealed class SqlCacheStore(AppDbContext db, TimeProvider clock) : ICacheStore
{
    public async Task<string?> GetAsync(string key, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var e = await db.QfCache.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key, ct);
        return e != null && e.ExpiresAt > now ? e.PayloadJson : null;
    }

    public async Task SetAsync(string key, string payloadJson, TimeSpan ttl, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var e = await db.QfCache.FirstOrDefaultAsync(x => x.Key == key, ct);
        if (e == null) db.QfCache.Add(e = new QfCacheEntry { Key = key });
        e.PayloadJson = payloadJson;
        e.FetchedAt = now;
        e.ExpiresAt = now + CachePolicy.Clamp(ttl);
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> PurgeExpiredAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var n = await db.QfCache.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(ct);
        var cutoff = now - CachePolicy.MaxAge;
        n += await db.Words.Where(w => w.FetchedAt <= cutoff).ExecuteDeleteAsync(ct);
        return n;
    }
}
