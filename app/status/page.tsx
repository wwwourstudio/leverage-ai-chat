import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
  Database,
  Code,
  Layout,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { DatabaseStatus } from '@/components/database-status'

export default function StatusPage() {
  const features = [
    {
      category: 'Database',
      icon: Database,
      items: [
        { name: 'Core Schema (users, chats, messages, credits)', status: 'complete' },
        { name: 'Portfolio & Odds Tables', status: 'complete' },
        { name: 'Functions & Triggers', status: 'complete' },
        { name: 'RLS Policies', status: 'complete' },
        { name: 'Migrations Executed', status: 'pending' },
        { name: 'Realtime Enabled', status: 'pending' },
      ],
    },
    {
      category: 'Backend',
      icon: Code,
      items: [
        { name: 'Server Actions (chat, credits, ai)', status: 'complete' },
        { name: 'The Odds API Integration', status: 'complete' },
        { name: 'TypeScript Type Definitions', status: 'complete' },
        { name: 'Supabase Client Setup', status: 'complete' },
        { name: 'AI Streaming with Grok', status: 'complete' },
        { name: 'Edge Function Deployment', status: 'pending' },
      ],
    },
    {
      category: 'Frontend',
      icon: Layout,
      items: [
        { name: 'Chat Interface', status: 'complete' },
        { name: 'Trust Badge Components', status: 'complete' },
        { name: 'Credits Display (Real-time)', status: 'complete' },
        { name: 'Odds Display Components', status: 'complete' },
        { name: 'Portfolio Tracker', status: 'complete' },
        { name: 'Category Selector', status: 'complete' },
        { name: 'Chat Sidebar', status: 'complete' },
        { name: 'Setup Page', status: 'complete' },
        { name: 'Dashboard Page', status: 'complete' },
      ],
    },
    {
      category: 'Documentation',
      icon: FileText,
      items: [
        { name: 'Quick Start Guide', status: 'complete' },
        { name: 'Database Documentation', status: 'complete' },
        { name: 'Migration Instructions', status: 'complete' },
        { name: 'Test Queries', status: 'complete' },
        { name: 'Implementation Summary', status: 'complete' },
      ],
    },
  ]

  const statusColors = {
    complete: 'text-green-600',
    pending: 'text-amber-600',
    blocked: 'text-red-600',
  }

  const statusIcons = {
    complete: CheckCircle2,
    pending: Circle,
    blocked: AlertCircle,
  }

  const getProgress = () => {
    const total = features.reduce((sum, cat) => sum + cat.items.length, 0)
    const completed = features.reduce(
      (sum, cat) => sum + cat.items.filter((i) => i.status === 'complete').length,
      0
    )
    return { completed, total, percentage: Math.round((completed / total) * 100) }
  }

  const progress = getProgress()

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-6xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Project Status</h1>
          <p className="text-lg text-muted-foreground">
            AI Sports Betting & Fantasy Assistant
          </p>

          {/* Progress Bar */}
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-semibold">{progress.percentage}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {progress.completed} of {progress.total} tasks completed
            </p>
          </div>
        </div>

        {/* Database Status Card */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Database Status</h2>
          <DatabaseStatus />
        </Card>

        {/* Feature Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            const categoryProgress = {
              completed: feature.items.filter((i) => i.status === 'complete').length,
              total: feature.items.length,
            }

            return (
              <Card key={feature.category} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{feature.category}</h3>
                      <p className="text-sm text-muted-foreground">
                        {categoryProgress.completed}/{categoryProgress.total} complete
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      categoryProgress.completed === categoryProgress.total
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {Math.round((categoryProgress.completed / categoryProgress.total) * 100)}%
                  </Badge>
                </div>

                <div className="space-y-2">
                  {feature.items.map((item, index) => {
                    const StatusIcon = statusIcons[item.status as keyof typeof statusIcons]
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted/50 transition-colors"
                      >
                        <StatusIcon
                          className={`h-4 w-4 flex-shrink-0 ${
                            statusColors[item.status as keyof typeof statusColors]
                          }`}
                        />
                        <span className="flex-1">{item.name}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Action Items */}
        <Card className="p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Action Required
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">1. Run Database Migrations</h3>
              <p className="text-sm text-muted-foreground">
                Execute the 4 migration files in your Supabase SQL Editor
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/QUICK_START.md" target="_blank">
                    View Guide
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    href="https://app.supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Supabase
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">2. Enable Realtime</h3>
              <p className="text-sm text-muted-foreground">
                Enable realtime replication on messages and credits_ledger tables
              </p>
              <Button size="sm" variant="outline" asChild>
                <Link href="/QUICK_START.md#step-3-enable-realtime" target="_blank">
                  Instructions
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">3. Deploy Edge Function (Optional)</h3>
              <p className="text-sm text-muted-foreground">
                Deploy validate-ai-response edge function for server-side validation
              </p>
              <Button size="sm" variant="outline" asChild>
                <Link href="/supabase/README.md#edge-functions" target="_blank">
                  Deployment Guide
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" asChild className="justify-start">
              <Link href="/QUICK_START.md" target="_blank">
                <FileText className="mr-2 h-4 w-4" />
                Quick Start Guide
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/IMPLEMENTATION_SUMMARY.md" target="_blank">
                <FileText className="mr-2 h-4 w-4" />
                Implementation Summary
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/supabase/README.md" target="_blank">
                <Database className="mr-2 h-4 w-4" />
                Database Documentation
              </Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link href="/scripts/run-migrations.md" target="_blank">
                <Code className="mr-2 h-4 w-4" />
                Migration Instructions
              </Link>
            </Button>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/setup">Go to Setup</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
