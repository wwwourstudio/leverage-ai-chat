'use client';

import { TrustMetricsDisplay } from '@/components/trust-metrics-display';
import { Shield, Copy, Edit3, CheckCheck, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
  trustMetrics?: any;
  sources?: any[];
  modelUsed?: string;
  processingTime?: number;
}

interface ChatMessageProps {
  message: Message;
  onEdit?: (content: string) => void;
  onCopy?: () => void;
}

export function ChatMessage({ message, onEdit, onCopy }: ChatMessageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);

  const handleSaveEdit = () => {
    onEdit?.(editContent);
    setIsEditing(false);
  };

  return (
    <div className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl ${message.role === 'user' ? 'order-2' : ''}`}>
        <div className={`rounded-2xl px-5 py-4 ${
          message.role === 'user' 
            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
            : 'bg-gradient-to-br from-gray-900/95 via-gray-850/95 to-gray-900/95 border border-gray-700/60'
        }`}>
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.role === 'assistant' && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {message.confidence && (
                      <span>Confidence: {message.confidence}%</span>
                    )}
                    {message.modelUsed && (
                      <span>Model: {message.modelUsed}</span>
                    )}
                    {message.processingTime && (
                      <span>{message.processingTime}ms</span>
                    )}
                    <button
                      onClick={onCopy}
                      className="ml-auto flex items-center gap-1 hover:text-blue-400 transition"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 hover:text-blue-400 transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                  </div>

                  {message.trustMetrics && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-blue-400 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        AI Trust & Integrity
                      </summary>
                      <div className="mt-3">
                        <TrustMetricsDisplay metrics={message.trustMetrics} showDetails={true} />
                      </div>
                    </details>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
