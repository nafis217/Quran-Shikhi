using System.Net;

namespace QuranShikkha.Infrastructure.Qf;

/// <summary>Retries 429 and 5xx with exponential backoff + jitter; honors Retry-After. Rate limits are unpublished, so we are conservative.</summary>
public sealed class RetryHandler : DelegatingHandler
{
    private readonly int _maxRetries;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;

    public RetryHandler(int maxRetries = 4, Func<TimeSpan, CancellationToken, Task>? delay = null)
    {
        _maxRetries = maxRetries;
        _delay = delay ?? Task.Delay;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            HttpResponseMessage? res = null;
            try
            {
                res = await base.SendAsync(request, ct);
                if (!Retryable(res.StatusCode) || attempt >= _maxRetries) return res;
            }
            catch (HttpRequestException) when (attempt < _maxRetries) { }

            var wait = res?.Headers.RetryAfter?.Delta
                       ?? TimeSpan.FromMilliseconds(Math.Pow(2, attempt) * 400 + Random.Shared.Next(0, 250));
            res?.Dispose();
            await _delay(wait > TimeSpan.FromSeconds(30) ? TimeSpan.FromSeconds(30) : wait, ct);
        }
    }

    private static bool Retryable(HttpStatusCode c) => c == HttpStatusCode.TooManyRequests || (int)c >= 500;
}
