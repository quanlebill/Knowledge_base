FROM node:20-alpine

WORKDIR /app

ENV GEMINI_API_KEY=bypass
ENV VITE_MOCK_AUTH=true

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000
EXPOSE 4000

# Start both servers: mock API on 4000, Vite on 3000
CMD ["sh", "-c", "node testing/server.js & npm run dev"]
