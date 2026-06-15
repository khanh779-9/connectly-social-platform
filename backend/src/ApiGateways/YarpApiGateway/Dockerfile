FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props Directory.Build.props
COPY Directory.Packages.props Directory.Packages.props
COPY src/Gateway src/Gateway
RUN dotnet restore src/Gateway/Connectly.Gateway/Connectly.Gateway.csproj

COPY . .
RUN dotnet publish src/Gateway/Connectly.Gateway/Connectly.Gateway.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Connectly.Gateway.dll"]
