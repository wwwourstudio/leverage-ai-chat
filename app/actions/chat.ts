'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

type ChatCategory = Database['public']['Tables']['chats']['Row']['category']
type MessageRole = Database['public']['Tables']['messages']['Row']['role']
type ConfidenceLevel = Database['public']['Tables']['messages']['Row']['confidence_level']

export async function createChat(
  userId: string,
  title: string,
  category: ChatCategory = 'general'
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title,
      category,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserChats(userId: string, category?: ChatCategory) {
  const supabase = await createClient()

  let query = supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getStarredChats(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .eq('is_starred', true)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

export async function toggleStarChat(chatId: string, isStarred: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('chats')
    .update({ is_starred: isStarred })
    .eq('id', chatId)

  if (error) throw error
}

export async function archiveChat(chatId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('chats')
    .update({ is_archived: true })
    .eq('id', chatId)

  if (error) throw error
}

export async function getChat(chatId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single()

  if (error) throw error
  return data
}

export async function deleteChat(chatId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('chats').delete().eq('id', chatId)

  if (error) throw error
}

export async function addMessage(
  chatId: string,
  userId: string,
  role: MessageRole,
  content: string,
  options?: {
    model?: string
    tokensUsed?: number
    creditsCharged?: number
    trustScore?: number
    confidenceLevel?: ConfidenceLevel
    attachments?: unknown[]
    contextData?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      user_id: userId,
      role,
      content,
      model: options?.model,
      tokens_used: options?.tokensUsed,
      credits_charged: options?.creditsCharged ?? 0,
      trust_score: options?.trustScore,
      confidence_level: options?.confidenceLevel,
      attachments: options?.attachments ?? [],
      context_data: options?.contextData ?? {},
      metadata: options?.metadata ?? {},
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getChatMessages(chatId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function updateMessageTrustScore(
  messageId: string,
  trustScore: number,
  confidenceLevel: ConfidenceLevel,
  validationStatus?: 'pending' | 'validated' | 'flagged' | 'failed',
  validationDetails?: Record<string, unknown>
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('messages')
    .update({
      trust_score: trustScore,
      confidence_level: confidenceLevel,
      validation_status: validationStatus,
      validation_details: validationDetails,
    })
    .eq('id', messageId)

  if (error) throw error
}
