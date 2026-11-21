using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using QuranShikkha.Api.Auth;
using QuranShikkha.Core.Content;
using QuranShikkha.Core.Entities;
using QuranShikkha.Infrastructure.Content;
using QuranShikkha.Infrastructure.Data;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Tests;

public sealed class FakeSource : IContentSource
{
    public Task<IReadOnlyList<ChapterDto>> GetChaptersAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<ChapterDto>>(new[] { new ChapterDto(1, "Al-Fatihah", "الفاتحة", null, 7), new ChapterDto(2, "Al-Baqarah", "x", null, 286) });
    public Task<IReadOnlyList<AyahDto>> GetAyahsAsync(int surah, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<AyahDto>>(new[] { new AyahDto($"{surah}:1", surah, 1, new[] { new WordDto($"{surah}:1:1", 1, "ٱللَّهِ", "wbw/001_001_001.mp3", "আল্লাহ", null, null, "word") }) });
    public Task<SurahTexts?> GetTranslationsAsync(int surah, string lang, CancellationToken ct) =>
        Task.FromResult<SurahTexts?>(lang == "en" ? new SurahTexts("en", "Test", null, null, new[] { new AyahText(1, "In the name") }) : null);
    public Task<SurahTexts?> GetTafsirAsync(int surah, string lang, CancellationToken ct) =>
        Task.FromResult<SurahTexts?>(lang == "bn" ? new SurahTexts("bn", "Test tafsir", null, "Test", new[] { new AyahText(1, "ব্যাখ্যা") }) : null);
    public Task<AyahDetailsDto> GetDetailsAsync(int surah, int ayah, CancellationToken ct) =>
        Task.FromResult(new AyahDetailsDto($"{surah}:{ayah}", null, null, null, null, null, null));
}

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _conn = new("DataSource=:memory:");
    protected override void ConfigureWebHost(IWebHostBuilder b)
    {
        _conn.Open();
        b.UseEnvironment("Testing");
        b.ConfigureServices(s =>
        {
            s.RemoveAll<DbContextOptions<AppDbContext>>(); s.RemoveAll<AppDbContext>(); s.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            s.AddDbContext<AppDbContext>(o => o.UseSqlite(_conn));
            s.RemoveAll<IContentSource>(); s.AddScoped<IContentSource, FakeSource>();
            s.RemoveAll<QuranEncClient>();
            s.AddScoped(sp => new QuranEncClient(new StubFactory(_ => new HttpClient(new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound))) { BaseAddress = new Uri("https://quranenc.test/api/v1/") }),
                sp.GetRequiredService<ICacheStore>(), sp.GetRequiredService<IOptions<QuranEncOptions>>()));
            var hosted = s.Where(d => d.ImplementationType == typeof(PurgeService)).ToList();
            foreach (var d in hosted) s.Remove(d);
        });
    }
    public async Task InitDb()
    {
        using var sc = Services.CreateScope();
        var db = sc.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        await DbSeeder.SeedAsync(db);
    }
    protected override void Dispose(bool d) { base.Dispose(d); _conn.Dispose(); }
}

public class ApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public ApiTests(ApiFactory f) { _f = f; f.InitDb().GetAwaiter().GetResult(); }

    private async Task<HttpClient> GuestClient()
    {
        var c = _f.CreateClient();
        var r = await (await c.PostAsync("/api/v1/auth/guest", null)).Content.ReadFromJsonAsync<AuthResponse>();
        c.DefaultRequestHeaders.Authorization = new("Bearer", r!.Token);
        return c;
    }

    [Fact]
    public async Task Surahs_cover_the_whole_quran_scope()
    {
        var list = await _f.CreateClient().GetFromJsonAsync<List<ChapterDto>>("/api/v1/surahs");
        Assert.Equal(new[] { 1, 2 }, list!.Select(c => c.Id)); // the fake source has two chapters; all are in scope
    }

    [Fact] public async Task Out_of_scope_surah_is_404() =>
        Assert.Equal(HttpStatusCode.NotFound, (await _f.CreateClient().GetAsync("/api/v1/surahs/115/ayahs")).StatusCode);

    [Fact]
    public async Task Draft_context_cards_are_hidden_and_reviewed_are_shown()
    {
        var c = _f.CreateClient();
        var resp = await c.GetAsync("/api/v1/ayahs/111:1/details"); Assert.True(resp.IsSuccessStatusCode, await resp.Content.ReadAsStringAsync()); var d = await resp.Content.ReadFromJsonAsync<AyahDetailsDto>();
        Assert.Null(d!.Context); // seeded cards are all Draft

        using (var sc = _f.Services.CreateScope())
        {
            var db = sc.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ContextCards.Add(new ContextCard { AyahKey = "93:1", AyahEndKey = "93:3", Source = "Test source", TextBn = "পরীক্ষা", ReviewStatus = ReviewStatus.Reviewed });
            await db.SaveChangesAsync();
        }
        Assert.NotNull((await c.GetFromJsonAsync<AyahDetailsDto>("/api/v1/ayahs/93:2/details"))!.Context);
        Assert.Null((await c.GetFromJsonAsync<AyahDetailsDto>("/api/v1/ayahs/93:4/details"))!.Context);
    }

    [Fact]
    public async Task Flashcards_require_auth_then_schedule_with_sm2()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().GetAsync("/api/v1/flashcards/due")).StatusCode);
        var c = await GuestClient();
        Assert.Equal(HttpStatusCode.NoContent, (await c.PostAsJsonAsync("/api/v1/flashcards", new { wordKey = "1:1:2" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/flashcards", new { wordKey = "bad" })).StatusCode);
        var rev = await c.PostAsJsonAsync("/api/v1/flashcards/review", new { wordKey = "1:1:2", quality = 5 });
        Assert.Equal(HttpStatusCode.OK, rev.StatusCode);
        var due = await c.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/v1/flashcards/due");
        Assert.Empty(due!); // now scheduled in the future
    }

    [Fact]
    public async Task Guest_can_upgrade_to_account_keeping_the_same_user()
    {
        var c = _f.CreateClient();
        var g = await (await c.PostAsync("/api/v1/auth/guest", null)).Content.ReadFromJsonAsync<AuthResponse>();
        c.DefaultRequestHeaders.Authorization = new("Bearer", g!.Token);
        var reg = await (await c.PostAsJsonAsync("/api/v1/auth/register", new { email = "a@b.co", password = "longenough1" })).Content.ReadFromJsonAsync<AuthResponse>();
        Assert.Equal(g.UserId, reg!.UserId); Assert.False(reg.IsGuest);
        Assert.Equal(HttpStatusCode.OK, (await _f.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email = "a@b.co", password = "longenough1" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateClient().PostAsJsonAsync("/api/v1/auth/login", new { email = "a@b.co", password = "wrong" })).StatusCode);
    }

    [Fact]
    public async Task Report_validates_and_accepts() 
    {
        var c = _f.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/reports", new { targetType = "nope", targetId = "1:1", note = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await c.PostAsJsonAsync("/api/v1/reports", new { targetType = "tafsir", targetId = "1:1", note = "(আরবি) missing" })).StatusCode);
    }

    [Fact]
    public async Task Familiar_words_lesson_resolves_against_data_and_leaves_unmatched_null()
    {
        var c = _f.CreateClient();
        var lessons = await c.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/v1/lessons");
        var id = lessons!.First(l => l.GetProperty("type").GetString() == "familiar").GetProperty("id").GetInt32();
        var detail = await c.GetFromJsonAsync<System.Text.Json.JsonElement>($"/api/v1/lessons/{id}");
        var items = detail.GetProperty("items").EnumerateArray().ToList();
        Assert.Equal(7, items.Count);
        Assert.NotEqual(System.Text.Json.JsonValueKind.Null, items[0].GetProperty("word").ValueKind); // Allah found
        Assert.Equal(System.Text.Json.JsonValueKind.Null, items[1].GetProperty("word").ValueKind);   // not in fake data
    }

    [Fact]
    public async Task Credits_include_quran_foundation_and_quranenc_and_disclaimer()
    {
        var j = await _f.CreateClient().GetStringAsync("/api/v1/credits");
        Assert.Contains("Quran Foundation", j); Assert.Contains("QuranEnc.com", j); Assert.Contains("qualified teacher", j);
    }

    [Fact]
    public async Task Translations_and_tafsir_endpoints_follow_the_language_and_validate()
    {
        var c = _f.CreateClient();
        var en = await c.GetFromJsonAsync<SurahTexts>("/api/v1/surahs/1/translations?lang=en");
        Assert.Equal("In the name", en!.Ayahs[0].Text);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/v1/surahs/1/translations?lang=ar")).StatusCode); // fake has none
        var bn = await c.GetFromJsonAsync<SurahTexts>("/api/v1/surahs/1/tafsir?lang=bn");
        Assert.Equal("ব্যাখ্যা", bn!.Ayahs[0].Text);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/surahs/1/tafsir?lang=xx")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync("/api/v1/surahs/115/tafsir?lang=bn")).StatusCode);
    }
}
