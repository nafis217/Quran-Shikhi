using System.Text.Json;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Text;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Infrastructure.Content;

/// <summary>
/// PROTOTYPE SOURCE (no credentials needed). Replaced automatically by the Quran Foundation source when Qf credentials exist.
///  - Words, Bangla + English word meanings, exact word audio: Quran.com's backing service (api.qurancdn.com/qdc), the one quran.com itself uses.
///  - Ayah text, English/Arabic translation, ayah audio: api.alquran.cloud (Saheeh International, Muyassar, Alafasy).
///  - Tafsir (Bangla Ibn Kathir / English Ibn Kathir / Arabic Muyassar) and the reason for revelation (Al-Wahidi): the free
///    spa5k/tafsir_api data on jsDelivr (code is MIT; the licence of each tafsir text must be checked before release).
/// Everything is cached for at most 7 days. Remove before release or confirm each source's terms (docs/data-licenses.md).
/// </summary>
public sealed class DevAlQuranCloudSource(IHttpClientFactory http, ICacheStore cache) : IContentSource
{
    public const string ClientName = "alquran-cloud";
    public const string PublicQuranClient = "quran-public";
    public const string TafsirClient = "tafsir-cdn";

    private static readonly Dictionary<string, (string Slug, string Name, string Attribution)> Tafsirs = new()
    {
        ["bn"] = ("bn-tafseer-ibn-e-kaseer", "তাফসীর ইবনে কাসীর", "Tawheed Publication"),
        ["en"] = ("en-tafisr-ibn-kathir", "Tafsir Ibn Kathir (abridged)", "Hafiz Ibn Kathir"),
        ["ar"] = ("ar-tafsir-muyassar", "التفسير الميسر", "King Fahd Complex"),
    };
    private const string AsbabSlug = "en-asbab-al-nuzul-by-al-wahidi";

    private Task<string> Get(string client, string path, CancellationToken ct) =>
        CacheHelper.GetOrAddAsync(cache, $"{client}:{path}", TimeSpan.FromDays(7), async () => await http.CreateClient(client).GetStringAsync(path, ct), ct);

    public async Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct)
    {
        using var d = JsonDocument.Parse(await Get(ClientName, "surah", ct));
        return d.RootElement.GetProperty("data").EnumerateArray().Select(s => new ChapterDto(
            s.GetProperty("number").GetInt32(), s.GetProperty("englishName").GetString() ?? "",
            s.GetProperty("name").GetString() ?? "", s.GetProperty("englishNameTranslation").GetString(),
            s.GetProperty("numberOfAyahs").GetInt32())).ToList();
    }

    public async Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct)
    {
        try
        {
            var bn = await PublicWordsAsync(surah, "bn", ct);
            List<AyahDto>? en = null;
            try { en = await PublicWordsAsync(surah, "en", ct); } catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { }
            if (bn.Count > 0)
            {
                var enBy = en?.SelectMany(a => a.Words).ToDictionary(w => w.Key, w => w.MeaningBn) ?? new();
                return bn.Select(a => a with { Words = a.Words.Select(w => w with { MeaningEn = enBy.GetValueOrDefault(w.Key) }).ToList() }).ToList();
            }
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { /* fall back below */ }
        return await SpaceSplitAsync(surah, ct);
    }

    /// <summary>Real word-by-word data from Quran.com's own backing service: exact words, meanings in one language, word audio paths. Whole surah in one request.</summary>
    private async Task<List<AyahDto>> PublicWordsAsync(int surah, string lang, CancellationToken ct)
    {
        var ayahs = new List<AyahDto>();
        for (var page = 1; ; page++)
        {
            using var d = JsonDocument.Parse(await Get(PublicQuranClient,
                $"verses/by_chapter/{surah}?words=true&word_translation_language={lang}&word_fields=text_uthmani&per_page=300&page={page}", ct));
            foreach (var v in d.RootElement.GetProperty("verses").EnumerateArray())
            {
                var key = v.GetProperty("verse_key").GetString()!; var n = int.Parse(key.Split(':')[1]);
                var words = v.GetProperty("words").EnumerateArray().Select(w =>
                {
                    var pos = w.GetProperty("position").GetInt32();
                    var meaning = w.TryGetProperty("translation", out var t) && t.TryGetProperty("text", out var tt) ? tt.GetString() : null;
                    var text = w.GetProperty("text_uthmani").GetString() ?? "";
                    // the source sometimes labels a verse-number mark (e.g. "١٨١" in 2:181) as a word: a token with no Arabic letter is not a word
                    var isWord = text.Any(ch => ch is >= '\u0621' and <= '\u064A' or '\u0671');
                    return new WordDto($"{key}:{pos}", pos, text,
                        w.TryGetProperty("audio_url", out var a) && a.ValueKind == JsonValueKind.String ? a.GetString() : null,
                        meaning, null, null, !isWord ? "end" : w.TryGetProperty("char_type_name", out var ct2) ? ct2.GetString() ?? "word" : "word");
                }).ToList();
                ayahs.Add(new AyahDto(key, surah, n, words));
            }
            var next = d.RootElement.TryGetProperty("pagination", out var p) && p.TryGetProperty("next_page", out var np) && np.ValueKind == JsonValueKind.Number;
            if (!next) break;
        }
        return ayahs;
    }

    /// <summary>Last resort when the word API is unreachable: words are the ayah split on spaces, no meanings.</summary>
    private async Task<IReadOnlyList<AyahDto>> SpaceSplitAsync(int surah, CancellationToken ct)
    {
        using var d = JsonDocument.Parse(await Get(ClientName, $"surah/{surah}/quran-uthmani", ct));
        var ayahs = new List<AyahDto>();
        foreach (var a in d.RootElement.GetProperty("data").GetProperty("ayahs").EnumerateArray())
        {
            var n = a.GetProperty("numberInSurah").GetInt32(); var key = $"{surah}:{n}";
            var tokens = new List<string>(); var pending = "";
            foreach (var t in a.GetProperty("text").GetString()!.Replace("﻿", "").Split(' ', StringSplitOptions.RemoveEmptyEntries))
            {
                var hasLetter = t.Any(ch => ch is >= 'ء' and <= 'ي' or 'ٱ');
                if (hasLetter) { tokens.Add(pending + t); pending = ""; }
                else if (tokens.Count > 0) tokens[^1] += " " + t;
                else pending += t + " ";
            }
            ayahs.Add(new AyahDto(key, surah, n, tokens.Select((t, i) => new WordDto($"{key}:{i + 1}", i + 1, t, $"wbw/{surah:000}_{n:000}_{i + 1:000}.mp3", null, null, null, "word")).ToList()));
        }
        return ayahs;
    }

    public async Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct)
    {
        var key = $"{surah}:{ayah}";
        var en = await Try(async () => new TextSource(await Edition(key, "en.sahih", ct), "Saheeh International (api.alquran.cloud, dev only)", null, null));
        string? audio = null, reciter = null;
        try
        {
            using var d = JsonDocument.Parse(await Get(ClientName, $"ayah/{key}/ar.alafasy", ct));
            audio = d.RootElement.GetProperty("data").GetProperty("audio").GetString();
            reciter = d.RootElement.GetProperty("data").GetProperty("edition").GetProperty("englishName").GetString();
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { }

        var bnT = await TafsirOf("bn", surah, ayah, ct);
        var enT = await TafsirOf("en", surah, ayah, ct);
        var arT = await TafsirOf("ar", surah, ayah, ct);
        var rev = await Text(AsbabSlug, surah, ayah, ct) is { } r
            ? new TafsirDto(0, "Asbab al-Nuzul — Al-Wahidi (English)", "Classical source; not scholar-reviewed", r, false) : null;
        return new AyahDetailsDto(key, null, en, bnT, null, audio, reciter is null ? null : $"{reciter} (alquran.cloud / Islamic Network, dev only)", null, enT, arT, rev);
    }

    private async Task<string> Edition(string key, string edition, CancellationToken ct)
    {
        using var d = JsonDocument.Parse(await Get(ClientName, $"ayah/{key}/{edition}", ct));
        return d.RootElement.GetProperty("data").GetProperty("text").GetString() ?? "";
    }

    private async Task<T?> Try<T>(Func<Task<T>> f) where T : class
    {
        try { return await f(); }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { return null; }
    }

    /// <summary>One ayah's tafsir/asbab text. Null when the edition has nothing for this ayah.</summary>
    private async Task<string?> Text(string slug, int surah, int ayah, CancellationToken ct)
    {
        try
        {
            using var d = JsonDocument.Parse(await Get(TafsirClient, $"{slug}/{surah}/{ayah}.json", ct));
            var t = d.RootElement.GetProperty("text").GetString();
            return string.IsNullOrWhiteSpace(t) ? null : t;
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { return null; }
    }

    private async Task<TafsirDto?> TafsirOf(string lang, int surah, int ayah, CancellationToken ct)
    {
        var t = Tafsirs[lang];
        var text = await Text(t.Slug, surah, ayah, ct);
        return text is null ? null : new TafsirDto(0, t.Name, t.Attribution, text, TafsirPlaceholder.Detect(text));
    }

    public async Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct)
    {
        var edition = lang switch { "en" => "en.sahih", "ar" => "ar.muyassar", _ => null };
        if (edition is null) return null;
        try
        {
            using var d = JsonDocument.Parse(await Get(ClientName, $"surah/{surah}/{edition}", ct));
            var list = d.RootElement.GetProperty("data").GetProperty("ayahs").EnumerateArray()
                .Select(a => new AyahText(a.GetProperty("numberInSurah").GetInt32(), (a.GetProperty("text").GetString() ?? "").Replace("﻿", ""))).ToList();
            return lang == "en"
                ? new SurahTexts("en", "Saheeh International (api.alquran.cloud, dev only)", null, null, list)
                : new SurahTexts("ar", "التفسير الميسر (api.alquran.cloud, dev only)", null, null, list);
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { return null; }
    }

    public async Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct)
    {
        if (!Tafsirs.TryGetValue(lang, out var t)) return null;
        try
        {
            using var d = JsonDocument.Parse(await Get(TafsirClient, $"{t.Slug}/{surah}.json", ct));
            var list = d.RootElement.EnumerateArray()
                .Select(a => new AyahText(a.GetProperty("ayah").GetInt32(), a.GetProperty("text").GetString() ?? "")).Where(a => a.Text.Length > 0).ToList();
            return new SurahTexts(lang, t.Name, null, t.Attribution, list);
        }
        catch (Exception e) when (e is HttpRequestException or JsonException or KeyNotFoundException) { return null; }
    }
}
