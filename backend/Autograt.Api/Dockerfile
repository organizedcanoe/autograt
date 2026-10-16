FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG VERSION=0.0.0-dev
ARG COMMIT=local
WORKDIR /src
COPY Autograt.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore \
    /p:Version=$VERSION /p:InformationalVersion=$VERSION+$COMMIT

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
ARG BUILD_DATE=
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
ENV BUILD_DATE=$BUILD_DATE
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Autograt.Api.dll"]
