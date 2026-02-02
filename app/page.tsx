import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat-interface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function HomePage() {
  console.log('[v0] Loading home page...')
  
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log('[v0] Auth check:', { user: user?.email, error: authError })

  // Show login prompt if not authenticated
  if (!user) {
    console.log('[v0] No user found, showing login prompt')
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-4xl font-bold mb-2">
                Leverage AI Sports Assistant
              </CardTitle>
              <CardDescription className="text-lg">
                Your premium AI assistant for sports betting, fantasy sports, and prediction markets
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="flex-1">
                <Link href="/login">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="flex-1">
                <Link href="/signup">Create Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  console.log('[v0] User authenticated:', user.email)

  // Try to get user data, but don't fail if tables don't exist
  let userData = null
  let chats = null

  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    userData = data
    console.log('[v0] User data loaded:', !!userData)
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
    console.log('[v0] Chats loaded:', chats?.length || 0)
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
