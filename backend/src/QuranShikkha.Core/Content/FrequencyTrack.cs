using System.Globalization;
using System.Text;

namespace QuranShikkha.Core.Content;

/// <summary>Computes word frequencies from supplied data. No coverage number is ever hard-coded.</summary>
public static class FrequencyTrack
{
    /// <summary>Strips harakat/Quranic marks so inflection-identical forms group together (grouping key only; display text is untouched).</summary>
    public static string NormalizeKey(string arabic)
    {
        var d = arabic.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat == UnicodeCategory.NonSpacingMark || cat == UnicodeCategory.SpacingCombiningMark || c == 'ـ') continue;
            if (c == 'ٱ') { sb.Append('ا'); continue; } // alef wasla -> alef (key only)
            sb.Append(c);
        }
        return sb.ToString();
    }

    private sealed class Agg
    {
        public int Count; public WordDto Example = null!;
        public readonly Dictionary<string, int> Bn = new(), En = new();
        public static string? Top(Dictionary<string, int> d) => d.Count == 0 ? null : d.OrderByDescending(x => x.Value).ThenBy(x => x.Key, StringComparer.Ordinal).First().Key;
    }

    /// <summary>Most frequent words with their most COMMON meaning (not just the first one met), all computed from the data.</summary>
    public static FrequencyTrackDto Build(IEnumerable<AyahDto> ayahs, int size, string scope)
    {
        var counts = new Dictionary<string, Agg>();
        var total = 0;
        foreach (var a in ayahs)
            foreach (var w in a.Words)
            {
                if (w.CharType != "word") continue; // skip verse-end markers
                total++;
                var k = NormalizeKey(w.ArabicText);
                if (!counts.TryGetValue(k, out var g)) counts[k] = g = new Agg { Example = w };
                g.Count++;
                if (!string.IsNullOrWhiteSpace(w.MeaningBn)) g.Bn[w.MeaningBn!] = g.Bn.GetValueOrDefault(w.MeaningBn!) + 1;
                if (!string.IsNullOrWhiteSpace(w.MeaningEn)) g.En[w.MeaningEn!] = g.En.GetValueOrDefault(w.MeaningEn!) + 1;
            }

        var ordered = counts.OrderByDescending(kv => kv.Value.Count).ThenBy(kv => kv.Key, StringComparer.Ordinal).Take(size).ToList();
        var words = new List<FrequentWordDto>();
        var cum = 0; var rank = 1;
        foreach (var kv in ordered)
        {
            cum += kv.Value.Count;
            words.Add(new FrequentWordDto(rank++, kv.Value.Example.ArabicText, kv.Value.Count,
                total == 0 ? 0 : Math.Round(100.0 * cum / total, 2), kv.Value.Example.Key, Agg.Top(kv.Value.Bn), kv.Value.Example.AudioPath, Agg.Top(kv.Value.En)));
        }
        return new FrequencyTrackDto(total, counts.Count, words, words.Count == 0 ? 0 : words[^1].CumulativeCoveragePercent, scope);
    }
}
