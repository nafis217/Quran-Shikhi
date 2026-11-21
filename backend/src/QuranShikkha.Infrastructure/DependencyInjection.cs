using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuranShikkha.Core.Content;
using QuranShikkha.Infrastructure.Content;
using QuranShikkha.Infrastructure.Data;
using QuranShikkha.Infrastructure.Qf;

namespace QuranShikkha.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection s, IConfiguration cfg, Action<DbContextOptionsBuilder>? db = null)
    {
        s.Configure<QfOptions>(cfg.GetSection(QfOptions.Section));
        s.Configure<QuranEncOptions>(cfg.GetSection(QuranEncOptions.Section));
        s.Configure<AsrOptions>(cfg.GetSection(AsrOptions.Section));
        s.AddHttpClient(NewsService.ClientName, c => { c.Timeout = TimeSpan.FromSeconds(12); c.DefaultRequestHeaders.UserAgent.ParseAdd("QuranShikkha/0.1 (learning app; headlines only)"); }).AddHttpMessageHandler(() => new RetryHandler(1));
        s.AddSingleton<NewsService>();
        s.AddHttpClient(HttpAsrTranscriber.ClientName, c => c.Timeout = TimeSpan.FromSeconds(120));
        s.AddScoped<QuranShikkha.Core.Recitation.IRecitationTranscriber, HttpAsrTranscriber>();
        s.AddDbContext<AppDbContext>(db ?? (o =>
        {
            // "Sqlite" is for local development only (no SQL Server needed). Production uses SQL Server + migrations.
            if (string.Equals(cfg["Database:Provider"], "Sqlite", StringComparison.OrdinalIgnoreCase))
                o.UseSqlite(cfg.GetConnectionString("Default") ?? "Data Source=dev.db");
            else o.UseSqlServer(cfg.GetConnectionString("Default"));
        }));
        s.AddSingleton(TimeProvider.System);

        s.AddHttpClient(QfTokenProvider.ClientName).AddHttpMessageHandler(() => new RetryHandler());
        s.AddHttpClient(QfClient.ClientName).AddHttpMessageHandler(() => new RetryHandler());
        s.AddHttpClient(QuranEncClient.ClientName, (sp, c) =>
            c.BaseAddress = new Uri(cfg.GetSection(QuranEncOptions.Section)["BaseUrl"] ?? new QuranEncOptions().BaseUrl)).AddHttpMessageHandler(() => new RetryHandler(2));
        s.AddHttpClient(DevAlQuranCloudSource.PublicQuranClient, c => c.BaseAddress = new Uri("https://api.qurancdn.com/api/qdc/")).AddHttpMessageHandler(() => new RetryHandler(2));
        s.AddHttpClient(DevAlQuranCloudSource.TafsirClient, c => { c.BaseAddress = new Uri("https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/"); c.Timeout = TimeSpan.FromSeconds(60); }).AddHttpMessageHandler(() => new RetryHandler(2));
        s.AddHttpClient(DevAlQuranCloudSource.ClientName, c => c.BaseAddress = new Uri("https://api.alquran.cloud/v1/")).AddHttpMessageHandler(() => new RetryHandler(2));

        s.AddSingleton<IQfTokenProvider, QfTokenProvider>();
        s.AddScoped<ICacheStore, SqlCacheStore>();
        s.AddScoped<IQfClient, QfClient>();
        s.AddScoped<QfContentSource>();
        s.AddScoped<DevAlQuranCloudSource>();
        s.AddScoped<QuranEncClient>();
        // Real QF when credentials exist; otherwise the dev-only prototype source.
        s.AddScoped<IContentSource>(sp =>
            sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<QfOptions>>().Value.Configured
                ? sp.GetRequiredService<QfContentSource>()
                : sp.GetRequiredService<DevAlQuranCloudSource>());
        s.AddScoped<IContentService, ContentService>();
        s.AddHostedService<PurgeService>();
        s.AddHostedService<WarmupService>();
        return s;
    }
}
