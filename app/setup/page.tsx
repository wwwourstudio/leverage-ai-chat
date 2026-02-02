import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, Database, Shield, Zap, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { DatabaseStatus } from '@/components/database-status'

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Setup Guide</h1>
          <p className="text-muted-foreground text-lg">
            Get your Sports AI Assistant up and running in minutes
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>
            You must complete the integration setup in v0 before the app will function. Open the
            sidebar and navigate to the Connect section.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Database Status</CardTitle>
            <CardDescription>
              Real-time verification of your database setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DatabaseStatus />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              <CardTitle>Step 1: Connect Supabase</CardTitle>
            </div>
            <CardDescription>
              Connect your Supabase database to store user data, chats, and AI responses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Open the v0 sidebar (left side of screen)</li>
              <li>Click on the Connect section</li>
              <li>Select Supabase from the integrations list</li>
              <li>Follow the prompts to connect your project</li>
              <li>
                Run the migration files in order (see{' '}
                <Link href="/QUICK_START.md" className="text-primary hover:underline">
                  QUICK_START.md
                </Link>
                )
              </li>
              <li>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link
                    href="https://app.supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Supabase Dashboard
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </li>
            </ol>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>What this creates</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <div>• Users table with credit system</div>
                <div>• Chats and messages tables</div>
                <div>• Trust scoring and validation system</div>
                <div>• Credits ledger for transactions</div>
                <div>• Row Level Security (RLS) policies</div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              <CardTitle>Step 2: Connect Grok AI</CardTitle>
            </div>
            <CardDescription>
              Enable AI-powered sports betting and fantasy sports analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Open the v0 sidebar</li>
              <li>Click on the Connect section</li>
              <li>Select Grok from the integrations list</li>
              <li>The AI SDK will automatically use Vercel AI Gateway (zero-config)</li>
            </ol>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>What you get</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <div>• Streaming AI responses</div>
                <div>• Sports betting analysis</div>
                <div>• Fantasy sports recommendations</div>
                <div>• Real-time odds evaluation</div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-green-500" />
              <CardTitle>Step 3: Verify Setup</CardTitle>
            </div>
            <CardDescription>Confirm everything is working correctly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Database connected</p>
                  <p className="text-xs text-muted-foreground">
                    Check that tables are created in Supabase dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">AI integration active</p>
                  <p className="text-xs text-muted-foreground">
                    Grok should appear in Connected Integrations
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Environment variables set</p>
                  <p className="text-xs text-muted-foreground">
                    Check Vars section in v0 sidebar
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Ready to get started?</CardTitle>
            <CardDescription>
              Once you've completed the setup steps above, you can start using the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/">Go to App</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/sign-up">Create Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground pt-6">
          <p>
            Need help? Check{' '}
            <Link href="/SETUP.md" className="underline">
              SETUP.md
            </Link>{' '}
            for detailed instructions
          </p>
        </div>
      </div>
    </div>
  )
}
