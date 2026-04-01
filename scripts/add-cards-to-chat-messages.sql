-- Migration: add cards JSONB column to chat_messages
-- Run once in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS guard).
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS cards JSONB;
