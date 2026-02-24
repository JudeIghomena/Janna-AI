# Janna AI — Runbook

Operational procedures for common incidents and debugging scenarios.

---

## Table of Contents

1. [Streaming is broken / no tokens arrive](#1-streaming-is-broken)
2. [Model gateway failures / fallback to gpt-4o-mini](#2-model-gateway-failures)
3. [RAG pipeline not returning citations](#3-rag-pipeline-not-returning-citations)
4. [Worker not processing attachments](#4-worker-not-processing-attachments)
5. [Redis rate limiting blocking users](#5-redis-rate-limiting-blocking-users)
6. [Database performance](#6-database-performance)
7. [ECS task crashes / OOM](#7-ecs-task-crashes--oom)
8. [Auth / JWT failures](#8-auth--jwt-failures)
9. [CloudFront / ALB routing issues](#9-cloudfront--alb-routing-issues)
10. [Admin actions](#10-admin-actions)

---

## 1. Streaming is broken

**Symptoms:** Chat sends but nothing arrives. Activity panel stays empty.

### Check backend SSE response headers

```bash
curl -N -H "Authorization: Bearer dev:u1:test@dev.local" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"xxx","message":"hello"}' \
  http://localhost:3001/api/chat/stream
```

Expected: `Content-Type: text/event-stream` with `data: {...}` lines.

### Check CloudFront buffering

CloudFront can buffer SSE. Verify `X-Accel-Buffering: no` header is set. If using nginx, ensure `proxy_buffering off`.

Check the backend logs:
```bash
aws logs tail /janna/prod/backend --follow --filter-pattern "stream"
```

### Check ALB idle timeout

ALB default idle timeout is 60s — long conversations will be cut off. Increase to 300s or 3600s:
```bash
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn <ALB_ARN> \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

### SSE not reaching browser (CORS)

Look for `Access-Control-Allow-Origin` in the response headers. The backend CORS plugin allows the origin from `FRONTEND_URL`. Ensure the env var is set correctly.

---

## 2. Model gateway failures

**Symptoms:** Error toast "AI service temporarily unavailable". Backend logs show `[modelGateway]` errors.

### Check health cache in Redis

```bash
redis-cli GET "health:local:llama-3.1-70b"
# Returns "0" if failing, "1" if healthy, nil if unchecked
```

### Force clear failover state

```bash
redis-cli DEL "health:local:llama-3.1-70b"
```

### Check API key validity

```bash
# Test OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[0].id'

# Test Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### OpenAI / Anthropic rate limits

Both APIs return `429`. The gateway propagates the error to the client as an SSE `error` event. Check CloudWatch for rate of 429s:

```bash
aws cloudwatch get-metric-statistics \
  --namespace Janna/Backend \
  --metric-name ModelGatewayErrors \
  --dimensions Name=Provider,Value=openai \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## 3. RAG pipeline not returning citations

**Symptoms:** Files uploaded successfully, but no citations appear in chat even with RAG enabled.

### Check attachment status

```bash
# Via API
curl -H "Authorization: Bearer dev:u1:test@dev.local" \
  http://localhost:3001/api/attachments/ATTACHMENT_ID

# Expected: {"status":"ready","..."}
# If "processing": worker hasn't finished
# If "error": check worker logs
```

### Check worker logs

```bash
aws logs tail /janna/prod/worker --follow --filter-pattern "ERROR"
```

### Check pgvector index

Embeddings without an HNSW/IVFFlat index will fall back to exact search (slow but correct). Verify the index exists:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks';
```

If missing, create it (takes time on large tables):
```sql
CREATE INDEX CONCURRENTLY document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Inspect chunk embeddings

```sql
SELECT id, "attachmentId", LEFT(content, 50) as preview,
       embedding IS NOT NULL as has_embedding
FROM document_chunks
WHERE "attachmentId" = 'YOUR_ATTACHMENT_ID'
LIMIT 10;
```

### Test RAG directly

```bash
curl -H "Authorization: Bearer dev:u1:test@dev.local" \
  -H "Content-Type: application/json" \
  -d '{"query":"your test query","limit":5}' \
  http://localhost:3001/api/rag/search
```

---

## 4. Worker not processing attachments

**Symptoms:** Attachments stuck in `processing` status. No embeddings in DB.

### Check SQS queue depth

```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_INGESTION_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible
```

High `NotVisible` = messages in-flight (worker is processing or crashed mid-job).

### Check DLQ

```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_INGESTION_DLQ_URL \
  --attribute-names ApproximateNumberOfMessages
```

Messages in DLQ = 3 failed attempts. Read them to diagnose:
```bash
aws sqs receive-message --queue-url $SQS_INGESTION_DLQ_URL
```

### Force reprocess from DLQ

```bash
# Read messages from DLQ and resend to main queue
# Use AWS console: SQS → DLQ → Start DLQ redrive
```

### Common worker failures

| Error | Cause | Fix |
|-------|-------|-----|
| `NoSuchKey` S3 error | File deleted before processing | Accept & delete message |
| `InvalidPDFException` | Corrupt PDF | Mark attachment as `error` |
| OpenAI `429` on embeddings | Embedding rate limit | Worker already retries — wait |
| OOM crash | Very large file | Increase worker task memory |

---

## 5. Redis rate limiting blocking users

**Symptoms:** Users getting `429 Too Many Requests`.

### Check current rate limit for a user

```bash
redis-cli ZCARD "rl:USER_ID:chat"
redis-cli ZRANGE "rl:USER_ID:chat" 0 -1 WITHSCORES
```

### Clear rate limit (emergency)

```bash
redis-cli DEL "rl:USER_ID:chat"
```

### Check global rate limit config

Current limits (defined in `src/routes/chat.ts`):
- `chat`: 30 req / 60s per user
- API-level: 200 req / 10s per IP (fastify-rate-limit)

To increase limits temporarily, update the env var `RATE_LIMIT_CHAT_RPM` and redeploy.

---

## 6. Database performance

### Check slow queries

```sql
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

### Check pgvector query plan

```sql
EXPLAIN ANALYZE
SELECT id, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM document_chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;
```

Look for `Index Scan using document_chunks_embedding_idx` — if you see `Seq Scan`, the index isn't being used (check `enable_seqscan`).

### Aurora Serverless scaling

If queries are slow under load, the ACU may be scaling up. Check CloudWatch:
- Metric: `ServerlessDatabaseCapacity` — watch for rapid changes
- Consider setting a higher `minCapacity` in `DatabaseStack.ts` for prod

### Connection pool exhaustion

Prisma uses a connection pool. Check:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBClusterIdentifier,Value=janna-prod \
  --period 60 --statistics Maximum \
  --start-time $(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
```

If near `max_connections`, reduce `connection_limit` in `DATABASE_URL` or add a PgBouncer proxy.

---

## 7. ECS task crashes / OOM

### View recent stopped tasks

```bash
aws ecs list-tasks --cluster janna-prod --desired-status STOPPED | \
  xargs -I {} aws ecs describe-tasks --cluster janna-prod --tasks {}
```

Look for `stopCode: EssentialContainerExited` and `stoppedReason`.

### ECS Exec (live debugging)

```bash
aws ecs execute-command \
  --cluster janna-prod \
  --task TASK_ID \
  --container backend \
  --interactive \
  --command "/bin/sh"
```

### OOM: increase task memory

In `ComputeStack.ts`, increase `memoryLimitMiB` for the affected service and redeploy.

---

## 8. Auth / JWT failures

**Symptoms:** `401 Unauthorized` or `403 Forbidden` errors.

### Verify JWKS endpoint is reachable

```bash
curl "https://cognito-idp.us-east-1.amazonaws.com/POOL_ID/.well-known/jwks.json"
```

### Decode a token (without verification)

```bash
# Base64 decode the payload (middle part of JWT)
echo "JWT_PAYLOAD_PART" | base64 -d | jq .
```

Check `iss` matches your Cognito pool URL, `exp` is in the future, and `cognito:groups` includes expected groups.

### Dev bypass not working

In dev mode, the token format must be exactly `dev:USERID:EMAIL` (two colons). The auth plugin checks `NODE_ENV === 'development'` and `token.startsWith('dev:')`.

---

## 9. CloudFront / ALB routing issues

### Test ALB directly (bypassing CloudFront)

```bash
curl http://ALB_DNS_NAME/health
```

If this works but CloudFront doesn't, the issue is in the distribution config.

### Check CloudFront cache headers

```bash
curl -I https://app.janna.ai/api/health
# Look for: X-Cache: Miss from cloudfront (first request)
# Or:       X-Cache: Hit from cloudfront (cached — wrong for API!)
```

API routes should never be cached. Check the `apiCachePolicy` in `FrontendStack.ts`.

### Force cache invalidation

```bash
aws cloudfront create-invalidation \
  --distribution-id DIST_ID \
  --paths "/*"
```

---

## 10. Admin actions

### Disable a user

Via Admin dashboard (`/admin`) or:
```bash
curl -X PATCH \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3001/api/admin/users/USER_ID/disable
```

### Promote user to admin

Via Cognito console or:
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id POOL_ID \
  --username user@example.com \
  --group-name admin
```

Note: the backend checks the `groups` claim on the JWT (Cognito inserts `cognito:groups` automatically after group membership change). User must log out and log back in for the new token to reflect admin group.

### View real-time metrics

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3001/api/admin/metrics | jq .
```

### Reset a user's rate limit

```bash
redis-cli KEYS "rl:USER_ID:*" | xargs redis-cli DEL
```

---

## Useful Commands

```bash
# Tail backend logs (prod)
aws logs tail /janna/prod/backend --follow

# Tail worker logs (prod)
aws logs tail /janna/prod/worker --follow

# Check ECS service status
aws ecs describe-services \
  --cluster janna-prod \
  --services janna-backend janna-worker \
  --query 'services[*].{name:serviceName,running:runningCount,desired:desiredCount,deployments:deployments[0].status}'

# DB connection info from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id janna/prod/db \
  --query SecretString \
  --output text | jq .

# Flush all Redis keys (⚠️ destructive — dev only)
redis-cli FLUSHALL
```
