# Running the KB UI Testing Stack on a VM

This guide explains how to move the `kb-ui-testing` Docker stack from your
local Windows machine onto a Linux VM so you get more RAM and stable
CPU headroom for the local Llama model.

The stack defined in [`infra/docker-compose.kb-ui-testing.yml`](../infra/docker-compose.kb-ui-testing.yml)
bundles every dependency the Knowledge Base UI needs: Postgres, Mongo, Qdrant,
Neo4j, MinIO, Kafka, the embedding/rerank model service, the Llama CPU
service, LiteLLM, the backend API, and the ingestion worker.

---

## 1. VM sizing

The compose file pins resource limits per service. Peak ceilings sum to roughly
**~20 vCPU and ~27 GiB RAM**, but limits are not reservations — Docker will
overcommit safely.

| Tier | vCPU | RAM | Disk | Notes |
|------|------|-----|------|-------|
| **Minimum** | 8 | 24 GiB | 80 GiB SSD | Works; Llama is slow under load. |
| **Recommended** | 12 | 32 GiB | 120 GiB SSD | Smooth UI + ingestion. |
| **Comfortable** | 16 | 48 GiB | 200 GiB SSD | Headroom for bigger GGUF weights. |

Per-service ceilings (from the compose file):

| Service | CPU limit | Memory limit |
|---------|----------:|-------------:|
| postgres | 1.0 | 1 GiB |
| mongo | 1.0 | 1 GiB |
| qdrant | 2.0 | 2 GiB |
| neo4j | 1.5 | 1.5 GiB |
| minio | 1.0 | 512 MiB |
| minio-init | 0.25 | 128 MiB |
| kafka | 2.0 | 2 GiB |
| **llama** | **6.0** | **12 GiB** |
| litellm | 0.5 | 512 MiB |
| model-service | 2.0 | 3 GiB |
| kb-backend | 1.5 | 1 GiB |
| kb-ingestion-worker | 2.0 | 2 GiB |

Llama dominates: an 8B q4-quantised GGUF needs ~6–8 GiB plus KV-cache. If you
want to run a bigger or higher-quality quant, raise the `llama` memory limit
before bringing the stack up.

### Cloud picks

- **AWS**: `m6i.4xlarge` (16 vCPU / 64 GiB) or `m7i.2xlarge` (8 vCPU / 32 GiB).
- **GCP**: `n2-standard-16` or `n2-highmem-8`.
- **Azure**: `Standard_D8s_v5` (8 vCPU / 32 GiB) or `Standard_D16s_v5`.
- **Hetzner / DigitalOcean / Linode**: any "dedicated CPU 8/32" tier.

Use Ubuntu 22.04 LTS or Debian 12 — Docker base images match and you avoid
glibc surprises with `llama-cpp-python`.

---

## 2. VM prerequisites

SSH in as a sudoer (e.g. `ubuntu`) and run:

```bash
# Base tools
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git unzip

# Docker Engine + Compose plugin (official Docker repo)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your user talk to Docker without sudo (log out and back in afterwards)
sudo usermod -aG docker $USER
```

Recommended kernel tuning for Kafka + Neo4j + Qdrant on a long-lived host:

```bash
sudo tee /etc/sysctl.d/99-kb-stack.conf <<'EOF'
vm.max_map_count=262144
vm.swappiness=1
fs.file-max=1048576
EOF
sudo sysctl --system
```

Make sure swap exists (Llama benefits from a small swap as a safety net,
even though everything should fit in RAM):

```bash
sudo fallocate -l 8G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Get the code and the model weights onto the VM

### Option A — clone from git

```bash
git clone <your-repo-url> Data-Agent-UI-KB
cd Data-Agent-UI-KB
git checkout backend-services   # or whichever branch you want to deploy
```

### Option B — rsync from your laptop

From your laptop (PowerShell or WSL):

```bash
rsync -avh --progress \
  --exclude node_modules --exclude .venv --exclude __pycache__ \
  --exclude dist --exclude '*.gguf' \
  D:/Personals/Data-Agent-UI-KB/ \
  ubuntu@<vm-ip>:/home/ubuntu/Data-Agent-UI-KB/
```

### Copy the GGUF weights (do this separately — they're large)

```bash
# From your laptop
scp D:/Personals/Data-Agent-UI-KB/model/ollama/weights/model.gguf \
    ubuntu@<vm-ip>:/home/ubuntu/Data-Agent-UI-KB/model/ollama/weights/model.gguf
```

The Llama container expects the file at `model/ollama/weights/model.gguf`
relative to the repo root — the compose volume mount handles the rest.

---

## 4. Bring up the stack

```bash
cd ~/Data-Agent-UI-KB/infra
docker compose -f docker-compose.kb-ui-testing.yml up -d --build
```

First boot takes time: Llama needs to compile `llama-cpp-python` against
OpenBLAS in the image build, and the model-service downloads embedding/rerank
weights from HuggingFace. Watch progress with:

```bash
docker compose -f docker-compose.kb-ui-testing.yml logs -f llama
docker compose -f docker-compose.kb-ui-testing.yml logs -f model-service
docker compose -f docker-compose.kb-ui-testing.yml ps
```

Wait for every row in `ps` to show `healthy` before pointing the frontend at it.

### Open the ports (cloud firewalls)

If running on AWS/GCP/Azure, allow inbound traffic to:

| Port  | Service                       |
|-------|--------------------------------|
| 8050  | kb-backend (UI talks to this) |
| 11434 | llama (optional — direct)     |
| 4000  | litellm (optional — OpenAI shim) |
| 6333  | qdrant dashboard (optional)   |
| 7474  | neo4j browser (optional)      |
| 9001  | minio console (optional)      |

The frontend itself stays on your laptop — only `8050` is strictly required.

---

## 5. Point the frontend at the VM

`src/lib/mockApi.ts` reads `VITE_API_URL` at build time and falls back to
`http://localhost:8000` otherwise. Set it on your **laptop** before
running `npm run dev`:

```powershell
# PowerShell
$env:VITE_API_URL = "http://<vm-ip>:8050"
npm run dev
```

```bash
# bash / WSL
VITE_API_URL=http://<vm-ip>:8050 npm run dev
```

Or persist it to `.env.local` at the repo root so you don't have to set
it every time:

```bash
echo 'VITE_API_URL=http://<vm-ip>:8050' > .env.local
```

The UI still runs locally on `http://localhost:3000` — only the API
calls travel to the VM.

---

## 6. Day-2 operations

```bash
# Restart one service after editing code
docker compose -f docker-compose.kb-ui-testing.yml up -d --build kb-backend

# Tail logs across the stack
docker compose -f docker-compose.kb-ui-testing.yml logs -f --tail=200

# Stop everything (volumes persist)
docker compose -f docker-compose.kb-ui-testing.yml down

# Stop and wipe all state (Postgres, Mongo, Qdrant, Neo4j, MinIO)
docker compose -f docker-compose.kb-ui-testing.yml down -v

# See per-container CPU/RAM usage
docker stats
```

---

## 7. Troubleshooting

**Llama OOM-killed on boot.**
The GGUF you placed is bigger than the 12 GiB limit. Either raise
`services.llama.deploy.resources.limits.memory` in the compose file, or use a
smaller quantisation (q4_K_M is a good default for 8B models).

**Llama healthy but inference is glacial.**
Confirm the container is actually using all the CPUs you allocated:
`docker exec kb-test-llama nproc` and `docker exec kb-test-llama env | grep -E 'N_THREADS|OMP'`.
Bump `N_THREADS` and `OMP_NUM_THREADS` to match `cpus` limit. A laptop-grade
VM with shared CPUs (e.g. AWS `t3.*`) will throttle — use `m`/`c` family
instances instead.

**`docker compose up` fails on Llama build with "no space left on device".**
Build cache + CUDA layers are large. Run `docker system prune -af` and rebuild.

**Frontend gets CORS errors.**
The kb-backend in this stack is permissive by default for `localhost`. If you
serve the UI from a different host, add that origin to the backend's CORS
allowlist before exposing publicly.

**You want to switch to GPU later.**
The Llama Dockerfile already supports it. In the compose file change:
```yaml
    build:
      args:
        GPU: "1"
      context: ../model/ollama
      dockerfile: docker/Dockerfile
```
and add the NVIDIA runtime:
```yaml
    runtime: nvidia
    environment:
      N_GPU_LAYERS: "-1"
```
You also need a GPU-equipped VM and the NVIDIA Container Toolkit installed.

---

## 8. Quick checklist

- [ ] VM provisioned (≥ 8 vCPU / 24 GiB / 80 GiB SSD).
- [ ] Docker Engine + Compose plugin installed; user in `docker` group.
- [ ] Repo cloned or rsynced onto the VM.
- [ ] `model/ollama/weights/model.gguf` exists on the VM.
- [ ] `docker compose -f infra/docker-compose.kb-ui-testing.yml up -d --build` succeeds.
- [ ] `docker compose ps` shows all services `healthy`.
- [ ] Port 8050 reachable from your laptop.
- [ ] Frontend running locally with `VITE_API_BASE=http://<vm-ip>:8050`.
