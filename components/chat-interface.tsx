'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateAIResponse } from '@/app/actions/ai'
import { createChat, getUserChats, addMessage, getChatMessages } from '@/app/actions/chat'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  Send,
  Menu,
  Plus,
  MessageSquare,
  Star,
  Trash2,
  Zap,
  LogOut,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { readStreamableValue } from '@ai-sdk/rsc'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  trust_score?: number
}

interface Chat {
  id: string
  title: string
  created_at: string
  user_id: string
}

interface User {
  id: string
  email: string
  displayName: string
  credits: number
  tier: string
}

export default function ChatInterface({
  user,
  initialChats,
  migrationsNeeded = false,
}: {
  user: User
  initialChats: Chat[]
  migrationsNeeded?: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>(initialChats)
  const [credits, setCredits] = useState(user.credits)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Subscribe to real-time messages for active chat
  useEffect(() => {
    if (!activeChat) return

    const channel = supabase
      .channel(`messages:${activeChat}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${activeChat}`,
        },
        (payload) => {
          console.log('[v0] New message received:', payload)
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeChat, supabase])

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat) return

    async function loadMessages() {
      const chatMessages = await getChatMessages(activeChat!)
      setMessages(chatMessages as Message[])
    }

    loadMessages()
  }, [activeChat])

  // Subscribe to real-time credit updates
  useEffect(() => {
    const channel = supabase
      .channel(`user:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[v0] Credits updated:', payload)
          const newUser = payload.new as { credits_balance: number }
          setCredits(newUser.credits_balance)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, supabase])

  async function handleCreateChat() {
    const newChat = await createChat(user.id, 'New Chat')
    setChats((prev) => [newChat, ...prev])
    setActiveChat(newChat.id)
    setMessages([])
  }

  async function handleDeleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const { error } = await supabase.from('chats').delete().eq('id', chatId)
    if (!error) {
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      if (activeChat === chatId) {
        setActiveChat(null)
        setMessages([])
      }
    }
  }

  async function handleSend() {
    if (!input.trim() || isTyping || !activeChat) return

    const userMessage = input.trim()
    setInput('')

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMessage])

    // Save user message to database
    await addMessage(activeChat, user.id, 'user', userMessage)

    setIsTyping(true)

    try {
      // Call AI generation with streaming
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const { stream } = await generateAIResponse(
        activeChat,
        user.id,
        userMessage,
        conversationHistory
      )

      // Create temporary assistant message
      const tempAssistantMessage: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, tempAssistantMessage])

      // Stream the response
      for await (const delta of readStreamableValue(stream)) {
        setMessages((prev) => {
          const updated = [...prev]
          const lastMessage = updated[updated.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content += delta
          }
          return updated
        })
      }
    } catch (error) {
      console.error('[v0] Error generating response:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content:
          error instanceof Error ? error.message : 'An error occurred. Please try again.',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } border-r border-border transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Leverage AI</h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <Button onClick={handleCreateChat} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chats.map((chat) => (
            <Card
              key={chat.id}
              className={`p-3 cursor-pointer hover:bg-accent transition-colors ${
                activeChat === chat.id ? 'bg-accent' : ''
              }`}
              onClick={() => setActiveChat(chat.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="font-medium text-sm truncate">{chat.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(chat.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Credits</span>
            </div>
            <span className="text-sm font-bold">{credits}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSignOut}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-4 flex items-center justify-between">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Sports AI Assistant</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="font-medium">{credits} credits</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {migrationsNeeded && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 p-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Database Setup Required
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    The database tables have not been created yet. Please run the migrations to enable full functionality.
                  </p>
                  <div className="space-y-2 text-sm text-yellow-900 dark:text-yellow-100">
                    <p className="font-medium">Quick Setup (5 minutes):</p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Open your Supabase Dashboard → SQL Editor</li>
                      <li>Copy and run each migration file from <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">/supabase/migrations/</code></li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm"
                    asChild
                    className="mt-2"
                  >
                    <a 
                      href="https://app.supabase.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Open Supabase Dashboard
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">Welcome to Leverage AI</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Your premium AI assistant for sports betting, fantasy sports, and prediction
                markets. Start a new chat to get expert insights.
              </p>
              <Button onClick={handleCreateChat} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Start New Chat
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Start the conversation...</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-2xl p-4 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.trust_score && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs">
                      {message.trust_score >= 80 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span>Trust Score: {message.trust_score}%</span>
                    </div>
                  )}
                </Card>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <Card className="max-w-2xl p-4 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Generating response...</span>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeChat && (
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={
                  credits > 0
                    ? 'Ask about odds, lineups, or predictions...'
                    : 'Insufficient credits. Please purchase more.'
                }
                disabled={isTyping || credits === 0}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isTyping || !input.trim() || credits === 0}>
                {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {credits < 10 && (
              <p className="text-xs text-yellow-600 mt-2">
                Low credits warning: {credits} remaining
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
