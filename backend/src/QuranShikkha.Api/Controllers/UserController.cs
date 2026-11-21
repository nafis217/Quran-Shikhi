using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuranShikkha.Api.Auth;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Entities;
using QuranShikkha.Core.Srs;
using QuranShikkha.Infrastructure.Content;
using QuranShikkha.Infrastructure.Data;

namespace QuranShikkha.Api.Controllers;

public record ReportRequest(string TargetType, string TargetId, string Note);
public record ReviewRequest(string WordKey, int Quality);
public record AddCardRequest(string WordKey);
public record ProgressRequest(int CompletedItems);

[ApiController, Route("api/v1")]
public class LessonsController(AppDbContext db, IContentService content) : ControllerBase
{
    [HttpGet("lessons")]
    public async Task<object> List(CancellationToken ct) =>
        await db.Lessons.AsNoTracking().OrderBy(l => l.Order)
            .Select(l => new { l.Id, l.Order, l.Title, l.TitleEn, l.Type, l.AyahRange, ItemCount = l.Items.Count }).ToListAsync(ct);

    /// <summary>Lesson detail. "familiar" items are resolved against loaded data (no hard-coded positions).</summary>
    [HttpGet("lessons/{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken ct)
    {
        var l = await db.Lessons.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (l == null) return NotFound();
        if (l.Type != "familiar") return new { l.Id, l.Title, l.TitleEn, l.Type, l.AyahRange, Items = Array.Empty<object>() };

        var words = (await content.GetAllAyahsAsync(ct)).SelectMany(a => a.Words).Where(w => w.CharType == "word").ToList();
        var items = l.Items.OrderBy(i => i.Order).Select(i =>
        {
            var alts = (i.ArabicMatch ?? "").Split('|');
            var hit = words.FirstOrDefault(w =>
            {
                var n = FrequencyTrack.NormalizeKey(w.ArabicText);
                return alts.Any(m => n == m || n == "ال" + m);
            });
            var parts = (i.Note ?? "").Split('|');
            return new { LabelBn = parts[0], LabelEn = parts.ElementAtOrDefault(1), Word = hit };
        }).ToList();
        return new { l.Id, l.Title, l.TitleEn, l.Type, l.AyahRange, Items = items };
    }
}

[ApiController, Authorize, Route("api/v1")]
public class UserDataController(AppDbContext db) : ControllerBase
{
    [HttpGet("progress")]
    public async Task<object> Progress(CancellationToken ct)
    {
        var uid = User.UserId()!.Value;
        return await db.UserProgress.AsNoTracking().Where(p => p.UserId == uid).Select(p => new { p.LessonId, p.CompletedItems, p.UpdatedAt }).ToListAsync(ct);
    }

    [HttpPut("progress/{lessonId:int}")]
    public async Task<IActionResult> SetProgress(int lessonId, ProgressRequest r, CancellationToken ct)
    {
        var uid = User.UserId()!.Value;
        if (r.CompletedItems < 0) return Problem("Invalid value.", statusCode: 400);
        var p = await db.UserProgress.FirstOrDefaultAsync(x => x.UserId == uid && x.LessonId == lessonId, ct);
        if (p == null) db.UserProgress.Add(p = new UserProgress { UserId = uid, LessonId = lessonId });
        p.CompletedItems = r.CompletedItems; p.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("flashcards")]
    public async Task<IActionResult> Add(AddCardRequest r, CancellationToken ct)
    {
        var uid = User.UserId()!.Value;
        if (!System.Text.RegularExpressions.Regex.IsMatch(r.WordKey ?? "", @"^\d{1,3}:\d{1,3}:\d{1,3}$")) return Problem("Invalid wordKey.", statusCode: 400);
        if (!await db.Flashcards.AnyAsync(f => f.UserId == uid && f.WordKey == r.WordKey, ct))
        {
            db.Flashcards.Add(new FlashcardState { UserId = uid, WordKey = r.WordKey, DueAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpGet("flashcards/due")]
    public async Task<object> Due(CancellationToken ct)
    {
        var uid = User.UserId()!.Value; var now = DateTime.UtcNow;
        return await db.Flashcards.AsNoTracking().Where(f => f.UserId == uid && f.DueAt <= now).OrderBy(f => f.DueAt).Take(50)
            .Select(f => new { f.WordKey, f.Ease, f.IntervalDays, f.DueAt }).ToListAsync(ct);
    }

    [HttpPost("flashcards/review")]
    public async Task<IActionResult> Review(ReviewRequest r, CancellationToken ct)
    {
        var uid = User.UserId()!.Value;
        if (r.Quality is < 0 or > 5) return Problem("Quality must be 0..5.", statusCode: 400);
        var f = await db.Flashcards.FirstOrDefaultAsync(x => x.UserId == uid && x.WordKey == r.WordKey, ct);
        if (f == null) return NotFound();
        var n = Sm2.Next(new Sm2.State(f.Ease, f.IntervalDays, f.Repetitions), r.Quality);
        f.Ease = n.Ease; f.IntervalDays = n.IntervalDays; f.Repetitions = n.Repetitions;
        f.DueAt = DateTime.UtcNow.AddDays(n.IntervalDays);
        await db.SaveChangesAsync(ct);
        return Ok(new { f.WordKey, f.Ease, f.IntervalDays, f.DueAt });
    }

    [HttpGet("flashcards/export-keys")]
    public async Task<object> Keys(CancellationToken ct) =>
        await db.Flashcards.AsNoTracking().Where(f => f.UserId == User.UserId()).Select(f => f.WordKey).ToListAsync(ct);
}

[ApiController, Route("api/v1/reports")]
public class ReportsController(AppDbContext db) : ControllerBase
{
    private static readonly string[] Types = { "tafsir", "translation", "word", "context", "pronunciation" };

    [HttpPost]
    public async Task<IActionResult> Create(ReportRequest r, CancellationToken ct)
    {
        if (!Types.Contains(r.TargetType) || string.IsNullOrWhiteSpace(r.TargetId) || r.TargetId.Length > 64) return Problem("Invalid report.", statusCode: 400);
        db.ContentReports.Add(new ContentReport { UserId = User.UserId(), TargetType = r.TargetType, TargetId = r.TargetId, Note = (r.Note ?? "")[..Math.Min(2000, (r.Note ?? "").Length)] });
        await db.SaveChangesAsync(ct);
        return Accepted();
    }
}
