FROM node:25-alpine AS build
ARG VERSION=
ARG COMMIT=
ARG BUILD_DATE=
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN VITE_APP_VERSION=$VERSION VITE_APP_COMMIT=$COMMIT VITE_BUILD_DATE=$BUILD_DATE npm run build

FROM nginx:alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-site.conf /etc/nginx/autograt/site.conf
COPY nginx-security-headers.conf /etc/nginx/autograt/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 8080
