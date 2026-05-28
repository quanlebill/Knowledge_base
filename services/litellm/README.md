# LiteLLM Gateway

LLM proxy gateway. Aliases `planner` và `responder` map sang Claude API hiện tại.
Khi có GPU: đổi `model:` trong `config.yaml` sang vLLM endpoint, không sửa code.

## Khởi động

```bash
pip install "litellm[proxy]"

# Đảm bảo root .env đã được load vào shell (có LLM_API_KEY)
litellm --config config.yaml --port 4000
```

## Verify

```bash
# Health check
curl http://localhost:4000/health

# Test responder
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer sk-dev" \
  -H "Content-Type: application/json" \
  -d '{"model":"responder","messages":[{"role":"user","content":"hello"}]}'
```

## Swap sang vLLM (khi có GPU)

```yaml
# config.yaml
- model_name: planner
  litellm_params:
    model: openai/Qwen3-9B        # vLLM dùng openai-compatible API
    api_base: http://vllm-host:8000
    api_key: none
```
