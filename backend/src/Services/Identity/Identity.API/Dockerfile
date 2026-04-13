FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# restore first for layer caching
COPY Directory.Build.props Directory.Build.props
COPY Directory.Packages.props Directory.Packages.props
COPY src/BuildingBlocks src/BuildingBlocks
COPY src/Contracts src/Contracts
COPY src/Services/Identity src/Services/Identity
RUN dotnet restore src/Services/Identity/Connectly.Identity.Api/Connectly.Identity.Api.csproj

COPY . .
RUN dotnet publish src/Services/Identity/Connectly.Identity.Api/Connectly.Identity.Api.csproj -c Release -o /app /p:UseSourceGeneratedOpenApi=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Connectly.Identity.Api.dll"]
