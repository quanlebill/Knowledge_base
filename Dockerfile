FROM node:20-slim

WORKDIR /app

COPY server/requirements.txt ./server/requirements.txt
RUN apt-get update && apt-get install -y python3 python3-pip \
    && pip3 install --break-system-packages -r server/requirements.txt

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV VITE_MOCK_AUTH=true

EXPOSE 3000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn testing.server:app --host 0.0.0.0 --port 8000 & npm run dev"]
