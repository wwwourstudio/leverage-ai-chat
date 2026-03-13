/**
 * Chat export utilities.
 *
 * Provides Markdown and JSON export formats plus a browser download helper.
 * Import in client components only (uses window.URL / document APIs).
 */

export interface ExportMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  modelUsed?: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
}

export interface ExportChat {
  id: string;
  title: string;
  category?: string;
  createdAt?: Date | string;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatTimestamp(ts: Date | string): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

// ── Markdown export ───────────────────────────────────────────────────────────

/**
 * Convert a chat and its messages to a Markdown document.
 */
export function exportChatAsMarkdown(chat: ExportChat, messages: ExportMessage[]): string {
  const lines: string[] = [
    `# ${chat.title}`,
    '',
    `**Category:** ${chat.category ?? 'General'}  `,
    `**Exported:** ${new Date().toLocaleString()}  `,
    `**Messages:** ${messages.length}`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '**You**' : '**Leverage AI**';
    const ts = formatTimestamp(msg.timestamp);
    const header = ts ? `${roleLabel} — ${ts}` : roleLabel;
    if (msg.modelUsed && msg.role === 'assistant') {
      lines.push(`### ${header} *(${msg.modelUsed})*`);
    } else {
      lines.push(`### ${header}`);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    if (msg.tokenUsage) {
      lines.push(
        `*Tokens: ${msg.tokenUsage.promptTokens} prompt + ${msg.tokenUsage.completionTokens} completion = ${msg.tokenUsage.totalTokens} total*`,
      );
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  lines.push(`*Exported from Leverage AI on ${new Date().toLocaleDateString()}*`);
  return lines.join('\n');
}

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Serialize chat + messages as pretty-printed JSON.
 */
export function exportChatAsJSON(chat: ExportChat, messages: ExportMessage[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      chat,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        ...(m.modelUsed && { modelUsed: m.modelUsed }),
        ...(m.tokenUsage && { tokenUsage: m.tokenUsage }),
      })),
    },
    null,
    2,
  );
}

// ── Browser download helper ───────────────────────────────────────────────────

/**
 * Trigger a browser file download with the given content.
 * Safe to call only in client components (requires window/document).
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Build a safe filename from a chat title.
 */
export function chatFilename(title: string, ext: 'md' | 'json'): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'chat';
  const date = new Date().toISOString().slice(0, 10);
  return `leverage-ai-${safe}-${date}.${ext}`;
}
