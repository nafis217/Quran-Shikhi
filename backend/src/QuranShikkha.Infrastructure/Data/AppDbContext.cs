using Microsoft.EntityFrameworkCore;
using QuranShikkha.Core.Entities;

namespace QuranShikkha.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Word> Words => Set<Word>();
    public DbSet<WordMeaning> WordMeanings => Set<WordMeaning>();
    public DbSet<Syllable> Syllables => Set<Syllable>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<LessonItem> LessonItems => Set<LessonItem>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<UserProgress> UserProgress => Set<UserProgress>();
    public DbSet<FlashcardState> Flashcards => Set<FlashcardState>();
    public DbSet<ContextCard> ContextCards => Set<ContextCard>();
    public DbSet<ContentReport> ContentReports => Set<ContentReport>();
    public DbSet<QfCacheEntry> QfCache => Set<QfCacheEntry>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Word>(e =>
        {
            e.HasIndex(x => new { x.Surah, x.Ayah, x.Position }).IsUnique();
            e.Ignore(x => x.WordKey);
            e.Property(x => x.ArabicText).HasMaxLength(200);
            e.Property(x => x.AudioPath).HasMaxLength(200);
        });
        b.Entity<WordMeaning>(e =>
        {
            e.HasOne<Word>().WithMany().HasForeignKey(x => x.WordId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Lang).HasMaxLength(8);
            e.Property(x => x.Source).HasMaxLength(100);
            e.HasIndex(x => new { x.WordId, x.Lang });
        });
        b.Entity<Syllable>(e =>
        {
            e.HasOne<Word>().WithMany().HasForeignKey(x => x.WordId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.WordId, x.Order }).IsUnique();
        });
        b.Entity<Lesson>(e => e.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.LessonId));
        b.Entity<AppUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique().HasFilter("[Email] IS NOT NULL");
            e.HasIndex(x => x.GoogleSubject).IsUnique().HasFilter("[GoogleSubject] IS NOT NULL");
            e.Property(x => x.Email).HasMaxLength(256);
        });
        b.Entity<UserProgress>(e => e.HasIndex(x => new { x.UserId, x.LessonId }).IsUnique());
        b.Entity<FlashcardState>(e =>
        {
            // WordKey ("surah:ayah:position") is a stable identity; no FK so cache purges never break user data.
            e.Property(x => x.WordKey).HasMaxLength(32);
            e.HasIndex(x => new { x.UserId, x.WordKey }).IsUnique();
            e.HasIndex(x => new { x.UserId, x.DueAt });
        });
        b.Entity<ContextCard>(e =>
        {
            e.Property(x => x.AyahKey).HasMaxLength(16);
            e.Property(x => x.AyahEndKey).HasMaxLength(16);
            e.Property(x => x.Source).HasMaxLength(300).IsRequired();
            e.Property(x => x.ReviewStatus).HasConversion<string>().HasMaxLength(16);
            e.HasIndex(x => x.AyahKey);
        });
        b.Entity<ContentReport>(e => { e.Property(x => x.Note).HasMaxLength(2000); });
        b.Entity<QfCacheEntry>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(400);
            e.HasIndex(x => x.ExpiresAt);
            // QF terms: cache at most 1 week. Enforced in code AND as a DB constraint.
            if (Database.IsSqlServer())
                e.ToTable(t => t.HasCheckConstraint("CK_QfCache_MaxAge", "DATEDIFF(day, [FetchedAt], [ExpiresAt]) <= 7"));
        });
    }
}
