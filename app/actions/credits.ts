'use server'

import { createClient } from '@/lib/supabase/server'

export async function getUserCredits(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('credits_balance')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data.credits_balance
}

export async function deductCredits(userId: string, amount: number, reason: string) {
  const supabase = await createClient()

  // Start a transaction by first checking balance
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('credits_balance')
    .eq('id', userId)
    .single()

  if (userError) throw userError
  if (user.credits_balance < amount) {
    throw new Error('Insufficient credits')
  }

  // Deduct credits
  const { error: updateError } = await supabase
    .from('users')
    .update({ credits_balance: user.credits_balance - amount })
    .eq('id', userId)

  if (updateError) throw updateError

  // Log transaction
  const { error: ledgerError } = await supabase.from('credits_ledger').insert({
    user_id: userId,
    amount: -amount,
    transaction_type: 'debit',
    description: reason,
  })

  if (ledgerError) throw ledgerError

  return user.credits_balance - amount
}

export async function addCredits(userId: string, amount: number, reason: string) {
  const supabase = await createClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('credits_balance')
    .eq('id', userId)
    .single()

  if (userError) throw userError

  const { error: updateError } = await supabase
    .from('users')
    .update({ credits_balance: user.credits_balance + amount })
    .eq('id', userId)

  if (updateError) throw updateError

  const { error: ledgerError } = await supabase.from('credits_ledger').insert({
    user_id: userId,
    amount,
    transaction_type: 'credit',
    description: reason,
  })

  if (ledgerError) throw ledgerError

  return user.credits_balance + amount
}

export async function getCreditHistory(userId: string, limit = 10) {
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
