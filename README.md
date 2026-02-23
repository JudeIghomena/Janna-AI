# Janna AI

**"Your context-aware AI workspace"**

A production-grade AI chat system with hybrid model support (OpenAI + local vLLM), RAG (retrieval-augmented generation), tool calling, and a modern streaming chat UI — deployed on AWS.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  CloudFront / AWS Amplify                               │
│  Next.js 14 (App Router)                                │
└────────────────────┬────────────────────────────────────┘
                     │  HTTPS / SSE
┌────────────────────▼────────────────────────────────────┐
│  ALB → ECS Fargate (Fastify API)                        │
│  ├── Model Gateway (OpenAI / local vLLM)                │
│  ├── RAG Service (pgvector search)                      │
│  ├── Tool Runner (calculator, search, docs)             │
│  └── Ingestion Worker (SQS queue)                       │
└──────┬────────────┬────────────────┬────────────────────┘
       │            │                │
  RDS Aurora    ElastiCache      S3 Bucket
  Postgres 16   Redis 7          (attachments)
  + pgvector                          │
                                 SQS FIFO queue
                                 → ECS worker
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- AWS CLI (for deployment)
- OpenAI API key

### 1. Clone and install

```bash
git clone https://github.com/your-org/janna-ai.git
cd janna-ai
cp .env.example .env.local
# Edit .env.local and fill in your values
pnpm install
```

### 2. Start infrastructure

```bash
# Start Postgres (with pgvector) + Redis + MinIO
docker compose -f docker-compose.dev.yml up -d

# Wait for postgres to be ready, then run migrations
pnpm --filter @janna/api exec prisma migrate deploy
pnpm --filter @janna/api exec prisma generate
```

### 3. Configure environment

Edit `.env.local`:

```env
# Required
DATABASE_URL=postgresql://janna:janna_dev_password@localhost:5432/janna_db
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
S3_BUCKET_NAME=local-test-bucket   # Any value for dev; real bucket for S3
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

> **Note**: For local dev without real Cognito, you can use a dev-mode JWT bypass.
> Set `NODE_ENV=development` and optionally mock the Cognito verifier.

### 4. Run the app

```bash
# Terminal 1: API (with hot reload)
pnpm --filter @janna/api dev

# Terminal 2: Frontend
pnpm --filter @janna/web dev

# Terminal 3 (optional): Ingestion worker
pnpm --filter @janna/api worker
```

Open **http://localhost:3000**

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `S3_BUCKET_NAME` | Yes | S3 bucket for attachments |
| `COGNITO_USER_POOL_ID` | Yes | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | Yes | Cognito app client ID |
| `LOCAL_VLLM_BASE_URL` | No | vLLM endpoint URL (enables local model) |
| `LOCAL_VLLM_MODEL` | No | Model name for local vLLM |
| `SQS_INGESTION_QUEUE_URL` | No | SQS queue URL (uses inline processing without it) |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | Default: 60 |

---

## Seeding Admin Role

After creating your first account via the signup page:

**Method 1: AWS Console**
1. Go to **Cognito → User Pools → [your pool] → Users**
2. Find your user
3. Go to **Groups** tab → Add to **Admins** group
4. The backend will promote the user to ADMIN role on next login

**Method 2: AWS CLI**
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username your-email@example.com \
  --group-name Admins
```

**Method 3: Direct DB (development only)**
```sql
UPDATE user_profiles SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

---

## Deploy to AWS

### Prerequisites
1. AWS account with CDK bootstrap:
   ```bash
   aws configure
   cdk bootstrap aws://ACCOUNT_ID/REGION
   ```
2. GitHub repository connected (for Amplify)
3. GitHub OIDC role created for CI/CD

### GitHub Secrets Required
```
AWS_ACCOUNT_ID
AWS_REGION
AWS_DEPLOY_ROLE_ARN   # IAM role for GitHub Actions OIDC
```

### GitHub Environments
Create two environments in GitHub Settings → Environments:
- `dev` — auto-deploys on push to `main`
- `prod` — manual approval, triggered from Actions tab

### Deploy Dev
```bash
cd infra
pnpm cdk deploy --all --require-approval never -c env=dev
```

### Deploy Prod (via GitHub Actions)
1. Go to **Actions → Deploy to Production**
2. Click **Run workflow**
3. Type `deploy-prod` to confirm
4. CDK diff is shown before deploy

### Post-Deploy Steps
1. Note the **Cognito User Pool ID** and **Client ID** from CDK outputs
2. Update Amplify environment variables with the correct Cognito config
3. Set the **OpenAI API Key** in Secrets Manager:
   ```bash
   aws secretsmanager put-secret-value \
     --secret-id janna-dev/openai-api-key \
     --secret-string '{"OPENAI_API_KEY":"sk-..."}'
   ```
4. Run DB migrations on ECS:
   ```bash
   # Using ECS Exec (dev only)
   aws ecs execute-command \
     --cluster janna-dev-cluster \
     --task TASK_ID \
     --container api \
     --command "npx prisma migrate deploy" \
     --interactive
   ```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| State | TanStack Query, Zustand |
| Auth | AWS Cognito + aws-amplify |
| Backend | Fastify 4, TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 (ElastiCache) |
| Storage | Amazon S3 |
| Queue | Amazon SQS FIFO |
| AI | OpenAI SDK + vLLM (local) |
| Infra | AWS CDK v2 |
| Hosting | AWS Amplify + ECS Fargate |
| CI/CD | GitHub Actions |

---

## Project Structure

```
janna-ai/
├── apps/
│   ├── api/           Fastify backend + Prisma
│   └── web/           Next.js frontend
├── packages/
│   └── shared/        Shared TypeScript types
├── infra/             AWS CDK stacks
├── .github/workflows/ CI/CD pipelines
├── docker-compose.yml Production compose
└── docker-compose.dev.yml Development (infra only)
```

---

## Local vLLM Setup

To run a local model (e.g., Llama 3.1 70B):

```bash
# On a GPU instance
pip install vllm

python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --tensor-parallel-size 2 \
  --port 8000

# Set in .env.local:
LOCAL_VLLM_BASE_URL=http://your-gpu-host:8000/v1
LOCAL_VLLM_MODEL=meta-llama/Llama-3.1-70B-Instruct
```

The Model Gateway auto-detects local model health and falls back to OpenAI if unavailable.
