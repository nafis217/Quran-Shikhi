namespace QuranShikkha.Core.Text;

/// <summary>Detects "(আরবি)" placeholders in Bengali tafsir text. Never modifies the text.</summary>
public static class TafsirPlaceholder
{
    private static readonly string[] Markers = { "(আরবি)", "（আরবি）", "[আরবি]" };

    public static bool Detect(string? text) =>
        !string.IsNullOrEmpty(text) && Markers.Any(m => text.Contains(m, StringComparison.Ordinal));
}
