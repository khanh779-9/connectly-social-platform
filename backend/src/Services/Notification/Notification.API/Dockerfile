FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Build.props
COPY Directory.Packages.props Directory.Packages.props
COPY src/BuildingBlocks src/BuildingBlocks
COPY src/Contracts src/Contracts
COPY src/Services/Notification src/Services/Notification
RUN dotnet restore src/Services/Notification/Connectly.Notification.Api/Connectly.Notification.Api.csproj

COPY . .
RUN dotnet publish src/Services/Notification/Connectly.Notification.Api/Connectly.Notification.Api.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Connectly.Notification.Api.dll"]
