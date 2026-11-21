using System.Net;
using Microsoft.Extensions.Options;
using QuranShikkha.Core.Content;
using QuranShikkha.Infrastructure.Data;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Tests;

public class QfTokenProviderTests
{
    private static QfOptions Opts() => new() { AuthBase = "https://auth.test", ApiBase = "https://api.test", ClientId = "id", ClientSecret = "secret" };

    [Fact]
    public async Task Token_is_cached_then_refreshed_after_expiry_and_uses_basic_auth()
    {
        var clock = new FakeClock(DateTimeOffset.UtcNow);
        var calls = 0;
        var h = new StubHandler(_ => Json.Ok($"{{\"access_token\":\"t{++calls}\",\"expires_in\":3600}}"));
        var p = new QfTokenProvider(new StubFactory(_ => new HttpClient(h)), Options.Create(Opts()), clock);

        Assert.Equal("t1", await p.GetTokenAsync(default));
        Assert.Equal("t1", await p.GetTokenAsync(default));
        Assert.Single(h.Requests);
        Assert.Equal("https://auth.test/oauth2/token", h.Requests[0].RequestUri!.ToString());
        Assert.Equal("Basic", h.Requests[0].Headers.Authorization!.Scheme);

        clock.Advance(TimeSpan.FromMinutes(61));
        Assert.Equal("t2", await p.GetTokenAsync(default));
    }

    [Fact]
    public async Task Concurrent_callers_share_a_single_refresh()
    {
        var h = new StubHandler(_ => Json.Ok("{\"access_token\":\"x\",\"expires_in\":3600}"));
        var p = new QfTokenProvider(new StubFactory(_ => new HttpClient(h)), Options.Create(Opts()), TimeProvider.System);
        await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => p.GetTokenAsync(default)));
        Assert.Single(h.Requests);
    }

    [Fact]
    public async Task Failure_does_not_leak_credentials_in_message()
    {
        var h = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.BadRequest));
        var p = new QfTokenProvider(new StubFactory(_ => new HttpClient(h)), Options.Create(Opts()), TimeProvider.System);
        var ex = await Assert.ThrowsAsync<HttpRequestException>(() => p.GetTokenAsync(default));
        Assert.DoesNotContain("secret", ex.Message);
    }

    [Fact]
    public async Task Missing_credentials_fail_clearly() =>
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new QfTokenProvider(new StubFactory(_ => new HttpClient()), Options.Create(new QfOptions()), TimeProvider.System).GetTokenAsync(default));
}

public class RetryHandlerTests
{
    [Fact]
    public async Task Retries_429_then_succeeds_with_backoff_waits()
    {
        var waits = new List<TimeSpan>(); var n = 0;
        var inner = new StubHandler(_ => ++n < 3 ? new HttpResponseMessage(HttpStatusCode.TooManyRequests) : Json.Ok("{}"));
        var rh = new RetryHandler(4, (t, _) => { waits.Add(t); return Task.CompletedTask; }) { InnerHandler = inner };
        var res = await new HttpClient(rh).GetAsync("http://x/");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(2, waits.Count);
        Assert.True(waits[1] > waits[0]);
    }

    [Fact]
    public async Task Does_not_retry_4xx_other_than_429()
    {
        var inner = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var rh = new RetryHandler(4, (_, _) => Task.CompletedTask) { InnerHandler = inner };
        await new HttpClient(rh).GetAsync("http://x/");
        Assert.Single(inner.Requests);
    }

    [Fact]
    public async Task Gives_up_after_max_retries()
    {
        var inner = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var rh = new RetryHandler(2, (_, _) => Task.CompletedTask) { InnerHandler = inner };
        var res = await new HttpClient(rh).GetAsync("http://x/");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, res.StatusCode);
        Assert.Equal(3, inner.Requests.Count);
    }
}

public class QfClientAndCacheTests
{
    [Fact]
    public async Task Sends_auth_headers_and_serves_second_call_from_cache()
    {
        var (db, conn) = Db.Create(); using var _ = conn;
        var api = new StubHandler(_ => Json.Ok("{\"ok\":1}"));
        var tokens = new FakeTokens();
        var o = Options.Create(new QfOptions { ApiBase = "https://api.test", ClientId = "cid", AuthBase = "a", ClientSecret = "s", Environment = "prelive" });
        var c = new QfClient(new StubFactory(_ => new HttpClient(api)), tokens, new SqlCacheStore(db, TimeProvider.System), o);

        await c.GetJsonAsync("/content/api/v4/chapters", default);
        await c.GetJsonAsync("/content/api/v4/chapters", default);

        Assert.Single(api.Requests);
        Assert.Equal("tok", api.Requests[0].Headers.GetValues("x-auth-token").Single());
        Assert.Equal("cid", api.Requests[0].Headers.GetValues("x-client-id").Single());
    }

    [Fact]
    public async Task Prelive_and_production_caches_do_not_mix()
    {
        var (db, conn) = Db.Create(); using var _ = conn;
        var api = new StubHandler(_ => Json.Ok("{}"));
        QfClient Make(string env) => new(new StubFactory(_ => new HttpClient(api)), new FakeTokens(),
            new SqlCacheStore(db, TimeProvider.System), Options.Create(new QfOptions { ApiBase = "https://api.test", ClientId = "c", Environment = env }));
        await Make("prelive").GetJsonAsync("/x", default);
        await Make("production").GetJsonAsync("/x", default);
        Assert.Equal(2, api.Requests.Count);
    }

    [Fact]
    public async Task On_401_it_refreshes_token_once_and_retries()
    {
        var (db, conn) = Db.Create(); using var _ = conn;
        var n = 0;
        var api = new StubHandler(_ => ++n == 1 ? new HttpResponseMessage(HttpStatusCode.Unauthorized) : Json.Ok("{}"));
        var tokens = new FakeTokens();
        var c = new QfClient(new StubFactory(_ => new HttpClient(api)), tokens, new SqlCacheStore(db, TimeProvider.System),
            Options.Create(new QfOptions { ApiBase = "https://api.test", ClientId = "c" }));
        await c.GetJsonAsync("/y", default);
        Assert.Equal(1, tokens.Invalidated);
        Assert.Equal(2, api.Requests.Count);
    }

    [Fact]
    public async Task Cache_never_keeps_entries_longer_than_seven_days_and_expires()
    {
        var (db, conn) = Db.Create(); using var _ = conn;
        var clock = new FakeClock(DateTimeOffset.UtcNow);
        var store = new SqlCacheStore(db, clock);
        await store.SetAsync("k", "v", TimeSpan.FromDays(90), default);
        var e = db.QfCache.Single();
        Assert.True(e.ExpiresAt - e.FetchedAt <= TimeSpan.FromDays(7));
        Assert.Equal("v", await store.GetAsync("k", default));
        clock.Advance(TimeSpan.FromDays(8));
        Assert.Null(await store.GetAsync("k", default));
        Assert.Equal(1, await store.PurgeExpiredAsync(default));
    }

    private sealed class FakeTokens : IQfTokenProvider
    {
        public int Invalidated;
        public Task<string> GetTokenAsync(CancellationToken ct) => Task.FromResult("tok");
        public void Invalidate() => Invalidated++;
    }
}
