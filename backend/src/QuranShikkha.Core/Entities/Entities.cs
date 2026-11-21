namespace QuranShikkha.Core.Entities;

/// <summary>
/// Cached word identity. QF-derived columns (ArabicText, QfWordId, AudioPath) are a CACHE:
/// rows are purged after <see cref="Content.CachePolicy.MaxAge"/>. User data references WordKey, never this row's Id.
/// </summary>
public class Word
{
    public int Id { get; set; }
    public int Surah { get; set; }
    public int Ayah { get; set; }
    public int Position { get; set; }
    public string ArabicText { get; set; } = "";
    public string? TranslitLatin { get; set; }
    public string? TranslitBangla { get; set; }
    public string? SyllablesJson { get; set; }
    public int? RootId { get; set; }          // stays null until a root source's license is cleared
    public int? QfWordId { get; set; }
    public string? AudioPath { get; set; }     // relative, e.g. wbw/001_001_001.mp3
    public DateTime FetchedAt { get; set; }
    public string WordKey => $"{Surah}:{Ayah}:{Position}";
}

public class WordMeaning
{
    public int Id { get; set; }
    public int WordId { get; set; }
    public string Lang { get; set; } = "bn";
    public string Text { get; set; } = "";
    public string Source { get; set; } = "";
}

public class Syllable
{
    public int Id { get; set; }
    public int WordId { get; set; }
    public int Order { get; set; }
    public string BanglaText { get; set; } = "";
    public string? AudioKey { get; set; }
}

public class Lesson
{
    public int Id { get; set; }
    public int Order { get; set; }
    public string Title { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string Type { get; set; } = "words"; // familiar | surah | frequent
    public string? AyahRange { get; set; }
    public List<LessonItem> Items { get; set; } = new();
}

public class LessonItem
{
    public int Id { get; set; }
    public int LessonId { get; set; }
    public string? WordKey { get; set; }    // "surah:ayah:position"
    public string? AyahKey { get; set; }    // "surah:ayah"
    /// <summary>Unvoweled Arabic match key, resolved against loaded data at request time (no hardcoded word positions).</summary>
    public string? ArabicMatch { get; set; }
    public string? Note { get; set; }
    public int Order { get; set; }
}

public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public bool IsGuest { get; set; }
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class UserProgress
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public int LessonId { get; set; }
    public int CompletedItems { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class FlashcardState
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public string WordKey { get; set; } = "";
    public double Ease { get; set; } = 2.5;
    public int IntervalDays { get; set; }
    public int Repetitions { get; set; }
    public DateTime DueAt { get; set; } = DateTime.UtcNow;
}

public enum ReviewStatus { Draft = 0, Reviewed = 1 }

public class ContextCard
{
    public int Id { get; set; }
    public string AyahKey { get; set; } = "";      // "surah:ayah" or start of a range
    public string? AyahEndKey { get; set; }
    public string Source { get; set; } = "";       // required: named work
    public string TextBn { get; set; } = "";
    public string? TextEn { get; set; }
    public ReviewStatus ReviewStatus { get; set; } = ReviewStatus.Draft;
}

public class ContentReport
{
    public int Id { get; set; }
    public Guid? UserId { get; set; }
    public string TargetType { get; set; } = "";   // tafsir | translation | word | context
    public string TargetId { get; set; } = "";
    public string Note { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class QfCacheEntry
{
    public string Key { get; set; } = "";
    public string PayloadJson { get; set; } = "";
    public DateTime FetchedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
