import { createClient } from '@/lib/supabase/server'
import ChatInterface from '@/components/chat-interface'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Show welcome page if not authenticated
  if (!user) {
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
            <div className="grid gap-4 text-center sm:text-left">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-semibold">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Live Odds Integration</h3>
                  <p className="text-sm text-muted-foreground">
                    Real-time odds from multiple bookmakers with best price comparison
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-semibold">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">AI-Powered Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Trust-scored recommendations with confidence levels and validation
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-semibold">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Portfolio Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Track your bets, fantasy positions, and DFS entries in one place
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
