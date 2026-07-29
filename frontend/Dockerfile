FROM node:20-alpine

WORKDIR /app

# Same reasoning as your backend Dockerfile — copy manifest first so
# npm install only reruns when package.json actually changes
COPY package*.json ./
RUN npm install

COPY . .

# Vite's default dev-server port
EXPOSE 5173

# --host is required — without it Vite binds to localhost INSIDE the
# container, which is unreachable from your browser on the host
CMD ["npm", "run", "dev", "--", "--host"]