namespace QuranShikkha.Core.Content;

public static class CachePolicy
{
    /// <summary>Quran Foundation terms: cache at most 1 week unless using Content Sync.</summary>
    public static readonly TimeSpan MaxAge = TimeSpan.FromDays(7);

    public static TimeSpan Clamp(TimeSpan requested) => requested > MaxAge ? MaxAge : requested;
}

public record WordDto(string Key, int Position, string ArabicText, string? AudioPath, string? MeaningBn, string? MeaningEn, string? TranslitLatin, string CharType);
public record AyahDto(string Key, int Surah, int Ayah, IReadOnlyList<WordDto> Words);
public record TextSource(string Text, string Source, string? Version, string? Attribution);
public record TafsirDto(int ResourceId, string Name, string? Attribution, string Text, bool HasPlaceholder);
public record ContextCardDto(string Source, string TextBn, string? TextEn);
/// <summary>Tafsir and reason-for-revelation texts in each language. Revelation is a classical source (Al-Wahidi) shown with attribution, not scholar-reviewed.</summary>
public record AyahDetailsDto(string Key, TextSource? TranslationBn, TextSource? TranslationEn, TafsirDto? TafsirBn, ContextCardDto? Context, string? AudioUrl, string? Reciter, string? ArabicText = null,
    TafsirDto? TafsirEn = null, TafsirDto? TafsirAr = null, TafsirDto? Revelation = null);
public record AyahText(int Ayah, string Text);
public record SurahTexts(string Language, string Source, string? Version, string? Attribution, IReadOnlyList<AyahText> Ayahs);
public record ChapterDto(int Id, string NameSimple, string NameArabic, string? TranslatedName, int VersesCount);
public record FrequentWordDto(int Rank, string ArabicText, int Count, double CumulativeCoveragePercent, string ExampleKey, string? MeaningBn, string? AudioPath, string? MeaningEn = null);
public record FrequencyTrackDto(int TotalWordTokens, int DistinctWords, IReadOnlyList<FrequentWordDto> Words, double CoveragePercent, string Scope);

public interface IContentSource
{
    Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct);
    Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct);
    Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct);
    /// <summary>Whole-surah translation in 'en' or 'ar' (Bangla comes from QuranEnc). Null when this source has none.</summary>
    Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct);
    /// <summary>Whole-surah tafsir in 'bn', 'en' or 'ar'. Null when this source has none.</summary>
    Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct);
}

public interface ICacheStore
{
    Task<string?> GetAsync(string key, CancellationToken ct);
    /// <summary>Stores payload. TTL is clamped to <see cref="CachePolicy.MaxAge"/>.</summary>
    Task SetAsync(string key, string payloadJson, TimeSpan ttl, CancellationToken ct);
    Task<int> PurgeExpiredAsync(CancellationToken ct);
}
