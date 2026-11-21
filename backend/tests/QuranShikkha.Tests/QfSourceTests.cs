using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using QuranShikkha.Infrastructure.Content;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Tests;

public class QfSourceTests
{
    private sealed class FakeQf(Func<string, string> f) : IQfClient
    {
        public Task<string> GetJsonAsync(string p, CancellationToken ct) => Task.FromResult(f(p));
    }

    [Fact]
    public async Task Parses_words_and_paginates()
    {
        string Page(int p) => "{\"verses\":[{\"verse_key\":\"1:" + p + "\",\"words\":[{\"position\":1,\"char_type_name\":\"word\",\"text_uthmani\":\"أ\",\"audio_url\":\"wbw/001_00" + p + "_001.mp3\",\"translation\":{\"text\":\"m\"}},{\"position\":2,\"char_type_name\":\"end\",\"text_uthmani\":\"١\"}]}],\"pagination\":{\"next_page\":" + (p == 1 ? "2" : "null") + "}}";
        var src = new QfContentSource(new FakeQf(p => Page(p.Contains("page=2") ? 2 : 1)), Options.Create(new QfOptions()), NullLogger<QfContentSource>.Instance);
        var ayahs = await src.GetAyahsAsync(1, default);
        Assert.Equal(2, ayahs.Count);
        Assert.Equal("wbw/001_001_001.mp3", ayahs[0].Words[0].AudioPath);
        Assert.Equal("end", ayahs[0].Words[1].CharType);
        Assert.Equal("1:1:1", ayahs[0].Words[0].Key);
    }

    [Fact]
    public async Task Tafsir_falls_through_empty_ids_flags_placeholders_and_keeps_text_verbatim()
    {
        const string text = "ব্যাখ্যা (আরবি) শেষ";
        var src = new QfContentSource(new FakeQf(p =>
            p.Contains("/tafsirs/164/") ? """{"tafsir":{"text":""}}""" :
            p.Contains("/tafsirs/165/") ? "{\"tafsir\":{\"resource_name\":\"R\",\"text\":\"" + text + "\"}}" :
            p.Contains("/recitations/") ? """{"audio_files":[{"url":"Alafasy/mp3/001001.mp3"}]}""" : throw new HttpRequestException("x")),
            Options.Create(new QfOptions { AudioHost = "https://audio.qurancdn.com/" }), NullLogger<QfContentSource>.Instance);
        var d = await src.GetDetailsAsync(1, 1, default);
        Assert.Equal(165, d.TafsirBn!.ResourceId);
        Assert.True(d.TafsirBn.HasPlaceholder);
        Assert.Equal(text, d.TafsirBn.Text);
        Assert.StartsWith("https://audio.qurancdn.com/", d.AudioUrl);
    }
}
