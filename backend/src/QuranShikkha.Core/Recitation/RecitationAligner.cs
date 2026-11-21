using System.Globalization;
using System.Text;

namespace QuranShikkha.Core.Recitation;

public enum WordStatus { Correct, Vowel, Close, Wrong, Missing }

/// <summary>
/// One specific difference inside a word. Type: "Substitute" (heard Heard instead of Expected), "Missing" (Expected letter not heard),
/// "Extra" (Heard letter added), "Vowel" (on Letter, vowel marks Expected were read as Heard; codes a u i A U I S = fatha damma kasra
/// fathatan dammatan kasratan shaddah). Index is the letter position in the folded word.
/// </summary>
public record Finding(string Type, string? Expected, string? Heard, string? Letter, int Index);
public record WordCheck(int Position, string Expected, string? Heard, WordStatus Status, double Similarity, IReadOnlyList<Finding>? Findings = null);
public record RecitationResult(int Score, IReadOnlyList<WordCheck> Words, int ExtraWords, bool VowelsChecked = false);

/// <summary>
/// Compares what a speech recognizer heard with the expected ayah, word by word.
/// LIMITS (by design, stated in the UI): it compares the consonant skeleton only. Speech-to-text output usually has no
/// vowel marks, so it can find skipped, extra and wrong words, but NOT vowel (harakat) or Tajweed mistakes such as madd
/// length, ghunna or qalqalah. Those need a Tajweed-aware model and a qualified teacher.
/// </summary>
public static class RecitationAligner
{
    public const double CorrectAt = 0.99, CloseAt = 0.6, VowelCredit = 0.7;
    private const double VowelledShare = 0.4;

    private static char? VowelCode(char c) => c switch
    {
        '\u064E' => 'a', '\u064F' => 'u', '\u0650' => 'i', '\u064B' => 'A', '\u064C' => 'U', '\u064D' => 'I', '\u0651' => 'S', _ => null,
    };
    private static bool IsLetter(char c) => c is >= '\u0621' and <= '\u064A' or '\u0671';

    /// <summary>
    /// Short-vowel / tanween / shaddah signature of a word, one token per marked letter. Sukun, dagger alef, madd and waqf marks are
    /// ignored because Uthmani text and recognizers spell them differently. If <paramref name="dropFinal"/> the last marked letter is
    /// ignored (the final vowel is lost when stopping at the end of an ayah).
    /// </summary>
    public static List<(char Letter, string Marks)> VowelTokens(string word, bool dropFinal)
    {
        var tokens = new List<(char, string)>(); var cur = new StringBuilder(); char curLetter = ' '; var letters = 0; var lastLetter = -1; var tokenLetterNo = new List<int>();
        void flush() { if (cur.Length > 0) { tokens.Add((curLetter, new string(cur.ToString().OrderBy(x => x).ToArray()))); tokenLetterNo.Add(letters); cur.Clear(); } }
        foreach (var c in word)
        {
            if (IsLetter(c)) { flush(); letters++; lastLetter = letters; curLetter = c; }
            else if (VowelCode(c) is { } v) cur.Append(v);
        }
        flush();
        if (dropFinal && tokens.Count > 0 && tokenLetterNo[^1] == lastLetter) tokens.RemoveAt(tokens.Count - 1);
        return tokens;
    }

    public static string VowelSignature(string word, bool dropFinal) => string.Join('.', VowelTokens(word, dropFinal).Select(t => t.Marks));

    /// <summary>The first place where the vowel marks differ, as a finding (null when they are the same).</summary>
    public static Finding? VowelFinding(string expectedWord, string heardWord, bool dropFinal)
    {
        var e = VowelTokens(expectedWord, dropFinal); var h = VowelTokens(heardWord, dropFinal);
        for (var i = 0; i < Math.Max(e.Count, h.Count); i++)
        {
            var em = i < e.Count ? e[i].Marks : ""; var hm = i < h.Count ? h[i].Marks : "";
            if (em != hm) return new Finding("Vowel", em, hm, (i < e.Count ? e[i].Letter : h[i].Letter).ToString(), i);
        }
        return null;
    }

    /// <summary>Letter-level differences between two folded words (substitutions, missing and extra letters), at most 3.</summary>
    public static List<Finding> LetterFindings(string expected, string heard)
    {
        int n = expected.Length, m = heard.Length;
        var d = new int[n + 1, m + 1];
        for (var i = 0; i <= n; i++) d[i, 0] = i;
        for (var j = 0; j <= m; j++) d[0, j] = j;
        for (var i = 1; i <= n; i++)
            for (var j = 1; j <= m; j++)
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + (expected[i - 1] == heard[j - 1] ? 0 : 1));
        var found = new List<Finding>();
        for (int i = n, j = m; i > 0 || j > 0;)
        {
            if (i > 0 && j > 0 && d[i, j] == d[i - 1, j - 1] + (expected[i - 1] == heard[j - 1] ? 0 : 1))
            {
                if (expected[i - 1] != heard[j - 1]) found.Add(new Finding("Substitute", expected[i - 1].ToString(), heard[j - 1].ToString(), null, i - 1));
                i--; j--;
            }
            else if (i > 0 && d[i, j] == d[i - 1, j] + 1) { found.Add(new Finding("Missing", expected[i - 1].ToString(), null, null, i - 1)); i--; }
            else { found.Add(new Finding("Extra", null, heard[j - 1].ToString(), null, Math.Max(0, i - 1))); j--; }
        }
        found.Reverse();
        return found.Take(3).ToList();
    }

    /// <summary>True when the transcript carries vowel marks (a Quran-tuned model does; the browser's recognizer does not).</summary>
    public static bool HasVowels(string transcript)
    {
        int letters = 0, marked = 0; var seen = false;
        foreach (var c in transcript)
        {
            if (IsLetter(c)) { letters++; seen = false; }
            else if (VowelCode(c) is not null && !seen) { marked++; seen = true; }
        }
        return letters >= 3 && (double)marked / letters >= VowelledShare;
    }

    /// <summary>Strips marks and folds letter variants that recognizers write inconsistently. Display text is never changed.</summary>
    public static string Normalize(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var c0 in s.Normalize(NormalizationForm.FormD))
        {
            if (c0 == '\u0670') { sb.Append('ا'); continue; } // dagger alef = a written long alef
            var cat = CharUnicodeInfo.GetUnicodeCategory(c0);
            if (cat is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.Format) continue;
            var c = c0 switch
            {
                'أ' or 'إ' or 'آ' or 'ٱ' => 'ا',
                'ى' => 'ي', 'ة' => 'ه', 'ؤ' => 'و', 'ئ' => 'ي', 'ک' => 'ك', 'ی' => 'ي',
                _ => c0,
            };
            if (c == 'ء' || c == 'ـ') continue;                     // hamza and tatweel are often dropped by recognizers
            if (c is >= 'ء' and <= 'ي' or 'ٱ') sb.Append(c); // keep Arabic letters only
        }
        // Alef spelling differs between Uthmani text, dagger alef and recognizer output, so only a word-initial alef is kept.
        var t = sb.ToString();
        return t.Length <= 1 ? t : t[0] + t[1..].Replace("ا", "");
    }

    public static double Similarity(string a, string b)
    {
        if (a.Length == 0 && b.Length == 0) return 1;
        var d = Levenshtein(a, b);
        return 1.0 - (double)d / Math.Max(a.Length, b.Length);
    }

    private static int Levenshtein(string a, string b)
    {
        var prev = new int[b.Length + 1]; var cur = new int[b.Length + 1];
        for (var j = 0; j <= b.Length; j++) prev[j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            for (var j = 1; j <= b.Length; j++)
                cur[j] = Math.Min(Math.Min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
            (prev, cur) = (cur, prev);
        }
        return prev[b.Length];
    }

    public static RecitationResult Compare(IReadOnlyList<string> expected, string transcript)
    {
        var heard = transcript.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Where(w => Normalize(w).Length > 0).ToArray();
        var exp = expected.Select(Normalize).ToArray();
        var hn = heard.Select(Normalize).ToArray();
        int n = exp.Length, m = hn.Length;

        // Needleman–Wunsch on words: substitution cost = 1 - similarity, gap cost = 1.
        var dp = new double[n + 1, m + 1];
        for (var i = 1; i <= n; i++) dp[i, 0] = i;
        for (var j = 1; j <= m; j++) dp[0, j] = j;
        for (var i = 1; i <= n; i++)
            for (var j = 1; j <= m; j++)
                dp[i, j] = Math.Min(dp[i - 1, j - 1] + (1 - Similarity(exp[i - 1], hn[j - 1])), Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1));

        var align = new int[n]; Array.Fill(align, -1);
        for (int i = n, j = m; i > 0 || j > 0;)
        {
            if (i > 0 && j > 0 && Math.Abs(dp[i, j] - (dp[i - 1, j - 1] + (1 - Similarity(exp[i - 1], hn[j - 1])))) < 1e-9) { align[i - 1] = j - 1; i--; j--; }
            else if (i > 0 && Math.Abs(dp[i, j] - (dp[i - 1, j] + 1)) < 1e-9) i--;
            else j--;
        }

        var vowels = HasVowels(transcript);
        var words = new List<WordCheck>();
        double credit = 0; var used = 0;
        for (var i = 0; i < n; i++)
        {
            if (align[i] < 0) { words.Add(new WordCheck(i + 1, expected[i], null, WordStatus.Missing, 0)); continue; }
            used++;
            var sim = Similarity(exp[i], hn[align[i]]);
            var status = sim >= CorrectAt ? WordStatus.Correct : sim >= CloseAt ? WordStatus.Close : WordStatus.Wrong;
            List<Finding>? findings = null;
            if (status == WordStatus.Correct && vowels && VowelSignature(expected[i], i == n - 1) != VowelSignature(heard[align[i]], i == n - 1))
            {
                status = WordStatus.Vowel;
                if (VowelFinding(expected[i], heard[align[i]], i == n - 1) is { } vf) findings = new() { vf };
            }
            else if (status is WordStatus.Close or WordStatus.Wrong) findings = LetterFindings(exp[i], hn[align[i]]);
            credit += status == WordStatus.Wrong ? 0 : status == WordStatus.Vowel ? VowelCredit : sim;
            words.Add(new WordCheck(i + 1, expected[i], heard[align[i]], status, Math.Round(sim, 2), findings));
        }
        return new RecitationResult(n == 0 ? 0 : (int)Math.Round(100 * credit / n), words, Math.Max(0, m - used), vowels);
    }
}
