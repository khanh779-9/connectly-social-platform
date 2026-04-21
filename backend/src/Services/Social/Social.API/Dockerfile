FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Build.props
COPY Directory.Packages.props Directory.Packages.props
COPY src/BuildingBlocks src/BuildingBlocks
COPY src/Contracts src/Contracts
COPY src/Services/Social src/Services/Social
RUN dotnet restore src/Services/Social/Connectly.Social.Api/Connectly.Social.Api.csproj

COPY . .
RUN dotnet publish src/Services/Social/Connectly.Social.Api/Connectly.Social.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Connectly.Social.Api.dll"]
