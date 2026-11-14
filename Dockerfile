FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api-build
WORKDIR /src
COPY backend/ backend/
RUN dotnet publish backend/LunarNavigator.Api/LunarNavigator.Api.csproj -c Release -o /out
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS api
WORKDIR /app
COPY --from=api-build /out .
ENV ASPNETCORE_URLS=http://+:8080
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "LunarNavigator.Api.dll"]
FROM node:22-alpine AS web-build
WORKDIR /src/frontend
COPY contracts/ /src/contracts/
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM nginx:stable-alpine AS web
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /src/frontend/dist /usr/share/nginx/html
EXPOSE 80
