using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using QuranShikkha.Core.Content;
using QuranShikkha.Infrastructure.Content;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Api.Controllers;

[ApiController, Route("api/v1")]
public class ContentController(IContentService content) : ControllerBase
{
    [HttpGet("surahs")]
    public async Task<IReadOnlyList<ChapterDto>> Surahs(CancellationToken ct) =>
        (await content.GetChaptersAsync(ct)).Where(c => content.Scope.Contains(c.Id)).ToList();

    [HttpGet("surahs/{n:int}/ayahs")]
    public async Task<ActionResult<IReadOnlyList<AyahDto>>> Ayahs(int n, CancellationToken ct) =>
        content.Scope.Contains(n) ? Ok(await content.GetAyahsAsync(n, ct)) : Problem("Surah is outside phase-1 scope.", statusCode: 404);

    /// <summary>Meaning of every ayah of a surah in the chosen language (bn, en or ar).</summary>
    [HttpGet("surahs/{n:int}/translations")]
    public async Task<ActionResult<SurahTexts>> Translations(int n, [FromQuery] string lang = "en", CancellationToken ct = default) =>
        lang is "bn" or "en" or "ar" && content.Scope.Contains(n)
            ? await content.GetTranslationsAsync(n, lang, ct) is { } t ? Ok(t) : Problem("No translation available in this language.", statusCode: 404)
            : Problem("Invalid request.", statusCode: 400);

    /// <summary>Tafsir of every ayah of a surah in the chosen language (bn, en or ar).</summary>
    [HttpGet("surahs/{n:int}/tafsir")]
    public async Task<ActionResult<SurahTexts>> TafsirOfSurah(int n, [FromQuery] string lang = "en", CancellationToken ct = default) =>
        lang is "bn" or "en" or "ar" && content.Scope.Contains(n)
            ? await content.GetTafsirAsync(n, lang, ct) is { } t ? Ok(t) : Problem("No tafsir available in this language.", statusCode: 404)
            : Problem("Invalid request.", statusCode: 400);

    [HttpGet("ayahs/{surah:int}:{ayah:int}/details")]
    public async Task<ActionResult<AyahDetailsDto>> Details(int surah, int ayah, CancellationToken ct) =>
        content.Scope.Contains(surah) && ayah > 0 ? Ok(await content.GetDetailsAsync(surah, ayah, ct)) : Problem("Not found.", statusCode: 404);

    /// <summary>Computed from data on every cache refresh; coverage is never hard-coded.</summary>
    [HttpGet("tracks/frequent")]
    public Task<FrequencyTrackDto> Frequent([FromQuery] int size = 300, CancellationToken ct = default) =>
        content.GetFrequentTrackAsync(size, ct);

    [HttpGet("credits")]
    public Credits GetCredits([FromServices] IOptions<QfOptions> qf, [FromServices] IOptions<QuranEncOptions> enc) => new(
        new[]
        {
            new Credit("Quran Foundation", "Quran text, word-by-word data, translations, tafsir and audio via the Quran Foundation Content API.", "https://quran.foundation"),
            new Credit("QuranEnc.com", $"Bengali translation (bengali_zakaria){(string.IsNullOrEmpty(enc.Value.Version) ? "" : ", version " + enc.Value.Version)}. Text is shown unmodified.", "https://quranenc.com"),
        },
        string.IsNullOrEmpty(qf.Value.ReciterName) ? null : qf.Value.ReciterName,
        "Bangla spelling is only a guide; learn correct Tajweed from a qualified teacher.");
}

public record Credit(string Name, string What, string Url);
public record Credits(IReadOnlyList<Credit> Sources, string? Reciter, string Disclaimer);
