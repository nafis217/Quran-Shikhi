using System.Text.Json;
using System.Text.RegularExpressions;

namespace QuranShikkha.Infrastructure.Content;

public record MediaItem(string Id, string Platform, string VideoId, string Title, string Channel, string Age, string Topic);

/// <summary>
/// The hand-picked video list (Content/media.json, editable on GitHub). We only EMBED videos through YouTube's own player; we never
/// copy, download or re-host them. Entries are validated so a typo cannot inject anything other than a plain YouTube video id.
/// </summary>
public static class MediaCatalog
{
    private static readonly Regex VideoId = new("^[A-Za-z0-9_-]{11}$", RegexOptions.Compiled);
    private static readonly HashSet<string> Ages = new() { "kids", "adults" };

    public static IReadOnlyList<MediaItem> Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var list = new List<MediaItem>();
        foreach (var e in doc.RootElement.GetProperty("items").EnumerateArray())
        {
            string S(string n) => e.TryGetProperty(n, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString()! : "";
            var item = new MediaItem(S("id"), S("platform"), S("videoId"), S("title"), S("channel"), S("age"), S("topic"));
            if (item.Platform == "youtube" && VideoId.IsMatch(item.VideoId) && Ages.Contains(item.Age) && item.Title.Length is > 0 and <= 300)
                list.Add(item with { Title = item.Title.Trim(), Channel = item.Channel.Trim() });
        }
        return list;
    }

    private static IReadOnlyList<MediaItem>? _cache;
    public static IReadOnlyList<MediaItem> Load()
    {
        if (_cache is not null) return _cache;
        var path = Path.Combine(AppContext.BaseDirectory, "Content", "media.json");
        return _cache = File.Exists(path) ? Parse(File.ReadAllText(path)) : Array.Empty<MediaItem>();
    }
}
