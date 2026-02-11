'use client';

import { Star, Plus, MessageSquare, Trash2, Edit3, CheckCheck, X } from 'lucide-react';

interface Chat {
  id: string;
  title: string;
  messages: number;
  lastMessage: string;
  starred: boolean;
  timestamp: Date;
}

interface ChatSidebarProps {
  chats: Chat[];
  activeChat: string;
  editingChatId: string | null;
  editingChatTitle: string;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onStarChat: (chatId: string, e: React.MouseEvent) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onEditChatTitle: (chatId: string, currentTitle: string, e: React.MouseEvent) => void;
  onSaveChatTitle: (chatId: string) => void;
  onCancelChatTitleEdit: () => void;
  setEditingChatTitle: (title: string) => void;
}

export function ChatSidebar({
  chats,
  activeChat,
  editingChatId,
  editingChatTitle,
  onSelectChat,
  onNewChat,
  onStarChat,
  onDeleteChat,
  onEditChatTitle,
  onSaveChatTitle,
  onCancelChatTitleEdit,
  setEditingChatTitle
}: ChatSidebarProps) {
  return (
    <div className="w-80 border-r border-gray-800/50 bg-gradient-to-b from-gray-900/95 to-gray-950/95 backdrop-blur-xl flex flex-col">
      <div className="p-4 border-b border-gray-800/50">
        <button
          onClick={onNewChat}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`group p-3 rounded-xl cursor-pointer transition-all duration-200 ${
              activeChat === chat.id
                ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30'
                : 'hover:bg-gray-800/40'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              {editingChatId === chat.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editingChatTitle}
                    onChange={(e) => setEditingChatTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveChatTitle(chat.id);
                      if (e.key === 'Escape') onCancelChatTitleEdit();
                    }}
                    className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-sm"
                    autoFocus
                  />
                  <button onClick={() => onSaveChatTitle(chat.id)} className="text-green-400 hover:text-green-300">
                    <CheckCheck className="w-4 h-4" />
                  </button>
                  <button onClick={onCancelChatTitleEdit} className="text-gray-400 hover:text-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-semibold text-white text-sm truncate">{chat.title}</span>
                  <button
                    onClick={(e) => onEditChatTitle(chat.id, chat.title, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={(e) => onStarChat(chat.id, e)}
                  className={`transition-colors ${chat.starred ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}`}
                >
                  <Star className="w-4 h-4" fill={chat.starred ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={(e) => onDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
            <p className="text-xs text-gray-500 mt-1">{chat.messages} messages</p>
          </div>
        ))}
      </div>
    </div>
  );
}
