# ---------------------------
#   STAGE 1 : Build Angular
# ---------------------------
FROM node:20 AS build

WORKDIR /app

# Copie uniquement les fichiers de dépendances pour profiter du cache
COPY package*.json ./

# Installation des dépendances (reproductible et rapide)
RUN npm ci --legacy-peer-deps

# Copie du reste du code
COPY . .

# Build Angular en mode production
RUN npm run build -- --configuration production

# ---------------------------
#   STAGE 2 : Run Nginx
# ---------------------------
FROM nginx:alpine

# Supprime la config par défaut et le contenu HTML par défaut
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/*

# Copie de la configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copie du build Angular depuis le stage précédent
COPY --from=build /app/dist/movie-ui/browser /usr/share/nginx/html/

# Expose le port 80 pour le serveur
EXPOSE 80

# Commande par défaut pour lancer Nginx
CMD ["nginx", "-g", "daemon off;"]
