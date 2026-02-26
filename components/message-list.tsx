'use client';

import { Sparkles, User } from 'lucide-react';
import { TrustMetricsBadge } from './trust-metrics-display';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  trustMetrics?: any;
  cards?: any[];
}

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
}

export function MessageList({ messages, isTyping }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={`flex gap-4 animate-fade-in-up ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          style={{ animationDelay: `${index * 40}ms` }}
        >
          {message.role === 'assistant' && (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          )}
          
          <div
            className={`max-w-3xl rounded-2xl px-5 py-4 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'bg-[oklch(0.13_0.015_280)] border border-[oklch(0.25_0.02_280)] text-slate-100 shadow-sm'
            }`}
          >
            <div className="prose prose-invert max-w-none">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
            
            {message.role === 'assistant' && message.trustMetrics && (
              <div className="mt-3 pt-3 border-t border-slate-700">
                <TrustMetricsBadge metrics={message.trustMetrics} />
              </div>
            )}
          </div>

          {message.role === 'user' && (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-slate-300" />
            </div>
          )}
        </div>
      ))}

      {isTyping && (
        <div className="flex gap-4 justify-start">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="bg-[oklch(0.13_0.015_280)] border border-[oklch(0.25_0.02_280)] rounded-2xl px-5 py-4">
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce shadow-sm shadow-blue-400/40" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce shadow-sm shadow-purple-400/40" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce shadow-sm shadow-indigo-400/40" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
