# ---------------------------
#   STAGE 1 : Build Angular
# ---------------------------
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build -- --configuration production


# ---------------------------
#   STAGE 2 : Run Nginx
# ---------------------------
FROM nginx:alpine

# Supprime la config par défaut
RUN rm -rf /usr/share/nginx/html/* && \
    rm -rf /etc/nginx/conf.d/*

# Copie ta config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie le build Angular
COPY --from=build /app/dist/movie-ui/browser /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
