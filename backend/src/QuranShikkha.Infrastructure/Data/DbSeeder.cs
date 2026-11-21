using Microsoft.EntityFrameworkCore;
using QuranShikkha.Core.Entities;

namespace QuranShikkha.Infrastructure.Data;

/// <summary>Seeds OUR OWN content only: lesson structure and Draft context cards. No Quran Foundation text.</summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        if (!await db.Lessons.AnyAsync(ct))
        {
            var order = 1;
            db.Lessons.Add(new Lesson { Order = order++, Title = "সূরা আল-ফাতিহা", TitleEn = "Surah Al-Fatiha", Type = "surah", AyahRange = "1:1-1:7" });
            var familiar = new Lesson { Order = order++, Title = "পরিচিত শব্দ আগে", TitleEn = "Familiar words first", Type = "familiar" };
            string[][] fam =
            {
                new[] { "الله", "আল্লাহ", "Allah" }, new[] { "رحمن", "রাহমান", "Rahman" },
                new[] { "صلاة|صلوة", "সালাত", "Salat" }, new[] { "كتاب|كتب", "কিতাব", "Kitab" },
                new[] { "نور", "নূর", "Nur" }, new[] { "دنيا", "দুনিয়া", "Dunya" },
                new[] { "اخرة|ءاخرة|اخره|ءاخره", "আখিরাত", "Akhirat" },
            };
            for (var i = 0; i < fam.Length; i++)
                familiar.Items.Add(new LessonItem { ArabicMatch = fam[i][0], Note = $"{fam[i][1]}|{fam[i][2]}", Order = i + 1 });
            db.Lessons.Add(familiar);
            db.Lessons.Add(new Lesson { Order = order++, Title = "সবচেয়ে বেশি ব্যবহৃত ~৩০০ শব্দ", TitleEn = "Most frequent ~300 words", Type = "frequent" });
            for (var s = 114; s >= 78; s--) // short surahs first
                db.Lessons.Add(new Lesson { Order = order++, Title = $"সূরা {s}", TitleEn = $"Surah {s}", Type = "surah", AyahRange = $"{s}:1" });
            await db.SaveChangesAsync(ct);
        }

        if (!await db.ContextCards.AnyAsync(ct))
        {
            // All Draft: NEVER shown in the UI until a qualified scholar reviews and flips ReviewStatus.
            db.ContextCards.AddRange(
                new ContextCard { AyahKey = "111:1", AyahEndKey = "111:5", Source = "Sahih al-Bukhari (narration summary) — NEEDS SCHOLAR REVIEW", TextBn = "[খসড়া — আলিমের যাচাই প্রয়োজন] সাফা পাহাড়ে রাসূল ﷺ-এর আহ্বানের পর আবু লাহাবের প্রতিক্রিয়া সংক্রান্ত বর্ণনা।", ReviewStatus = ReviewStatus.Draft },
                new ContextCard { AyahKey = "93:1", AyahEndKey = "93:3", Source = "Sahih al-Bukhari (narration summary) — NEEDS SCHOLAR REVIEW", TextBn = "[খসড়া — আলিমের যাচাই প্রয়োজন] ওহী আসা কিছুদিন বিরতি থাকার প্রেক্ষাপট সংক্রান্ত বর্ণনা।", ReviewStatus = ReviewStatus.Draft },
                new ContextCard { AyahKey = "108:1", AyahEndKey = "108:3", Source = "Needs source and scholar review", TextBn = "[খসড়া — উৎস ও আলিমের যাচাই প্রয়োজন]", ReviewStatus = ReviewStatus.Draft });
            await db.SaveChangesAsync(ct);
        }
    }
}
