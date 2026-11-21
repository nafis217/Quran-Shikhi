using QuranShikkha.Core.Content;
using QuranShikkha.Core.Srs;
using QuranShikkha.Core.Text;

namespace QuranShikkha.Tests;

public class Sm2Tests
{
    [Fact]
    public void First_second_third_successes_follow_1_6_then_ease_multiple()
    {
        var s = new Sm2.State(2.5, 0, 0);
        s = Sm2.Next(s, 5); Assert.Equal(1, s.IntervalDays);
        s = Sm2.Next(s, 5); Assert.Equal(6, s.IntervalDays);
        s = Sm2.Next(s, 5); Assert.True(s.IntervalDays >= 15);
    }

    [Fact]
    public void Failure_resets_repetitions_and_lowers_ease_but_not_below_floor()
    {
        var s = new Sm2.State(1.35, 20, 5);
        s = Sm2.Next(s, 1);
        Assert.Equal(0, s.Repetitions); Assert.Equal(1, s.IntervalDays); Assert.Equal(1.3, s.Ease);
    }

    [Theory] [InlineData(-1)] [InlineData(6)]
    public void Rejects_bad_quality(int q) => Assert.Throws<ArgumentOutOfRangeException>(() => Sm2.Next(new(2.5, 0, 0), q));
}

public class TafsirPlaceholderTests
{
    [Fact] public void Detects_marker() => Assert.True(TafsirPlaceholder.Detect("আল্লাহ বলেন, (আরবি) এর অর্থ"));
    [Fact] public void Clean_text_is_not_flagged() => Assert.False(TafsirPlaceholder.Detect("সাধারণ লেখা"));
    [Fact] public void Null_is_safe() => Assert.False(TafsirPlaceholder.Detect(null));
}

public class FrequencyTrackTests
{
    private static WordDto W(string key, string ar, string type = "word") => new(key, 1, ar, null, null, null, null, type);

    [Fact]
    public void Counts_group_by_unvoweled_form_and_coverage_is_computed()
    {
        var ayahs = new[]
        {
            new AyahDto("1:1", 1, 1, new[] { W("1:1:1", "ٱللَّهِ"), W("1:1:2", "رَبِّ"), W("1:1:3", "١", "end") }),
            new AyahDto("1:2", 1, 2, new[] { W("1:2:1", "ٱللَّهَ"), W("1:2:2", "رَبَّ"), W("1:2:3", "نُورٌ") }),
        };
        var t = FrequencyTrack.Build(ayahs, 10, "test");
        Assert.Equal(5, t.TotalWordTokens);               // end marker excluded
        Assert.Equal(3, t.DistinctWords);
        Assert.Equal(2, t.Words[0].Count);
        Assert.Equal(80.0, t.Words[1].CumulativeCoveragePercent); // (2+2)/5
        Assert.Equal(100.0, t.CoveragePercent);
    }

    [Fact]
    public void Each_word_gets_its_most_common_meaning_in_both_languages()
    {
        WordDto M(string key, string bn, string en) => new(key, 1, "رَبِّ", null, bn, en, null, "word");
        var t = FrequencyTrack.Build(new[] { new AyahDto("1:1", 1, 1, new[] { M("1:1:1", "প্রতিপালকের", "of the Lord"), M("1:1:2", "রব", "Lord"), M("1:1:3", "রব", "Lord") }) }, 5, "t");
        Assert.Equal("রব", t.Words[0].MeaningBn); Assert.Equal("Lord", t.Words[0].MeaningEn);
    }

    [Fact]
    public void Display_text_is_never_altered_only_the_grouping_key()
    {
        var t = FrequencyTrack.Build(new[] { new AyahDto("1:1", 1, 1, new[] { W("1:1:1", "ٱللَّهِ") }) }, 5, "t");
        Assert.Equal("ٱللَّهِ", t.Words[0].ArabicText);
    }

    [Fact]
    public void Empty_input_gives_zero_coverage_not_a_crash() =>
        Assert.Equal(0, FrequencyTrack.Build(Array.Empty<AyahDto>(), 300, "t").CoveragePercent);

    [Fact] public void Cache_ttl_is_clamped_to_one_week() =>
        Assert.Equal(TimeSpan.FromDays(7), CachePolicy.Clamp(TimeSpan.FromDays(30)));
}
