using Microsoft.EntityFrameworkCore;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Entities;
using QuranShikkha.Infrastructure.Data;

namespace QuranShikkha.Infrastructure.Content;

public interface IContentService
{
    Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct);
    Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct);
    Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct);
    Task<FrequencyTrackDto> GetFrequentTrackAsync(int size, CancellationToken ct);
    /// <summary>Every ayah of the Quran (114 surahs). Built once, then served from memory.</summary>
    Task<IReadOnlyList<AyahDto>> GetAllAyahsAsync(CancellationToken ct);
    Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct);
    Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct);
    IReadOnlyList<int> Scope { get; }
}

public sealed class ContentService(IContentSource source, QuranEncClient enc, AppDbContext db) : IContentService
{
    /// <summary>The whole Quran: surahs 1 to 114.</summary>
    public IReadOnlyList<int> Scope { get; } = Enumerable.Range(1, 114).ToArray();

    private static readonly SemaphoreSlim AllGate = new(1, 1);
    private static IReadOnlyList<AyahDto>? _all;
    private static DateTime _allAt;

    public async Task<IReadOnlyList<AyahDto>> GetAllAyahsAsync(CancellationToken ct)
    {
        if (_all is not null && DateTime.UtcNow - _allAt < TimeSpan.FromHours(6)) return _all;
        await AllGate.WaitAsync(ct);
        try
        {
            if (_all is not null && DateTime.UtcNow - _allAt < TimeSpan.FromHours(6)) return _all;
            var list = new List<AyahDto>();
            foreach (var s in Scope) list.AddRange(await source.GetAyahsAsync(s, ct)); // sources cache for <= 7 days
            _all = list; _allAt = DateTime.UtcNow;
            return list;
        }
        finally { AllGate.Release(); }
    }

    public Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct) => source.GetChaptersAsync(ct);

    public Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct)
    {
        if (!Scope.Contains(surah)) throw new ArgumentOutOfRangeException(nameof(surah), "Surah is outside the phase-1 scope.");
        return source.GetAyahsAsync(surah, ct);
    }

    public async Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct)
    {
        if (!Scope.Contains(surah)) throw new ArgumentOutOfRangeException(nameof(surah));
        var d = await source.GetDetailsAsync(surah, ayah, ct);
        var bn = await enc.GetAsync(surah, ayah, ct) ?? d.TranslationBn; // QuranEnc preferred, unmodified
        var arabic = (await source.GetAyahsAsync(surah, ct)).FirstOrDefault(a => a.Ayah == ayah)?.Words
            .Where(w => w.CharType == "word").Select(w => w.ArabicText);
        return d with { TranslationBn = bn, Context = await ContextFor(surah, ayah, ct), ArabicText = arabic is null ? null : string.Join(' ', arabic) };
    }

    /// <summary>Only Reviewed cards are ever returned.</summary>
    internal async Task<ContextCardDto?> ContextFor(int surah, int ayah, CancellationToken ct)
    {
        var key = $"{surah}:{ayah}";
        var cards = await db.ContextCards.AsNoTracking()
            .Where(c => c.ReviewStatus == ReviewStatus.Reviewed && c.AyahKey.StartsWith(surah + ":")).ToListAsync(ct);
        var c = cards.FirstOrDefault(c => Covers(c, surah, ayah));
        return c == null ? null : new ContextCardDto(c.Source, c.TextBn, c.TextEn);
    }

    internal static bool Covers(ContextCard c, int surah, int ayah)
    {
        var start = int.Parse(c.AyahKey.Split(':')[1]);
        var end = c.AyahEndKey is null ? start : int.Parse(c.AyahEndKey.Split(':')[1]);
        return start <= ayah && ayah <= end;
    }

    /// <summary>Translation of a whole surah in the reader's language. Bangla is QuranEnc, unmodified, with its source and version.</summary>
    public Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct)
    {
        if (!Scope.Contains(surah)) throw new ArgumentOutOfRangeException(nameof(surah));
        return lang == "bn" ? enc.GetSurahAsync(surah, ct) : source.GetTranslationsAsync(surah, lang, ct);
    }

    public Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct)
    {
        if (!Scope.Contains(surah)) throw new ArgumentOutOfRangeException(nameof(surah));
        return source.GetTafsirAsync(surah, lang, ct);
    }

    public async Task<FrequencyTrackDto> GetFrequentTrackAsync(int size, CancellationToken ct) =>
        FrequencyTrack.Build(await GetAllAyahsAsync(ct), Math.Clamp(size, 1, 1000), "Whole Quran");
}
