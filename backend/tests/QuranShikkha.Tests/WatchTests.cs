using System.Net;
using System.Net.Http.Json;
using QuranShikkha.Infrastructure.Content;

namespace QuranShikkha.Tests;

public class MediaCatalogTests
{
    [Fact]
    public void Keeps_valid_youtube_items_and_drops_anything_else()
    {
        const string json = """
        { "items": [
          { "id":"a","platform":"youtube","videoId":"AbCdEfGhIjK","title":"Good","channel":"C","age":"kids","topic":"t" },
          { "id":"b","platform":"youtube","videoId":"too-short","title":"Bad id","channel":"C","age":"kids","topic":"t" },
          { "id":"c","platform":"youtube","videoId":"AbCdEfGhIjK\"><script>","title":"Injected","channel":"C","age":"kids","topic":"t" },
          { "id":"d","platform":"facebook","videoId":"AbCdEfGhIjK","title":"Other site","channel":"C","age":"kids","topic":"t" },
          { "id":"e","platform":"youtube","videoId":"AbCdEfGhIjK","title":"Bad age","channel":"C","age":"toddlers","topic":"t" },
          { "id":"f","platform":"youtube","videoId":"zzzzzzzzzzz","title":"","channel":"C","age":"adults","topic":"t" }
        ] }
        """;
        var items = MediaCatalog.Parse(json);
        Assert.Single(items); Assert.Equal("a", items[0].Id);
    }

    [Fact]
    public void The_shipped_list_loads_and_covers_both_age_groups()
    {
        var all = MediaCatalog.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Content", "media.json")));
        Assert.True(all.Count >= 10);
        Assert.Contains(all, m => m.Age == "kids"); Assert.Contains(all, m => m.Age == "adults");
        Assert.Equal(all.Count, all.Select(m => m.VideoId).Distinct().Count());
    }
}

public class NewsParseTests
{
    [Fact]
    public void Parses_headlines_handles_cdata_and_html_and_skips_bad_links()
    {
        const string xml = """
        <?xml version="1.0"?><rss><channel>
          <item><title><![CDATA[عنوان <b>مهم</b> اليوم]]></title><link>https://example.org/a</link><pubDate>Sat, 21 Nov 2026 10:00:00 GMT</pubDate></item>
          <item><title>no link</title><link></link></item>
          <item><title>js link</title><link>javascript:alert(1)</link></item>
          <item><title></title><link>https://example.org/empty</link></item>
        </channel></rss>
        """;
        var items = NewsService.Parse(xml, "Test");
        var one = Assert.Single(items);
        Assert.Equal("عنوان مهم اليوم", one.Title); Assert.Equal("https://example.org/a", one.Link); Assert.Equal("Test", one.Source);
        Assert.StartsWith("2026-11-21", one.Published);
    }

    [Fact]
    public void Rejects_xml_with_a_dtd_instead_of_resolving_it()
    {
        const string evil = "<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY e SYSTEM \"file:///etc/passwd\">]><rss><channel><item><title>&e;</title><link>https://a.b/c</link></item></channel></rss>";
        Assert.ThrowsAny<System.Xml.XmlException>(() => NewsService.Parse(evil, "T"));
    }

    [Fact]
    public void Caps_title_length_and_item_count()
    {
        var items = string.Concat(Enumerable.Range(0, 40).Select(i => $"<item><title>{new string('x', 400)}</title><link>https://e.org/{i}</link></item>"));
        var r = NewsService.Parse($"<rss><channel>{items}</channel></rss>", "T");
        Assert.Equal(25, r.Count); Assert.All(r, x => Assert.Equal(220, x.Title.Length));
    }
}

public class WatchApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public WatchApiTests(ApiFactory f) { _f = f; f.InitDb().GetAwaiter().GetResult(); }

    [Fact]
    public async Task Media_endpoint_filters_by_age_and_news_rejects_unknown_sources()
    {
        var c = _f.CreateClient();
        var kids = await c.GetFromJsonAsync<List<MediaItem>>("/api/v1/media?age=kids");
        Assert.NotEmpty(kids!); Assert.All(kids!, m => Assert.Equal("kids", m.Age));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/news?source=http://evil.example/x")).StatusCode);
        var src = await c.GetFromJsonAsync<List<QuranShikkha.Api.Controllers.NewsSource>>("/api/v1/news/sources");
        Assert.Equal(new[] { "bbc", "aljazeera", "france24" }, src!.Select(s => s.Key));
    }

    [Fact]
    public async Task Flashcards_accept_daily_word_keys_but_not_garbage()
    {
        var c = _f.CreateClient();
        var g = await (await c.PostAsync("/api/v1/auth/guest", null)).Content.ReadFromJsonAsync<QuranShikkha.Api.Auth.AuthResponse>();
        c.DefaultRequestHeaders.Authorization = new("Bearer", g!.Token);
        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsJsonAsync("/api/v1/flashcards", new { wordKey = "v:animals.cat" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/flashcards", new { wordKey = "v:../../etc" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/flashcards", new { wordKey = "v:" + new string('a', 80) })).StatusCode);
    }
}
