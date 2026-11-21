using System.Net;
using System.Net.Http.Json;
using QuranShikkha.Core.Recitation;

namespace QuranShikkha.Tests;

public class RecitationAlignerTests
{
    // Al-Fatiha 1:2 (Uthmani) as the expected text
    private static readonly string[] Exp = { "ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَٰلَمِينَ" };

    [Fact]
    public void Perfect_recitation_without_vowel_marks_scores_100()
    {
        var r = RecitationAligner.Compare(Exp, "الحمد لله رب العالمين");
        Assert.Equal(100, r.Score);
        Assert.All(r.Words, w => Assert.Equal(WordStatus.Correct, w.Status));
        Assert.Equal(0, r.ExtraWords);
    }

    [Fact]
    public void Letter_variants_recognizers_write_inconsistently_are_tolerated()
    {
        // dagger alef dropped, alef forms differ, hamza absent
        Assert.Equal(100, RecitationAligner.Compare(new[] { "ٱلْعَٰلَمِينَ", "أَنْعَمْتَ" }, "العلمين انعمت").Score);
    }

    [Fact]
    public void A_skipped_word_is_reported_missing()
    {
        var r = RecitationAligner.Compare(Exp, "الحمد لله العالمين");
        Assert.Equal(WordStatus.Missing, r.Words[2].Status);
        Assert.Null(r.Words[2].Heard);
        Assert.Equal(75, r.Score);
    }

    [Fact]
    public void A_mispronounced_word_is_flagged_with_what_was_heard()
    {
        var r = RecitationAligner.Compare(Exp, "الحمد لله ربي العالمين");   // رب -> ربي: close
        Assert.Equal(WordStatus.Close, r.Words[2].Status);
        Assert.Equal("ربي", r.Words[2].Heard);
        var r2 = RecitationAligner.Compare(Exp, "الحمد لله كتاب العالمين"); // different word entirely
        Assert.Equal(WordStatus.Wrong, r2.Words[2].Status);
        Assert.True(r2.Score < r.Score);
    }

    [Fact]
    public void Extra_words_are_counted_but_do_not_break_alignment()
    {
        var r = RecitationAligner.Compare(Exp, "الحمد لله رب رب العالمين");
        Assert.Equal(1, r.ExtraWords);
        Assert.Equal(WordStatus.Correct, r.Words[3].Status);
    }

    [Fact]
    public void Silence_or_noise_scores_zero_with_every_word_missing()
    {
        var r = RecitationAligner.Compare(Exp, "hello 123");
        Assert.Equal(0, r.Score);
        Assert.All(r.Words, w => Assert.Equal(WordStatus.Missing, w.Status));
    }

    [Fact]
    public void Expected_text_is_returned_unchanged_for_display()
    {
        Assert.Equal("ٱلْعَٰلَمِينَ", RecitationAligner.Compare(Exp, "العالمين").Words[3].Expected);
    }

    [Fact]
    public void Normalize_strips_marks_and_folds_variants()
    {
        Assert.Equal(RecitationAligner.Normalize("ٱلرَّحْمَٰنِ"), RecitationAligner.Normalize("الرحمن"));
        Assert.Equal(RecitationAligner.Normalize("إِيَّاكَ"), RecitationAligner.Normalize("اياك"));
    }
}

public class RecitationApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public RecitationApiTests(ApiFactory f) { _f = f; f.InitDb().GetAwaiter().GetResult(); }

    [Fact]
    public async Task Compare_endpoint_scores_a_correct_reading_and_validates_input()
    {
        var c = _f.CreateClient();
        var ok = await c.PostAsJsonAsync("/api/v1/recitation/compare", new { ayahKey = "1:1", transcript = "الله" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var opts = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        opts.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        var r = await ok.Content.ReadFromJsonAsync<RecitationResult>(opts);
        Assert.Equal(100, r!.Score);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/recitation/compare", new { ayahKey = "bad", transcript = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/v1/recitation/compare", new { ayahKey = "1:1", transcript = "  " })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsJsonAsync("/api/v1/recitation/compare", new { ayahKey = "115:1", transcript = "x" })).StatusCode);
    }
}

public class VowelCheckTests
{
    // Al-Fatiha 1:2 as a Quran-tuned model writes it (real model output, with vowel marks)
    private static readonly string[] Exp = { "ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَٰلَمِينَ" };
    private const string Model = "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ";

    [Fact]
    public void Correct_vowelled_reading_is_fully_correct_despite_different_spelling_conventions()
    {
        var r = RecitationAligner.Compare(Exp, Model);
        Assert.True(r.VowelsChecked); Assert.Equal(100, r.Score);
        Assert.All(r.Words, w => Assert.Equal(WordStatus.Correct, w.Status));
    }

    [Fact]
    public void A_changed_vowel_is_flagged_even_though_the_letters_match()
    {
        var r = RecitationAligner.Compare(Exp, "الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ"); // damma -> fatha on the dal
        Assert.Equal(WordStatus.Vowel, r.Words[0].Status);
        Assert.Equal(WordStatus.Correct, r.Words[1].Status);
        Assert.InRange(r.Score, 90, 95);
    }

    [Fact]
    public void A_missing_shaddah_is_flagged()
    {
        Assert.Equal(WordStatus.Vowel, RecitationAligner.Compare(Exp, "الْحَمْدُ لِلَّهِ رَبِ الْعَالَمِينَ").Words[2].Status);
    }

    [Fact]
    public void Final_vowel_of_the_last_word_is_not_penalised_when_stopping()
    {
        Assert.Equal(WordStatus.Correct, RecitationAligner.Compare(Exp, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينْ").Words[3].Status);
    }

    [Fact]
    public void Transcripts_without_vowels_skip_the_vowel_check()
    {
        var r = RecitationAligner.Compare(Exp, "الحمد لله رب العالمين");
        Assert.False(r.VowelsChecked); Assert.Equal(100, r.Score);
    }

    [Theory]
    [InlineData("الْحَمْدُ", false, "a.u")]   // lam has only a sukun (ignored); ha=fatha, dal=damma
    [InlineData("الْحَمْدُ", true, "a")]      // final vowel dropped when stopping
    [InlineData("رَبِّ", false, "a.Si")]      // ra=fatha, ba=shaddah+kasra
    [InlineData("كِتَابٌ", false, "i.a.U")]   // ka=kasra, ta=fatha, ba=dammatan
    [InlineData("كِتَابٌ", true, "i.a")]
    public void Signature_extraction(string word, bool dropFinal, string expected) =>
        Assert.Equal(expected, RecitationAligner.VowelSignature(word, dropFinal));
}

public class AudioEndpointTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _f;
    public AudioEndpointTests(ApiFactory f) { _f = f; f.InitDb().GetAwaiter().GetResult(); }

    [Fact]
    public async Task Capabilities_and_check_audio_report_unavailable_when_no_model_is_running()
    {
        var c = _f.CreateClient();
        var caps = await c.GetFromJsonAsync<RecitationCapabilitiesDto>("/api/v1/recitation/capabilities");
        Assert.False(caps!.ServerAsr);
        using var form = new MultipartFormDataContent { { new StringContent("1:1"), "ayahKey" }, { new ByteArrayContent(new byte[] { 1, 2, 3 }), "file", "a.webm" } };
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await c.PostAsync("/api/v1/recitation/check-audio", form)).StatusCode);
    }
    private record RecitationCapabilitiesDto(bool ServerAsr);
}

public class FindingTests
{
    private static readonly string[] Exp = { "ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَٰلَمِينَ" };

    [Fact]
    public void Ayn_heard_as_haa_is_reported_as_that_exact_substitution()
    {
        // the real mistake from a learner: الْعَالَمِينَ read as الْحَالَمِينَ
        var w = RecitationAligner.Compare(Exp, "الْحَمْدُ لِلَّهِ رَبِّ الْحَالَمِينَ").Words[3];
        Assert.NotEqual(WordStatus.Correct, w.Status);
        Assert.Contains(w.Findings!, f => f.Type == "Substitute" && f.Expected == "ع" && f.Heard == "ح");
    }

    [Fact]
    public void Haa_heard_as_ya_plus_haa_gives_a_substitution_and_an_extra_letter()
    {
        var w = RecitationAligner.Compare(Exp, "الْحَمْدُ لِلَّيْحِ رَبِّ الْعَالَمِينَ").Words[1];
        Assert.Contains(w.Findings!, f => f.Type is "Substitute" or "Extra");
    }

    [Fact]
    public void Missing_letter_is_reported()
    {
        var f = RecitationAligner.LetterFindings("رحمن", "رحم");
        Assert.Contains(f, x => x.Type == "Missing" && x.Expected == "ن");
    }

    [Fact]
    public void Vowel_finding_names_the_letter_and_both_vowels()
    {
        var w = RecitationAligner.Compare(Exp, "الْحَمْدَ لِلَّهِ رَبِّ الْعَالَمِينَ").Words[0];
        Assert.Equal(WordStatus.Vowel, w.Status);
        var f = Assert.Single(w.Findings!);
        Assert.Equal("Vowel", f.Type); Assert.Equal("د", f.Letter); Assert.Equal("u", f.Expected); Assert.Equal("a", f.Heard);
    }

    [Fact]
    public void Correct_words_have_no_findings() =>
        Assert.All(RecitationAligner.Compare(Exp, "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ").Words, w => Assert.Null(w.Findings));
}
