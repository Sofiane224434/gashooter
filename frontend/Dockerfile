# Etape 1 : Build de l'application Vite / React
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Etape 2 : Serveur Nginx Alpine
FROM nginx:alpine

# Copie des fichiers compilés
COPY --from=build /app/dist /usr/share/nginx/html

# Configuration Nginx avec proxy /api interne
COPY deploy/nginx/site.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
