# Janna AI Runbook

Operational procedures for debugging and incident response.

---

## 1. Streaming Issues

### Symptoms
- Frontend shows "loading" spinner indefinitely
- SSE connection drops immediately
- Partial responses that cut off

### Diagnosis

**Step 1: Check API health**
```bash
curl https://your-api-url/health/detailed
```

**Step 2: Check ECS logs**
```bash
aws logs tail /janna/prod/api --follow --filter-pattern "ERROR"
```

**Step 3: Check SSE headers**
```bash
curl -N -H "Authorization: Bearer TOKEN" \
  -H "Accept: text/event-stream" \
  -d '{"conversationId":"...","content":"hello"}' \
  https://your-api-url/api/chat/stream
```

Expected: `Content-Type: text/event-stream` with `event: token` lines

**Step 4: Check load balancer timeout**
- ALB default timeout is 60s — increase to 300s for streaming:
  ```bash
  # Via CDK (already set) or console:
  # ALB → Attributes → Idle timeout: 300s
  ```

**Step 5: Check X-Accel-Buffering**
- Verify `X-Accel-Buffering: no` header is sent
- CloudFront/nginx may buffer SSE — set `ResponseHeadersPolicy` to pass through

### Resolution
- Restart ECS service: `aws ecs update-service --cluster ... --service ... --force-new-deployment`
- Check OpenAI API key is valid and has quota
- Verify Redis connectivity (rate limit checks)

---

## 2. Model Failures

### Symptoms
- "Rate limit exceeded" errors
- "Model unhealthy" in logs
- Responses use wrong model

### Diagnosis

**Check model gateway routing:**
```bash
# In ECS exec session:
curl http://localhost:3001/health/detailed
# Look at "models" section
```

**Check OpenAI quota:**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Check local vLLM:**
```bash
curl http://LOCAL_VLLM_HOST:8000/health
curl http://LOCAL_VLLM_HOST:8000/v1/models
```

**Check Redis health cache:**
```bash
redis-cli GET "gateway:local:healthy"
# Returns "0" if unhealthy, "1" if healthy, nil if uncached
```

### Resolution

**Force OpenAI fallback:**
```bash
redis-cli SET "gateway:local:healthy" "0" EX 30
```

**Force local model:**
```bash
redis-cli DEL "gateway:local:healthy"
# Restart vLLM if needed
```

**Rotate OpenAI API key:**
```bash
aws secretsmanager put-secret-value \
  --secret-id janna-prod/openai-api-key \
  --secret-string '{"OPENAI_API_KEY":"sk-new-key..."}'
# Restart ECS tasks to pick up new secret
```

---

## 3. RAG Pipeline Issues

### Symptoms
- Uploaded files show "FAILED" status
- RAG toggle doesn't retrieve documents
- Citations are empty despite uploading files

### Diagnosis

**Check attachment status:**
```sql
SELECT id, filename, status, created_at
FROM attachments
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC;
```

**Check document chunks:**
```sql
SELECT COUNT(*), attachment_id
FROM document_chunks
WHERE attachment_id = 'ATTACHMENT_ID'
GROUP BY attachment_id;
```

**Check embeddings:**
```sql
SELECT id, chunk_index, embedding IS NOT NULL as has_embedding
FROM document_chunks
WHERE attachment_id = 'ATTACHMENT_ID'
LIMIT 5;
```

**Check SQS queue depth:**
```bash
aws sqs get-queue-attributes \
  --queue-url $SQS_QUEUE_URL \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible
```

**Check worker logs:**
```bash
aws logs tail /janna/prod/worker --follow
```

### Resolution

**Re-process a failed attachment:**
```sql
UPDATE attachments SET status = 'UPLOADING' WHERE id = 'ATTACHMENT_ID';
```
Then call `/api/attachments/complete` with the attachment ID.

**Check OpenAI embedding quota:**
Embeddings use the same API key. Check rate limits for `text-embedding-3-small`.

**Fix pgvector index:**
```sql
-- If vector search is slow:
REINDEX INDEX CONCURRENTLY document_chunks_embedding_idx;
```

**Test vector search manually:**
```sql
-- Test that cosine search works
SELECT id, chunk_index, content
FROM document_chunks
WHERE attachment_id = 'ATTACHMENT_ID'
LIMIT 5;
```

---

## 4. Database Issues

### Symptoms
- API returns 500 errors
- "PrismaClientKnownRequestError" in logs
- Slow queries

### Diagnosis

**Check connections:**
```sql
SELECT count(*), state, wait_event_type
FROM pg_stat_activity
WHERE datname = 'janna_db'
GROUP BY state, wait_event_type;
```

**Check slow queries:**
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Check pgvector extension:**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Resolution

**Restart Aurora Serverless (scales to 0):**
```bash
aws rds start-db-cluster --db-cluster-identifier janna-prod-dbcluster
```

**Run migrations:**
```bash
# Via ECS exec or bastion host
DATABASE_URL=... npx prisma migrate deploy
```

**Increase connection pool:**
Set `DATABASE_URL` connection pool parameters:
```
postgresql://user:pass@host/db?pool_timeout=10&connection_limit=20
```

---

## 5. Rate Limiting

### Symptoms
- Users see 429 responses
- `X-RateLimit-Remaining: 0` header

### Check current rate limit state:
```bash
redis-cli KEYS "rl:USER_ID:*"
redis-cli GET "rl:USER_ID:$(date +%s | awk '{print int($1/60)}')"
```

### Reset a user's rate limit:
```bash
redis-cli DEL "rl:USER_ID:$(date +%s | awk '{print int($1/60)}')"
```

### Adjust limits:
Update `RATE_LIMIT_REQUESTS_PER_MINUTE` in ECS task environment and redeploy.

---

## 6. Useful Commands

```bash
# Tail API logs
aws logs tail /janna/prod/api --follow

# Connect to running ECS container (dev only)
aws ecs execute-command \
  --cluster janna-dev-cluster \
  --task $(aws ecs list-tasks --cluster janna-dev-cluster --query 'taskArns[0]' --output text) \
  --container api \
  --command "/bin/sh" \
  --interactive

# Check Redis
redis-cli -u $REDIS_URL INFO server

# Force ECS redeploy
aws ecs update-service \
  --cluster janna-prod-cluster \
  --service janna-prod-api \
  --force-new-deployment

# Check CloudWatch dashboard
aws cloudwatch get-dashboard --dashboard-name janna-prod-dashboard
```

---

## 7. Incident Response Checklist

1. **Identify scope**: Is it all users or specific user/model?
2. **Check CloudWatch**: Look at ECS metrics, ALB 5xx count
3. **Check logs**: `aws logs tail /janna/prod/api --filter-pattern "ERROR"`
4. **Isolate service**: API? Model? DB? Redis? Worker?
5. **Test endpoint directly**: `curl /health/detailed`
6. **Check recent deploys**: Any CDK changes or secrets rotation?
7. **Escalate**: If DB or infrastructure, contact AWS Support
8. **Post-mortem**: Document root cause in issue tracker
