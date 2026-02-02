'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatCategoryBadge } from '@/components/chat-category-selector'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Plus,
  Search,
  Star,
  Archive,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ChatCategory = 'betting' | 'fantasy' | 'dfs' | 'kalshi' | 'general'

interface Chat {
  id: string
  title: string
  category: ChatCategory
  isStarred: boolean
  lastMessageAt: Date
  messageCount: number
  preview?: string
}

interface ChatSidebarProps {
  chats: Chat[]
  activeChat?: string
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
  onToggleStar?: (chatId: string) => void
  onArchive?: (chatId: string) => void
  onDelete?: (chatId: string) => void
}

export function ChatSidebar({
  chats,
  activeChat,
  onChatSelect,
  onNewChat,
  onToggleStar,
  onArchive,
  onDelete,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'starred'>('all')

  const filteredChats = chats.filter((chat) => {
    const matchesSearch =
      chat.title.toLowerCase().includes(search.toLowerCase()) ||
      chat.preview?.toLowerCase().includes(search.toLowerCase())

    const matchesFilter = filter === 'all' || (filter === 'starred' && chat.isStarred)

    return matchesSearch && matchesFilter
  })

  const sortedChats = [...filteredChats].sort(
    (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
  )

  return (
    <div className="flex flex-col h-full border-r bg-muted/30">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Chats</h2>
          <Button size="icon" variant="ghost" onClick={onNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="flex-1"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === 'starred' ? 'default' : 'outline'}
            onClick={() => setFilter('starred')}
            className="flex-1"
          >
            <Star className="h-3 w-3 mr-1" />
            Starred
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedChats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No chats found</p>
              {search && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setSearch('')}
                  className="mt-2"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            sortedChats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChat === chat.id}
                onSelect={() => onChatSelect(chat.id)}
                onToggleStar={onToggleStar}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface ChatItemProps {
  chat: Chat
  isActive: boolean
  onSelect: () => void
  onToggleStar?: (chatId: string) => void
  onArchive?: (chatId: string) => void
  onDelete?: (chatId: string) => void
}

function ChatItem({
  chat,
  isActive,
  onSelect,
  onToggleStar,
  onArchive,
  onDelete,
}: ChatItemProps) {
  const timeSince = Date.now() - chat.lastMessageAt.getTime()
  const minutesAgo = Math.floor(timeSince / 60000)
  const hoursAgo = Math.floor(minutesAgo / 60)
  const daysAgo = Math.floor(hoursAgo / 24)

  const timeString =
    daysAgo > 0
      ? `${daysAgo}d ago`
      : hoursAgo > 0
      ? `${hoursAgo}h ago`
      : minutesAgo > 0
      ? `${minutesAgo}m ago`
      : 'Just now'

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-colors group',
        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary',
        isActive && 'bg-muted shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChatCategoryBadge category={chat.category} />
          {chat.isStarred && (
            <Star className="h-3 w-3 fill-amber-500 text-amber-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{timeString}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onToggleStar && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleStar(chat.id)
                  }}
                >
                  <Star className="h-4 w-4 mr-2" />
                  {chat.isStarred ? 'Unstar' : 'Star'}
                </DropdownMenuItem>
              )}
              {onArchive && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onArchive(chat.id)
                  }}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(chat.id)
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <h3 className="font-medium text-sm mb-1 truncate">{chat.title}</h3>

      {chat.preview && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {chat.preview}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-muted-foreground">
          {chat.messageCount} {chat.messageCount === 1 ? 'message' : 'messages'}
        </span>
      </div>
    </button>
  )
}
