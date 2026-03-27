'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  id: string;
  manager: string;
  text: string;
  timestamp: string;
}

interface Props {
  managers: string[];
}

const MANAGER_COLORS: Record<string, string> = {};
const COLOR_POOL = [
  'text-amber-400',
  'text-blue-400',
  'text-emerald-400',
  'text-purple-400',
  'text-rose-400',
  'text-cyan-400',
  'text-orange-400',
  'text-pink-400',
  'text-teal-400',
  'text-yellow-300',
];

function getManagerColor(manager: string): string {
  if (!MANAGER_COLORS[manager]) {
    const idx = Object.keys(MANAGER_COLORS).length % COLOR_POOL.length;
    MANAGER_COLORS[manager] = COLOR_POOL[idx];
  }
  return MANAGER_COLORS[manager];
}

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TrashTalkBoard({ managers }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      if (Array.isArray(data)) setMessages(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    // Refresh every 30 seconds
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleSend = async () => {
    if (!selectedManager || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager: selectedManager, text: text.trim() }),
      });
      if (res.ok) {
        setText('');
        loadMessages();
      }
    } catch {
      // ignore
    }
    setSending(false);
  };

  return (
    <div className="bg-dinger-card border border-dinger-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dinger-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗣️</span>
          <h3 className="font-display text-xl text-dinger-text-bright tracking-tight">
            TRASH TALK
          </h3>
        </div>
        <span className="text-xs font-mono text-dinger-muted">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Compose area */}
      <div className="p-4 border-b border-dinger-border bg-dinger-bg/30">
        <div className="flex gap-2 mb-2">
          <select
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            className="admin-input text-sm flex-shrink-0"
          >
            <option value="">Who are you?</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              selectedManager
                ? 'Talk your smack... (280 chars max)'
                : 'Select your name first'
            }
            disabled={!selectedManager}
            maxLength={280}
            className="admin-input flex-1 text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!selectedManager || !text.trim() || sending}
            className="admin-btn text-sm px-4 shrink-0"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        {text.length > 200 && (
          <p className="text-xs text-dinger-muted mt-1 text-right font-mono">
            {280 - text.length} chars left
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-dinger-muted text-sm font-mono animate-pulse">
            Loading messages...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-2xl mb-2">🦗</p>
            <p className="text-sm text-dinger-muted">
              Nobody&apos;s talking smack yet. Be the first.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className="px-4 sm:px-6 py-3 border-b border-dinger-border/30 hover:bg-dinger-bg/20 transition-colors"
          >
            <div className="flex items-baseline gap-2 mb-0.5">
              <span
                className={`font-body font-bold text-sm ${getManagerColor(
                  msg.manager
                )}`}
              >
                {msg.manager}
              </span>
              <span className="text-xs font-mono text-dinger-muted">
                {timeAgo(msg.timestamp)}
              </span>
            </div>
            <p className="font-body text-sm text-dinger-text leading-relaxed">
              {msg.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
