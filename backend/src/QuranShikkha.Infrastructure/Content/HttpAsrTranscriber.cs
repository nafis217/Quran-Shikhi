using Microsoft.Extensions.Options;
using QuranShikkha.Core.Recitation;

namespace QuranShikkha.Infrastructure.Content;

public class AsrOptions
{
    public const string Section = "Asr";
    /// <summary>Base URL of services/asr (e.g. http://127.0.0.1:8001). Empty = disabled.</summary>
    public string Url { get; set; } = "";
}

/// <summary>Talks to the local Python service in services/asr. Audio goes only to the URL you configure.</summary>
public sealed class HttpAsrTranscriber(IHttpClientFactory http, IOptions<AsrOptions> opts) : IRecitationTranscriber
{
    public const string ClientName = "asr";

    public async Task<bool> IsAvailableAsync(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(opts.Value.Url)) return false;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct); cts.CancelAfter(TimeSpan.FromSeconds(1.5));
            using var r = await http.CreateClient(ClientName).GetAsync(opts.Value.Url.TrimEnd('/') + "/health", cts.Token);
            return r.IsSuccessStatusCode;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { return false; }
    }

    public async Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent { { new StreamContent(audio), "file", string.IsNullOrEmpty(fileName) ? "audio" : fileName } };
        using var r = await http.CreateClient(ClientName).PostAsync(opts.Value.Url.TrimEnd('/') + "/transcribe", form, ct);
        r.EnsureSuccessStatusCode();
        using var doc = System.Text.Json.JsonDocument.Parse(await r.Content.ReadAsStringAsync(ct));
        return doc.RootElement.GetProperty("text").GetString() ?? "";
    }
}
