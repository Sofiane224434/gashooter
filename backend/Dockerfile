FROM node:22-alpine

WORKDIR /app

# Copie des manifests de dépendances
COPY package*.json ./

# Installation des dépendances de production
RUN npm install --omit=dev

# Copie des sources
COPY . .

# Port applicatif Express
EXPOSE 5000

# Démarrage
CMD ["node", "server.js"]
