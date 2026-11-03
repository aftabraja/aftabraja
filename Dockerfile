# SportsIQ — one container serving the API and the web app
FROM node:22-bookworm
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN cd apps/api && npx prisma generate && npx tsc -p tsconfig.json \
 && cd ../web && npx vite build
ENV NODE_ENV=production PORT=10000 UPLOAD_DIR=/app/uploads
EXPOSE 10000
CMD ["sh", "apps/api/scripts/start.sh"]
