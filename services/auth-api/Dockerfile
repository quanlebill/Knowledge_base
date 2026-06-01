FROM python:3.12-alpine

WORKDIR /app

RUN apk add --no-cache gcc musl-dev libpq-dev curl

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8200

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8200"]
