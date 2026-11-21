namespace QuranShikkha.Core.Recitation;

/// <summary>Turns recorded audio into Arabic text. Implementations should run on infrastructure you control (privacy).</summary>
public interface IRecitationTranscriber
{
    /// <summary>True when a transcriber is configured AND reachable right now.</summary>
    Task<bool> IsAvailableAsync(CancellationToken ct);
    Task<string> TranscribeAsync(Stream audio, string fileName, CancellationToken ct);
}
