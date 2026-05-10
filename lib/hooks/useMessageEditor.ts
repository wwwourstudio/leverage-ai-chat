'use client';

import { useState, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { updateThread } from '@/lib/chat-service';

export interface UseMessageEditorOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMessages: Dispatch<SetStateAction<any[]>>;
  /** The currently active chat/thread ID — used for vote feedback and title sync. */
  activeChat: string;
  isLoggedIn: boolean;
  /** Callback to trigger AI re-generation after an edit or regenerate action. */
  generateResponse: (userMessage: string) => void;
  toast: { success: (msg: string) => void; error?: (msg: string) => void };
  /** Passed through so handleSaveChatTitle can optimistically update the list. */
  setChats: Dispatch<SetStateAction<any[]>>;
}

export function useMessageEditor({
  messages,
  setMessages,
  activeChat,
  isLoggedIn,
  generateResponse,
  toast,
  setChats,
}: UseMessageEditorOptions) {
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEditMessage = useCallback((index: number) => {
    const message = messages[index];
    if (message.role === 'user') {
      setEditingMessageIndex(index);
      setEditingContent(message.content);
    }
  }, [messages]);

  const handleSaveEdit = useCallback((index: number) => {
    if (editingContent.trim()) {
      setMessages((prev) => prev.map((msg, i) => {
        if (i === index) {
          return {
            ...msg,
            content: editingContent,
            editHistory: [
              ...(msg.editHistory || []),
              { content: msg.content, timestamp: msg.timestamp },
            ],
            timestamp: new Date(),
          };
        }
        return msg;
      }));
      setEditingMessageIndex(null);
      setEditingContent('');

      if (messages[index].role === 'user') {
        setMessages((prev) => prev.slice(0, index + 1));
        generateResponse(editingContent);
      }
    }
  }, [editingContent, messages, setMessages, generateResponse]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageIndex(null);
    setEditingContent('');
  }, []);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }, [toast]);

  const handleRegenerateResponse = useCallback((index: number) => {
    if (index > 0 && messages[index - 1].role === 'user') {
      const userMessage = messages[index - 1].content;
      setMessages((prev) => prev.slice(0, index));
      generateResponse(userMessage);
    }
  }, [messages, setMessages, generateResponse]);

  const handleVote = useCallback(async (index: number, direction: 'up' | 'down') => {
    setMessages((prev: any) => prev.map((m: any, i: any) =>
      i === index ? { ...m, voted: direction } : m
    ));
    toast.success(direction === 'up' ? 'Marked helpful — thanks!' : "Got it, we'll improve this");
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote: direction === 'up' ? 'helpful' : 'improve',
          messageExcerpt: messages[index]?.content?.slice(0, 500),
          sessionId: activeChat,
        }),
      });
    } catch {
      // Non-blocking — feedback is best-effort
    }
  }, [messages, activeChat, setMessages, toast]);

  const handleEditChatTitle = useCallback((chatId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingChatTitle(currentTitle);
  }, []);

  const handleSaveChatTitle = useCallback((chatId: string) => {
    if (editingChatTitle.trim()) {
      const newTitle = editingChatTitle.trim();
      setChats((prev: any[]) => prev.map((chat) =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      ));
      if (isLoggedIn) updateThread(chatId, { title: newTitle });
      toast.success('Chat renamed');
    }
    setEditingChatId(null);
    setEditingChatTitle('');
  }, [editingChatTitle, isLoggedIn, setChats, toast]);

  const handleCancelChatTitleEdit = useCallback(() => {
    setEditingChatId(null);
    setEditingChatTitle('');
  }, []);

  const handleKeyDownChatTitle = useCallback((e: React.KeyboardEvent, chatId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveChatTitle(chatId);
    } else if (e.key === 'Escape') {
      handleCancelChatTitleEdit();
    }
  }, [handleSaveChatTitle, handleCancelChatTitleEdit]);

  const adjustEditTextareaHeight = useCallback(() => {
    if (editTextareaRef.current) {
      requestAnimationFrame(() => {
        if (editTextareaRef.current) {
          editTextareaRef.current.style.height = 'auto';
          editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
        }
      });
    }
  }, []);

  return {
    editingMessageIndex,
    setEditingMessageIndex,
    editingContent,
    setEditingContent,
    editingChatId,
    editingChatTitle,
    setEditingChatTitle,
    editTextareaRef,
    handleEditMessage,
    handleSaveEdit,
    handleCancelEdit,
    handleCopyMessage,
    handleRegenerateResponse,
    handleVote,
    handleEditChatTitle,
    handleSaveChatTitle,
    handleCancelChatTitleEdit,
    handleKeyDownChatTitle,
    adjustEditTextareaHeight,
  };
}
