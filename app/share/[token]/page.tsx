import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

interface SharedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  model_used?: string | null;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from('chat_threads')
    .select('title')
    .eq('share_token', token)
    .eq('is_public', true)
    .single();

  return {
    title: thread?.title ? `${thread.title} — Leverage AI` : 'Shared Chat — Leverage AI',
    description: 'A shared Leverage AI sports intelligence conversation',
  };
}

export default async function SharedChatPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  // Load the shared thread
  const { data: thread, error: threadError } = await supabase
    .from('chat_threads')
    .select('id, title, category, created_at')
    .eq('share_token', token)
    .eq('is_public', true)
    .single();

  if (threadError || !thread) {
    notFound();
  }

  // Load messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at, model_used')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(100);

  const msgs: SharedMessage[] = messages ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/90 backdrop-blur-xl border-b border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">{thread.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Shared from{' '}
              <span className="text-blue-400 font-semibold">Leverage AI</span>
              {' · '}
              {new Date(thread.created_at).toLocaleDateString()}
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all"
          >
            Try Leverage AI
          </a>
        </div>
      </div>

      {/* Message list */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {msgs.length === 0 && (
          <p className="text-center text-gray-500 py-12">This conversation has no messages.</p>
        )}

        {msgs.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-md">
                AI
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'bg-gray-900 border border-gray-800 text-slate-100'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-gray-500">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'assistant' && msg.model_used && (
                  <span className="text-[10px] text-gray-600">{msg.model_used}</span>
                )}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                U
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA footer */}
      <div className="max-w-3xl mx-auto px-4 pb-12 pt-4 text-center">
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/20 rounded-2xl p-6">
          <p className="text-gray-300 text-sm mb-4">
            Get live odds, AI analysis, and sports intelligence with Leverage AI
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg"
          >
            Start for Free
          </a>
        </div>
      </div>
    </div>
  );
}
