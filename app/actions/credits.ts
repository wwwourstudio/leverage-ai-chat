'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

type TransactionType = Database['public']['Tables']['credits_ledger']['Row']['transaction_type']

export async function getUserCredits(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('credits_balance, total_credits_purchased, total_credits_spent')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  messageId?: string,
  chatId?: string
) {
  const supabase = await createClient()

  // Get current balance
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('credits_balance, total_credits_spent')
    .eq('id', userId)
    .single()

  if (userError) throw userError
  if (!userData) throw new Error('User not found')
  
  const currentBalance = userData.credits_balance

  if (currentBalance < amount) {
    throw new Error('Insufficient credits')
  }

  const newBalance = currentBalance - amount

  // Update user balance
  const { error: updateError } = await supabase
    .from('users')
    .update({
      credits_balance: newBalance,
      total_credits_spent: (userData.total_credits_spent || 0) + amount,
    })
    .eq('id', userId)

  if (updateError) throw updateError

  // Record transaction
  const { error: ledgerError } = await supabase
    .from('credits_ledger')
    .insert({
      user_id: userId,
      amount: -amount,
      balance_after: newBalance,
      transaction_type: 'message_charge',
      description,
      message_id: messageId,
      chat_id: chatId,
    })

  if (ledgerError) throw ledgerError

  return { newBalance, amountDeducted: amount }
}

export async function addCredits(
  userId: string,
  amount: number,
  transactionType: TransactionType,
  description: string,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient()

  // Get current balance
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('credits_balance, total_credits_purchased')
    .eq('id', userId)
    .single()

  if (userError) throw userError
  if (!userData) throw new Error('User not found')

  const currentBalance = userData.credits_balance
  const newBalance = currentBalance + amount

  // Update user balance
  const updateData: { credits_balance: number; total_credits_purchased?: number } = {
    credits_balance: newBalance,
  }

  if (transactionType === 'purchase') {
    updateData.total_credits_purchased = (userData.total_credits_purchased || 0) + amount
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)

  if (updateError) throw updateError

  // Record transaction
  const { error: ledgerError } = await supabase
    .from('credits_ledger')
    .insert({
      user_id: userId,
      amount,
      balance_after: newBalance,
      transaction_type: transactionType,
      description,
      metadata: metadata ?? {},
    })

  if (ledgerError) throw ledgerError

  return { newBalance, amountAdded: amount }
}

export async function getCreditsHistory(userId: string, limit = 50) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('credits_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function refundCredits(
  userId: string,
  messageId: string,
  reason: string
) {
  const supabase = await createClient()

  // Get the original charge
  const { data: transaction, error: transactionError } = await supabase
    .from('credits_ledger')
    .select('amount, message_id')
    .eq('user_id', userId)
    .eq('message_id', messageId)
    .eq('transaction_type', 'message_charge')
    .single()

  if (transactionError) throw transactionError
  if (!transaction) throw new Error('Transaction not found')

  const refundAmount = Math.abs(transaction.amount)

  // Add credits back
  return addCredits(
    userId,
    refundAmount,
    'refund',
    `Refund: ${reason}`,
    { original_message_id: messageId }
  )
}
