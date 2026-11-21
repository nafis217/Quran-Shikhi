using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Text;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Infrastructure.Content;

/// <summary>
/// Quran Foundation Content API v4 shapes. Field names follow the public Quran.com v4 documentation
/// but have NOT been verified against a live prelive response (no credentials yet), so parsing is tolerant.
/// </summary>
public sealed class QfContentSource(IQfClient qf, IOptions<QfOptions> opts, ILogger<QfContentSource> log) : IContentSource
{
    private const string V = "/content/api/v4";

    public async Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await qf.GetJsonAsync($"{V}/chapters?language=bn", ct));
        return doc.RootElement.GetProperty("chapters").EnumerateArray().Select(c => new ChapterDto(
            c.GetProperty("id").GetInt32(),
            Str(c, "name_simple") ?? "",
            Str(c, "name_arabic") ?? "",
            c.TryGetProperty("translated_name", out var t) ? Str(t, "name") : null,
            c.TryGetProperty("verses_count", out var vc) ? vc.GetInt32() : 0)).ToList();
    }

    public async Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct)
    {
        var bn = await FetchVerses(surah, "bn", ct);
        // English word meanings: a second (cached) call, merged by word key. Failure degrades to Bangla-only.
        Dictionary<string, string?> en = new();
        try { foreach (var a in await FetchVerses(surah, "en", ct)) foreach (var w in a.Words) en[w.Key] = w.MeaningBn; }
        catch (Exception e) when (e is HttpRequestException or JsonException) { log.LogWarning("QF English word meanings unavailable for surah {Surah}", surah); }
        return bn.Select(a => a with { Words = a.Words.Select(w => w with { MeaningEn = en.GetValueOrDefault(w.Key) }).ToList() }).ToList();
    }

    private async Task<List<AyahDto>> FetchVerses(int surah, string lang, CancellationToken ct)
    {
        var all = new List<AyahDto>();
        for (var page = 1; ; page++)
        {
            var q = $"{V}/verses/by_chapter/{surah}?words=true&word_fields=text_uthmani,audio_url,location&word_translation_language={lang}&per_page=50&page={page}";
            using var doc = JsonDocument.Parse(await qf.GetJsonAsync(q, ct));
            foreach (var v in doc.RootElement.GetProperty("verses").EnumerateArray())
            {
                var key = Str(v, "verse_key")!;
                var parts = key.Split(':');
                var words = v.GetProperty("words").EnumerateArray().Select(w =>
                {
                    var pos = w.GetProperty("position").GetInt32();
                    return new WordDto($"{key}:{pos}", pos, Str(w, "text_uthmani") ?? Str(w, "text") ?? "",
                        Str(w, "audio_url"),
                        w.TryGetProperty("translation", out var t) ? Str(t, "text") : null, null,
                        w.TryGetProperty("transliteration", out var tr) ? Str(tr, "text") : null,
                        Str(w, "char_type_name") ?? "word");
                }).ToList();
                all.Add(new AyahDto(key, int.Parse(parts[0]), int.Parse(parts[1]), words));
            }
            var next = doc.RootElement.TryGetProperty("pagination", out var p) && p.TryGetProperty("next_page", out var np) && np.ValueKind == JsonValueKind.Number;
            if (!next) break;
        }
        return all;
    }

    public async Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct)
    {
        var o = opts.Value;
        var key = $"{surah}:{ayah}";

        TextSource? en = null;
        if (o.TranslationEnId is int enId)
            en = await Try(async () =>
            {
                using var d = JsonDocument.Parse(await qf.GetJsonAsync($"{V}/quran/translations/{enId}?verse_key={key}", ct));
                var t = d.RootElement.GetProperty("translations")[0];
                var name = d.RootElement.TryGetProperty("meta", out var m) ? Str(m, "translation_name") : null;
                return new TextSource(Str(t, "text") ?? "", name ?? "Quran Foundation", null, "Quran Foundation");
            });

        TafsirDto? tafsir = null;
        foreach (var id in o.TafsirBnIds)
        {
            tafsir = await Try(async () =>
            {
                using var d = JsonDocument.Parse(await qf.GetJsonAsync($"{V}/tafsirs/{id}/by_ayah/{key}", ct));
                var t = d.RootElement.GetProperty("tafsir");
                var text = Str(t, "text");
                return string.IsNullOrWhiteSpace(text) ? null
                    : new TafsirDto(id, Str(t, "resource_name") ?? $"Tafsir {id}", null, text, TafsirPlaceholder.Detect(text));
            });
            if (tafsir != null) break;
        }

        string? audio = await Try(async () =>
        {
            using var d = JsonDocument.Parse(await qf.GetJsonAsync($"{V}/recitations/{o.RecitationId}/by_ayah/{key}", ct));
            var u = Str(d.RootElement.GetProperty("audio_files")[0], "url");
            return u == null ? null : (u.StartsWith("http") ? u : o.AudioHost.TrimEnd('/') + "/" + u.TrimStart('/'));
        });

        return new AyahDetailsDto(key, null, en, tafsir, null, audio, string.IsNullOrEmpty(o.ReciterName) ? null : o.ReciterName);

        async Task<T?> Try<T>(Func<Task<T?>> f)
        {
            try { return await f(); }
            catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException or InvalidOperationException)
            { log.LogWarning("QF detail fetch degraded for {Key}: {Type}", key, e.GetType().Name); return default; }
        }
    }

    public async Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct)
    {
        if (lang != "en" || opts.Value.TranslationEnId is not int id) return null;
        try
        {
            using var d = JsonDocument.Parse(await qf.GetJsonAsync($"{V}/quran/translations/{id}?chapter_number={surah}", ct));
            var list = d.RootElement.GetProperty("translations").EnumerateArray().Select((t, i) => new AyahText(i + 1, Str(t, "text") ?? "")).ToList();
            return new SurahTexts("en", "Quran Foundation", null, "Quran Foundation", list);
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { return null; }
    }

    // QF tafsir is fetched per ayah (see GetDetailsAsync); a whole-surah QF tafsir call has not been verified, so it is not offered here.
    public Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct) => Task.FromResult<SurahTexts?>(null);

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
}
