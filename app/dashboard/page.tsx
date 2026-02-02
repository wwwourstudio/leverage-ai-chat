import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditsBalance } from '@/components/credits-display'
import { TrustBadge } from '@/components/trust-badge'
import { ChatCategoryBadge } from '@/components/chat-category-selector'
import {
  TrendingUp,
  MessageSquare,
  Target,
  Zap,
  BarChart3,
  Calendar,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'

// Mock data - replace with real data from server actions
const mockData = {
  user: {
    name: 'Sports Bettor',
    credits: 850,
    totalPurchased: 1000,
    totalSpent: 150,
  },
  stats: {
    totalChats: 24,
    totalMessages: 156,
    avgTrustScore: 0.8625,
    activeBets: 8,
  },
  recentChats: [
    {
      id: '1',
      title: 'NBA Lakers vs Celtics Analysis',
      category: 'betting' as const,
      lastMessage: '2 hours ago',
      trustScore: 0.92,
    },
    {
      id: '2',
      title: 'Week 18 Fantasy Football Lineup',
      category: 'fantasy' as const,
      lastMessage: '5 hours ago',
      trustScore: 0.87,
    },
    {
      id: '3',
      title: 'DFS NBA Showdown Slate',
      category: 'dfs' as const,
      lastMessage: '1 day ago',
      trustScore: 0.81,
    },
  ],
  portfolio: {
    totalValue: 2450.0,
    totalPnL: 325.0,
    openPositions: 8,
    winRate: 62.5,
  },
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {mockData.user.name}
            </p>
          </div>
          <Button asChild>
            <Link href="/">
              <MessageSquare className="mr-2 h-4 w-4" />
              New Chat
            </Link>
          </Button>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Credits Balance
              </CardTitle>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <CreditsBalance balance={mockData.user.credits} />
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div>
                  <span className="text-green-600">+{mockData.user.totalPurchased}</span>{' '}
                  purchased
                </div>
                <div>
                  <span className="text-red-600">-{mockData.user.totalSpent}</span> spent
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Portfolio Value
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  ${mockData.portfolio.totalValue.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-semibold">
                  +${mockData.portfolio.totalPnL.toFixed(0)}
                </span>
                <span className="text-muted-foreground text-xs">
                  ({((mockData.portfolio.totalPnL / (mockData.portfolio.totalValue - mockData.portfolio.totalPnL)) * 100).toFixed(1)}%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Trust Score
              </CardTitle>
              <Target className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-3xl font-bold">
                  {Math.round(mockData.stats.avgTrustScore * 100)}%
                </div>
                <TrustBadge
                  trustScore={mockData.stats.avgTrustScore}
                  confidenceLevel="high"
                  size="sm"
                  showLabel={false}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win Rate
              </CardTitle>
              <Trophy className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {mockData.portfolio.winRate}%
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {mockData.portfolio.openPositions} open positions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Chats */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Chats</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.recentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <ChatCategoryBadge category={chat.category} />
                        <TrustBadge
                          trustScore={chat.trustScore}
                          confidenceLevel={
                            chat.trustScore >= 0.9
                              ? 'very_high'
                              : chat.trustScore >= 0.8
                              ? 'high'
                              : 'medium'
                          }
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                      <h3 className="font-medium">{chat.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" asChild>
                <Link href="/?category=betting">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  New Betting Analysis
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/?category=fantasy">
                  <Trophy className="mr-2 h-4 w-4" />
                  Fantasy Lineup Help
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/?category=dfs">
                  <Target className="mr-2 h-4 w-4" />
                  DFS Optimizer
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/?category=kalshi">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Kalshi Markets
                </Link>
              </Button>

              <div className="pt-4 border-t">
                <Button className="w-full" variant="secondary" asChild>
                  <Link href="/setup">
                    <Calendar className="mr-2 h-4 w-4" />
                    Setup & Verify
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Chats</p>
                <p className="text-2xl font-bold">{mockData.stats.totalChats}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Messages</p>
                <p className="text-2xl font-bold">{mockData.stats.totalMessages}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Active Bets</p>
                <p className="text-2xl font-bold">{mockData.stats.activeBets}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Credits Spent</p>
                <p className="text-2xl font-bold">{mockData.user.totalSpent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
