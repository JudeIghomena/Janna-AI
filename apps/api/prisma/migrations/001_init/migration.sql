-- Migration: 001_init
-- Creates pgvector extension and all Janna AI tables

CREATE EXTENSION IF NOT EXISTS vector;

-- user_profiles
CREATE TABLE "user_profiles" (
  "id"         TEXT        NOT NULL,
  "email"      TEXT        NOT NULL,
  "role"       TEXT        NOT NULL DEFAULT 'USER',
  "disabled"   BOOLEAN     NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- conversations
CREATE TABLE "conversations" (
  "id"                      TEXT        NOT NULL,
  "user_id"                 TEXT        NOT NULL,
  "title"                   TEXT        NOT NULL DEFAULT 'New Conversation',
  "archived"                BOOLEAN     NOT NULL DEFAULT false,
  "parent_conversation_id"  TEXT,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversations_user_id_archived_updated_at_idx"
  ON "conversations"("user_id", "archived", "updated_at" DESC);
CREATE INDEX "conversations_parent_conversation_id_idx"
  ON "conversations"("parent_conversation_id");

-- messages
CREATE TABLE "messages" (
  "id"               TEXT        NOT NULL,
  "conversation_id"  TEXT        NOT NULL,
  "role"             TEXT        NOT NULL,
  "content"          TEXT        NOT NULL,
  "parent_message_id" TEXT,
  "metadata"         JSONB       DEFAULT '{}',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "messages_conversation_id_created_at_idx"
  ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_parent_message_id_idx"
  ON "messages"("parent_message_id");

-- attachments
CREATE TABLE "attachments" (
  "id"              TEXT        NOT NULL,
  "user_id"         TEXT        NOT NULL,
  "conversation_id" TEXT,
  "filename"        TEXT        NOT NULL,
  "mime_type"       TEXT        NOT NULL,
  "size"            INTEGER     NOT NULL,
  "s3_key"          TEXT        NOT NULL,
  "status"          TEXT        NOT NULL DEFAULT 'UPLOADING',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachments_user_id_status_idx" ON "attachments"("user_id", "status");
CREATE INDEX "attachments_conversation_id_idx" ON "attachments"("conversation_id");

-- document_chunks
CREATE TABLE "document_chunks" (
  "id"            TEXT        NOT NULL,
  "attachment_id" TEXT        NOT NULL,
  "chunk_index"   INTEGER     NOT NULL,
  "content"       TEXT        NOT NULL,
  "embedding"     vector(1536),
  "metadata"      JSONB       DEFAULT '{}',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "document_chunks_attachment_id_chunk_index_idx"
  ON "document_chunks"("attachment_id", "chunk_index");
-- HNSW index for fast ANN search
CREATE INDEX "document_chunks_embedding_idx"
  ON "document_chunks" USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- usage_events
CREATE TABLE "usage_events" (
  "id"               TEXT        NOT NULL,
  "user_id"          TEXT        NOT NULL,
  "conversation_id"  TEXT,
  "model"            TEXT        NOT NULL,
  "prompt_tokens"    INTEGER     NOT NULL,
  "completion_tokens" INTEGER    NOT NULL,
  "latency_ms"       INTEGER     NOT NULL,
  "cost_estimate"    DOUBLE PRECISION NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at");
CREATE INDEX "usage_events_created_at_idx" ON "usage_events"("created_at");

-- api_keys
CREATE TABLE "api_keys" (
  "id"          TEXT        NOT NULL,
  "user_id"     TEXT        NOT NULL,
  "label"       TEXT        NOT NULL,
  "hashed_key"  TEXT        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revoked_at"  TIMESTAMPTZ,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- Foreign keys
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_parent_conversation_id_fkey"
  FOREIGN KEY ("parent_conversation_id") REFERENCES "conversations"("id");

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_parent_message_id_fkey"
  FOREIGN KEY ("parent_message_id") REFERENCES "messages"("id");

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "attachments"
  ADD CONSTRAINT "attachments_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id");

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE CASCADE;

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE;

ALTER TABLE "usage_events"
  ADD CONSTRAINT "usage_events_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id");

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE;
