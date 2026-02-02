import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat-interface'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login')
  }

  // Get or create user record with credits
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (userError || !userData) {
    // Create user record if doesn't exist
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email!,
      display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
      credits_balance: 50, // Initial credits for new users
      subscription_tier: 'free',
    })

    if (insertError) {
      console.error('[v0] Error creating user:', insertError)
    }
  }

  // Get user's chats
  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get user credits
  const { data: userCredits } = await supabase
    .from('users')
    .select('credits_balance, subscription_tier')
    .eq('id', user.id)
    .single()

  return (
    <ChatInterface
      user={{
        id: user.id,
        email: user.email!,
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        credits: userCredits?.credits_balance || 0,
        tier: userCredits?.subscription_tier || 'free',
      }}
      initialChats={chats || []}
    />
  )
}
