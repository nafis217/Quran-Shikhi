# Build:  docker build -f backend/Dockerfile -t quran-shikkha-api .   (context = repo root)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/ backend/
RUN dotnet publish backend/src/QuranShikkha.Api/QuranShikkha.Api.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# Required at run time (never in the image or the repo): Jwt__Key (32+ chars), Cors__Origins__0 (the website's address),
# Database__Provider=Sqlite, ConnectionStrings__Default="Data Source=/data/app.db"  (mount a persistent disk at /data)
ENTRYPOINT ["dotnet", "QuranShikkha.Api.dll"]
