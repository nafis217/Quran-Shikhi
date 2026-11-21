namespace QuranShikkha.Infrastructure.Qf;

public class QfOptions
{
    public const string Section = "Qf";
    /// <summary>"prelive" or "production". Tokens are NOT interchangeable, so cache keys and tokens are per environment.</summary>
    public string Environment { get; set; } = "prelive";
    public string AuthBase { get; set; } = "";   // set from env; confirm host in QF docs
    public string ApiBase { get; set; } = "";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string Scope { get; set; } = "content";
    public int RecitationId { get; set; } = 7;
    public string ReciterName { get; set; } = "";   // shown in credits; must match the recitation id
    public int? TranslationEnId { get; set; }
    public int[] TafsirBnIds { get; set; } = { 164, 165, 381 };
    public int CacheDays { get; set; } = 7;
    public string AudioHost { get; set; } = "https://audio.qurancdn.com/";
    public bool Configured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret)
                              && !string.IsNullOrWhiteSpace(AuthBase) && !string.IsNullOrWhiteSpace(ApiBase);
}

public class QuranEncOptions
{
    public const string Section = "QuranEnc";
    public string Key { get; set; } = "bengali_zakaria";
    public string BaseUrl { get; set; } = "https://quranenc.com/api/v1/";
    /// <summary>Version string to display next to the source. Must be confirmed from QuranEnc.</summary>
    public string Version { get; set; } = "";
}
