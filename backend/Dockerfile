# syntax=docker/dockerfile:1

# ---------- build: restore once, then compile ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1

# Restore first so the package layer is cached between code changes.
COPY Admission.sln ./
COPY src/Admission.Api/Admission.Api.csproj src/Admission.Api/
COPY tests/Admission.Api.Tests/Admission.Api.Tests.csproj tests/Admission.Api.Tests/
RUN dotnet restore Admission.sln

COPY . .
RUN dotnet build Admission.sln -c Release --no-restore \
 && dotnet publish src/Admission.Api/Admission.Api.csproj -c Release --no-build -o /app/publish /p:UseAppHost=false

# ---------- test: `docker compose --profile test run --rm tests` ----------
FROM build AS test
ENTRYPOINT ["dotnet", "test", "Admission.sln", "-c", "Release", "--no-build", "--logger", "console;verbosity=normal"]

# ---------- runtime: small image, non-root user ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0
COPY --from=build /app/publish .
# The .NET 8 images ship a non-root "app" user (uid 1654).
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Admission.Api.dll"]
