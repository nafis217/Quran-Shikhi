using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using QuranShikkha.Core.Recitation;
using QuranShikkha.Infrastructure.Content;

namespace QuranShikkha.Api.Controllers;

public record RecitationRequest(string AyahKey, string Transcript);
public record RecitationCapabilities(bool ServerAsr);
public record AudioCheckResponse(string Transcript, RecitationResult Result);

[ApiController, Route("api/v1/recitation")]
public class RecitationController(IContentService content, IRecitationTranscriber asr) : ControllerBase
{
    private static readonly Regex Key = new(@"^(\d{1,3}):(\d{1,3})$");

    /// <summary>Tells the client whether a private, on-your-own-machine speech model is available right now.</summary>
    [HttpGet("capabilities")]
    public async Task<RecitationCapabilities> Capabilities(CancellationToken ct) => new(await asr.IsAvailableAsync(ct));

    /// <summary>
    /// Compares a speech-recognition transcript (TEXT only) with the real ayah. Used by browsers without a local model.
    /// Without vowel marks in the transcript only skipped/extra/wrong words can be found.
    /// </summary>
    [HttpPost("compare")]
    public async Task<ActionResult<RecitationResult>> Compare(RecitationRequest r, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(r.Transcript) || r.Transcript.Length > 3000) return Problem("Invalid request.", statusCode: 400);
        return await CompareAsync(r.AyahKey, r.Transcript, ct);
    }

    /// <summary>
    /// Uploads a recording and checks it with the local speech model. The audio goes only to the model service you configured
    /// (Asr:Url) and is never stored. A Quran-tuned model returns vowel marks, so vowel mistakes can be flagged too.
    /// </summary>
    [HttpPost("check-audio")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<AudioCheckResponse>> CheckAudio([FromForm] string ayahKey, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0 || file.Length > 10 * 1024 * 1024) return Problem("Invalid audio.", statusCode: 400);
        if (!await asr.IsAvailableAsync(ct)) return Problem("The speech model is not running.", statusCode: 503);
        string text;
        try { await using var s = file.OpenReadStream(); text = await asr.TranscribeAsync(s, file.FileName, ct); }
        catch (HttpRequestException) { return Problem("The speech model could not process this audio.", statusCode: 502); }
        if (string.IsNullOrWhiteSpace(text)) return Problem("Nothing was heard.", statusCode: 422);
        var res = await CompareAsync(ayahKey, text, ct);
        return res.Result is not null ? res.Result : res.Value is null ? StatusCode(500) : new AudioCheckResponse(text, res.Value);
    }

    private async Task<ActionResult<RecitationResult>> CompareAsync(string ayahKey, string transcript, CancellationToken ct)
    {
        var m = Key.Match(ayahKey ?? "");
        if (!m.Success) return Problem("Invalid request.", statusCode: 400);
        int surah = int.Parse(m.Groups[1].Value), ayah = int.Parse(m.Groups[2].Value);
        if (!content.Scope.Contains(surah)) return Problem("Not found.", statusCode: 404);
        var a = (await content.GetAyahsAsync(surah, ct)).FirstOrDefault(x => x.Ayah == ayah);
        if (a is null) return Problem("Not found.", statusCode: 404);
        return RecitationAligner.Compare(a.Words.Where(w => w.CharType == "word").Select(w => w.ArabicText).ToList(), transcript);
    }
}
