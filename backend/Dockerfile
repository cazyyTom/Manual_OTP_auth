FROM node:20-alpine

WORKDIR /app

# Copy manifest first, install, THEN copy source — so npm install only
# re-runs when package.json actually changes, not on every source edit
COPY package*.json ./
RUN npm install

COPY . .

# Matches index.js's fallback (process.env.PORT || 8000) — keep these in sync
EXPOSE 8000


CMD ["npm", "run", "dev"]