using System.Text.Json;
using Microsoft.Extensions.Options;
using QuranShikkha.Core.Content;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Infrastructure.Content;

/// <summary>QuranEnc Bengali (bengali_zakaria). Text is passed through UNMODIFIED; source and version are always attached.</summary>
public sealed class QuranEncClient(IHttpClientFactory http, ICacheStore cache, IOptions<QuranEncOptions> opts)
{
    public const string ClientName = "quranenc";

    /// <summary>Whole surah of the Bengali translation, text unmodified, with source and version.</summary>
    public async Task<SurahTexts?> GetSurahAsync(int surah, CancellationToken ct)
    {
        var o = opts.Value;
        try
        {
            var json = await CacheHelper.GetOrAddAsync(cache, $"qenc:{o.Key}:{surah}", TimeSpan.FromDays(7),
                async () => await http.CreateClient(ClientName).GetStringAsync($"translation/sura/{o.Key}/{surah}", ct), ct);
            using var d = JsonDocument.Parse(json);
            var list = d.RootElement.GetProperty("result").EnumerateArray()
                .Select(r => new AyahText(int.Parse(r.GetProperty("aya").GetString()!), r.GetProperty("translation").GetString() ?? "")).ToList();
            return new SurahTexts("bn", "QuranEnc.com", string.IsNullOrEmpty(o.Version) ? null : o.Version, "QuranEnc.com", list);
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException or FormatException) { return null; }
    }

    public async Task<TextSource?> GetAsync(int surah, int ayah, CancellationToken ct)
    {
        var o = opts.Value;
        try
        {
            var json = await CacheHelper.GetOrAddAsync(cache, $"qenc:{o.Key}:{surah}", TimeSpan.FromDays(7),
                async () => await http.CreateClient(ClientName).GetStringAsync($"translation/sura/{o.Key}/{surah}", ct), ct);
            using var d = JsonDocument.Parse(json);
            foreach (var r in d.RootElement.GetProperty("result").EnumerateArray())
                if (int.Parse(r.GetProperty("aya").GetString()!) == ayah)
                    return new TextSource(r.GetProperty("translation").GetString() ?? "", "QuranEnc.com", string.IsNullOrEmpty(o.Version) ? null : o.Version, "QuranEnc.com");
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException or FormatException) { }
        return null;
    }
}
