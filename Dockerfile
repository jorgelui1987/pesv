# ============================================
# PESV Integral - Dockerfile
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copiar package.json y package-lock.json primero para aprovechar caché
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar el código fuente
COPY . .

# Exponer el puerto de la aplicación
EXPOSE 3000

# Variables de entorno por defecto (se sobreescriben en docker-compose)
ENV NODE_ENV=production
ENV PORT=3000

# Iniciar la aplicación
CMD ["node", "server.js"]