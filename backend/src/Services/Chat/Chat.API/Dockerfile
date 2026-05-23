FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Build.props
COPY Directory.Packages.props Directory.Packages.props
COPY src/BuildingBlocks src/BuildingBlocks
COPY src/Contracts src/Contracts
COPY src/Services/Chat src/Services/Chat
RUN dotnet restore src/Services/Chat/Connectly.Chat.Api/Connectly.Chat.Api.csproj

COPY . .
RUN dotnet publish src/Services/Chat/Connectly.Chat.Api/Connectly.Chat.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Connectly.Chat.Api.dll"]
