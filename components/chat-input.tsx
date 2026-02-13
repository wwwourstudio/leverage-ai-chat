'use client';

import { Send, Paperclip, X, FileText, ImageIcon } from 'lucide-react';
import { useRef } from 'react';

interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

interface ChatInputProps {
  input: string;
  isTyping: boolean;
  uploadedFiles: FileAttachment[];
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemoveAttachment: (id: string) => void;
}

export function ChatInput({
  input,
  isTyping,
  uploadedFiles,
  onInputChange,
  onSubmit,
  onFileUpload,
  onRemoveAttachment
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t border-gray-800/50 bg-gray-900/80 backdrop-blur-xl p-4">
      {uploadedFiles.length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-2 bg-gray-800/60 px-3 py-2 rounded-lg">
              {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-gray-400" />}
              <span className="text-sm text-gray-300">{file.name}</span>
              <button onClick={() => onRemoveAttachment(file.id)} className="text-gray-400 hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={onSubmit} className="flex gap-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileUpload}
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.tsv,text/tab-separated-values"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-3 bg-gray-800/60 text-gray-300 rounded-xl hover:bg-gray-700/60 transition-all duration-200 flex items-center gap-2 border border-gray-700/50"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask about betting, fantasy, DFS, or prediction markets..."
          disabled={isTyping}
          className="flex-1 px-5 py-3 bg-gray-800/60 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 border border-gray-700/50 placeholder-gray-500"
        />
        
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      </form>
    </div>
  );
}
