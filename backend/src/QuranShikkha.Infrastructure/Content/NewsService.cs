using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

namespace QuranShikkha.Infrastructure.Content;

public record NewsItem(string Title, string Link, string? Published, string Source);

/// <summary>
/// Arabic news headlines from each outlet's own public RSS feed. Only the headline, link and date are kept (the full story stays on
/// the outlet's site, with a link). Only these allow-listed feeds can be requested, so the endpoint cannot be used to fetch arbitrary URLs.
/// </summary>
public sealed class NewsService(IHttpClientFactory http)
{
    public const string ClientName = "news";
    private const int MaxBytes = 2_000_000;
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(15);

    public static readonly IReadOnlyDictionary<string, (string Name, string Url)> Sources = new Dictionary<string, (string, string)>
    {
        ["bbc"] = ("BBC Arabic", "https://feeds.bbci.co.uk/arabic/rss.xml"),
        ["aljazeera"] = ("Al Jazeera", "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdd219c6e1a"),
        ["france24"] = ("France 24 Arabic", "https://www.france24.com/ar/rss"),
    };

    private static readonly ConcurrentDictionary<string, (DateTime At, IReadOnlyList<NewsItem> Items)> Cache = new();

    public async Task<IReadOnlyList<NewsItem>?> GetAsync(string key, CancellationToken ct)
    {
        if (!Sources.TryGetValue(key, out var src)) return null;
        if (Cache.TryGetValue(key, out var hit) && DateTime.UtcNow - hit.At < Ttl) return hit.Items;
        try
        {
            using var res = await http.CreateClient(ClientName).GetAsync(src.Url, HttpCompletionOption.ResponseHeadersRead, ct);
            res.EnsureSuccessStatusCode();
            await using var s = await res.Content.ReadAsStreamAsync(ct);
            using var ms = new MemoryStream();
            var buf = new byte[16384]; int n;
            while ((n = await s.ReadAsync(buf, ct)) > 0) { ms.Write(buf, 0, n); if (ms.Length > MaxBytes) return Cache.TryGetValue(key, out var old) ? old.Items : null; }
            var items = Parse(System.Text.Encoding.UTF8.GetString(ms.ToArray()), src.Name);
            Cache[key] = (DateTime.UtcNow, items);
            return items;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or XmlException)
        {
            return Cache.TryGetValue(key, out var stale) ? stale.Items : null; // serve the last good copy if the feed is down
        }
    }

    private static readonly Regex Tags = new("<[^>]*>", RegexOptions.Compiled);

    public static IReadOnlyList<NewsItem> Parse(string xml, string source)
    {
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersFromEntities = 0 };
        using var reader = XmlReader.Create(new StringReader(xml), settings);
        var doc = XDocument.Load(reader);
        var items = new List<NewsItem>();
        foreach (var it in doc.Descendants("item"))
        {
            var title = Tags.Replace((string?)it.Element("title") ?? "", "").Trim();
            var link = ((string?)it.Element("link") ?? "").Trim();
            if (title.Length == 0 || !Uri.TryCreate(link, UriKind.Absolute, out var u) || (u.Scheme != Uri.UriSchemeHttps && u.Scheme != Uri.UriSchemeHttp)) continue;
            if (title.Length > 220) title = title[..220];
            var date = DateTimeOffset.TryParse((string?)it.Element("pubDate"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d.UtcDateTime.ToString("o") : null;
            items.Add(new NewsItem(title, u.ToString(), date, source));
            if (items.Count == 25) break;
        }
        return items;
    }
}
