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
    redirect('/login')
  }

  console.log('[v0] User authenticated:', user.email)

  // Try to get user data, but don't fail if tables don't exist
  let userData = null
  let chats = null
  let userCredits = null

  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    userData = data
  } catch (error) {
    console.log('[v0] Users table not found - migrations needed')
  }

  try {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    chats = data
  } catch (error) {
    console.log('[v0] Chats table not found - migrations needed')
  }

  return (
    <ChatInterface
      user={{
        id: user.id,
        email: user.email!,
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        credits: userData?.credits_balance || 100,
        tier: userData?.subscription_tier || 'free',
      }}
      initialChats={chats || []}
      migrationsNeeded={!userData}
    />
  )
}
