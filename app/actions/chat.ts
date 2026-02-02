'use server'

import { createClient } from '@/lib/supabase/server'

export async function createChat(userId: string, title: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserChats(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
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
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      user_id: userId,
      role,
      content,
      metadata,
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

export async function updateMessageTrustScore(messageId: string, trustScore: number) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('messages')
    .update({ trust_score: trustScore })
    .eq('id', messageId)

  if (error) throw error
}
