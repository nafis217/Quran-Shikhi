using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace QuranShikkha.Infrastructure.Qf;

public interface IQfTokenProvider
{
    Task<string> GetTokenAsync(CancellationToken ct);
    void Invalidate();
}

/// <summary>OAuth2 client_credentials against {authBase}/oauth2/token. Single in-flight refresh; token kept in memory only.</summary>
public sealed class QfTokenProvider(IHttpClientFactory http, IOptions<QfOptions> opts, TimeProvider clock) : IQfTokenProvider
{
    public const string ClientName = "qf-auth";
    private readonly SemaphoreSlim _gate = new(1, 1);
    private string? _token;
    private DateTimeOffset _expires;

    public void Invalidate() => _token = null;

    public async Task<string> GetTokenAsync(CancellationToken ct)
    {
        if (Valid()) return _token!;
        await _gate.WaitAsync(ct);
        try
        {
            if (Valid()) return _token!;
            var o = opts.Value;
            if (!o.Configured) throw new InvalidOperationException("Quran Foundation credentials are not configured.");

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{o.AuthBase.TrimEnd('/')}/oauth2/token")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["scope"] = o.Scope
                })
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.UTF8.GetBytes($"{o.ClientId}:{o.ClientSecret}")));

            using var res = await http.CreateClient(ClientName).SendAsync(req, ct);
            if (!res.IsSuccessStatusCode)
                throw new HttpRequestException($"QF token request failed: {(int)res.StatusCode}"); // never log body/credentials
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync(ct));
            _token = doc.RootElement.GetProperty("access_token").GetString()!;
            var secs = doc.RootElement.TryGetProperty("expires_in", out var e) ? e.GetInt32() : 3600;
            _expires = clock.GetUtcNow().AddSeconds(Math.Max(30, secs - 60)); // refresh a minute early
            return _token;
        }
        finally { _gate.Release(); }
    }

    private bool Valid() => _token != null && clock.GetUtcNow() < _expires;
}
