using Microsoft.AspNetCore.Mvc;
using QuranShikkha.Infrastructure.Content;

namespace QuranShikkha.Api.Controllers;

public record NewsSource(string Key, string Name);

[ApiController, Route("api/v1")]
public class WatchController(NewsService news) : ControllerBase
{
    /// <summary>Hand-picked videos to embed. Filter by age group: "kids" or "adults".</summary>
    [HttpGet("media")]
    public IReadOnlyList<MediaItem> Media([FromQuery] string? age = null) =>
        MediaCatalog.Load().Where(m => age is null || m.Age == age).ToList();

    [HttpGet("news/sources")]
    public IReadOnlyList<NewsSource> NewsSources() => NewsService.Sources.Select(s => new NewsSource(s.Key, s.Value.Name)).ToList();

    /// <summary>Latest Arabic headlines from one allow-listed outlet (bbc, aljazeera, france24). Cached for 15 minutes.</summary>
    [HttpGet("news")]
    public async Task<ActionResult<IReadOnlyList<NewsItem>>> News([FromQuery] string source = "bbc", CancellationToken ct = default)
    {
        if (!NewsService.Sources.ContainsKey(source)) return Problem("Unknown news source.", statusCode: 400);
        var items = await news.GetAsync(source, ct);
        return items is null ? Problem("News is not available right now.", statusCode: 502) : Ok(items);
    }
}
