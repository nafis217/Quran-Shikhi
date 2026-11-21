using Microsoft.Extensions.Options;
using QuranShikkha.Core.Content;

namespace QuranShikkha.Infrastructure.Qf;

public interface IQfClient
{
    /// <summary>GET a path under ApiBase. Cached (≤7 days) per environment. Returns raw JSON.</summary>
    Task<string> GetJsonAsync(string pathAndQuery, CancellationToken ct);
}

public sealed class QfClient(IHttpClientFactory http, IQfTokenProvider tokens, ICacheStore cache, IOptions<QfOptions> opts) : IQfClient
{
    public const string ClientName = "qf-api";

    public Task<string> GetJsonAsync(string pathAndQuery, CancellationToken ct)
    {
        var o = opts.Value;
        var key = $"qf:{o.Environment}:{pathAndQuery}"; // environment in key: prelive and production never mix
        return CacheHelper.GetOrAddAsync(cache, key, TimeSpan.FromDays(o.CacheDays), () => FetchAsync(pathAndQuery, ct), ct);
    }

    private async Task<string> FetchAsync(string pathAndQuery, CancellationToken ct)
    {
        var o = opts.Value;
        for (var attempt = 0; ; attempt++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"{o.ApiBase.TrimEnd('/')}{pathAndQuery}");
            req.Headers.Add("x-auth-token", await tokens.GetTokenAsync(ct));
            req.Headers.Add("x-client-id", o.ClientId);
            using var res = await http.CreateClient(ClientName).SendAsync(req, ct);
            if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized && attempt == 0) { tokens.Invalidate(); continue; }
            if (!res.IsSuccessStatusCode) throw new HttpRequestException($"QF {pathAndQuery} failed: {(int)res.StatusCode}");
            return await res.Content.ReadAsStringAsync(ct);
        }
    }
}
