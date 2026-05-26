FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ENV VITE_MOCK_AUTH=true

EXPOSE 3000
EXPOSE 8000

# FastAPI mock API on 8000, Vite dev server on 3000
CMD ["sh", "-c", "uvicorn testing.server:app --host 0.0.0.0 --port 8000 & npm run dev"]
