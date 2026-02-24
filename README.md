# Janna AI

> Your context-aware AI workspace — streaming chat with multi-model support, file RAG, and tool calling.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                       │
│  Next.js 15 (App Router)  ·  TanStack Query  ·  Zustand       │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS / SSE
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  CloudFront  (/api/* → ALB,  /* → S3 static)                  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  ALB  →  ECS Fargate Backend (Fastify + Prisma)               │
│          · JWT / Cognito auth                                  │
│          · Rate limiting (Redis Lua)                          │
│          · Model Gateway → OpenAI / Anthropic / vLLM          │
│          · RAG (pgvector cosine search)                       │
│          · Tool calling (calculator / web_search / docs)      │
└──────┬────────────────────────────────────────────┬──────────┘
       │                                            │
       ▼                                            ▼
┌──────────────────────┐              ┌─────────────────────────┐
│  Aurora Postgres 16   │              │  ElastiCache Redis 7.2  │
│  + pgvector           │              │  (rate limits + cache)  │
└──────────────────────┘              └─────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  S3  ←─ presigned upload ─  Browser                          │
│   ↓ (s3:ObjectCreated notification via SQS)                   │
│  SQS → ECS Fargate Worker                                     │
│         · PDF / DOCX / TXT extraction                         │
│         · 800-char chunking + OpenAI embeddings               │
│         · pgvector upsert                                     │
└──────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
janna-ai/
├── apps/
│   ├── backend/          # Fastify API (port 3001)
│   ├── frontend/         # Next.js UI (port 3000)
│   └── worker/           # SQS ingestion worker
├── packages/
│   └── shared/           # Shared TypeScript types + MODEL_REGISTRY
├── infra/                # AWS CDK (TypeScript)
└── .github/workflows/    # CI + Deploy
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker + Docker Compose | latest |
| AWS CLI | v2 |
| AWS CDK | `npm i -g aws-cdk` |

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/janna-ai.git
cd janna-ai
npm install
```

### 2. Start local services

```bash
docker compose up postgres redis localstack -d
```

Wait for health checks to pass (~10s).

### 3. Configure environment

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit: DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY

# Frontend
cp apps/frontend/.env.local.example apps/frontend/.env.local
# Edit: NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Minimum required vars to get chat working locally:**

```bash
# apps/backend/.env
NODE_ENV=development
DATABASE_URL=postgresql://janna:janna@localhost:5432/janna
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-long-random-string
OPENAI_API_KEY=sk-...          # for embeddings + GPT models
ANTHROPIC_API_KEY=sk-ant-...   # for Claude models (optional)
COGNITO_USER_POOL_ID=dev       # any value in dev mode
COGNITO_CLIENT_ID=dev
AWS_REGION=us-east-1
S3_BUCKET=janna-attachments-dev
SQS_INGESTION_QUEUE_URL=http://localhost:4566/000000000000/janna-ingestion-dev
```

> **Dev auth bypass**: set `NODE_ENV=development` and send any `Authorization: Bearer dev:USERID:EMAIL` header (e.g. `dev:user1:alice@example.com`).

### 4. Run migrations and seed

```bash
npm run db:push --workspace=apps/backend
# optionally: npm run db:studio --workspace=apps/backend
```

### 5. Start all services

```bash
# All at once (Turborepo parallel)
npm run dev

# Or individually:
npm run dev --workspace=apps/backend   # :3001
npm run dev --workspace=apps/frontend  # :3000
npm run dev --workspace=apps/worker    # SQS polling
```

Open [http://localhost:3000](http://localhost:3000).

## Models

| ID | Provider | Display Name | Context | Notes |
|----|----------|-------------|---------|-------|
| `openai:gpt-4o-mini` | OpenAI | GPT-4o Mini | 128k | Fast, cheap, default |
| `openai:gpt-4.1` | OpenAI | GPT-4.1 | 1M | Highest capability |
| `anthropic:claude-sonnet-4-6` | Anthropic | Claude Sonnet 4.6 | 200k | Balanced |
| `anthropic:claude-haiku-4-5` | Anthropic | Claude Haiku 4.5 | 200k | Fastest Claude |
| `local:llama-3.1-70b` | vLLM | Llama 3.1 70B | 131k | Requires GPU EC2 |

## API

Base URL: `http://localhost:3001`

All endpoints require `Authorization: Bearer <token>` except `/health`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get with messages |
| PATCH | `/api/conversations/:id` | Rename / archive |
| DELETE | `/api/conversations/:id` | Soft delete |
| POST | `/api/chat/stream` | SSE streaming chat |
| POST | `/api/attachments/presign` | Get S3 upload URL |
| GET | `/api/attachments/:id` | Attachment status |
| POST | `/api/rag/search` | Vector search |
| GET | `/api/admin/metrics` | Admin metrics |
| GET | `/api/admin/users` | User list |
| PATCH | `/api/admin/users/:id/disable` | Disable user |
| PATCH | `/api/admin/users/:id/enable` | Enable user |

### SSE Event Stream

`POST /api/chat/stream` returns `text/event-stream`. Each line is:

```
data: {"type":"token","content":"Hello"}\n\n
data: {"type":"tool_call_start","toolCallId":"x","name":"calculator","input":{}}\n\n
data: {"type":"tool_call_result","toolCallId":"x","name":"calculator","output":42}\n\n
data: {"type":"citation","attachmentId":"...","filename":"doc.pdf","chunkIndex":3,"excerpt":"...","similarity":0.92}\n\n
data: {"type":"usage","promptTokens":150,"completionTokens":80,"totalTokens":230,"costEstimate":0.0001,"latencyMs":1200}\n\n
data: {"type":"done","messageId":"msg_1","conversationId":"conv_1"}\n\n
```

## AWS Deployment

### 1. Bootstrap CDK

```bash
cd infra
npm install

# Bootstrap once per account/region
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1 --context envName=dev
```

### 2. Set secrets post-deploy

After first deploy, update the app secrets in AWS Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id "janna/dev/app" \
  --secret-string '{"JWT_SECRET":"...","OPENAI_API_KEY":"sk-...","ANTHROPIC_API_KEY":"sk-ant-..."}'
```

### 3. Deploy

```bash
# Dev
npx cdk deploy --context envName=dev --all --require-approval never

# Prod (with diff preview first)
npx cdk diff --context envName=prod --all
npx cdk deploy --context envName=prod --all
```

### 4. Run production migrations

```bash
# Get cluster and task definition from CDK outputs
aws ecs run-task \
  --cluster janna-prod \
  --task-definition janna-backend \
  --overrides '{"containerOverrides":[{"name":"backend","command":["npx","prisma","migrate","deploy"]}]}' \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"
```

### GitHub Actions (CI/CD)

1. Add the following secrets to your GitHub repo:
   - `AWS_DEPLOY_ROLE_DEV` — IAM role ARN for dev deploys (OIDC)
   - `AWS_DEPLOY_ROLE_PROD` — IAM role ARN for prod deploys
   - `SLACK_WEBHOOK_URL` — Slack incoming webhook (optional)

2. Push to `main` → auto-deploys to dev.

3. Trigger `workflow_dispatch` with `environment=prod` for prod deploy (requires environment protection rule approval).

## Environment Variables Reference

### Backend (`apps/backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | HTTP port (default: 3001) |
| `DATABASE_URL` | Yes | Postgres connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Fallback JWT secret (dev only) |
| `COGNITO_USER_POOL_ID` | Yes | Cognito user pool ID |
| `COGNITO_CLIENT_ID` | Yes | Cognito app client ID |
| `AWS_REGION` | Yes | AWS region |
| `S3_BUCKET` | Yes | S3 bucket for attachments |
| `SQS_INGESTION_QUEUE_URL` | Yes | SQS queue URL |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (for Claude models) |
| `BRAVE_SEARCH_API_KEY` | No | Brave Search API key (for web_search tool) |
| `LOCAL_LLM_ENDPOINT` | No | vLLM endpoint URL |
| `APP_SECRETS_ARN` | No | AWS Secrets Manager ARN (prod) |

### Frontend (`apps/frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Yes | Cognito user pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Yes | Cognito app client ID |
| `NEXT_PUBLIC_AWS_REGION` | Yes | AWS region |

## License

Proprietary — All rights reserved.
