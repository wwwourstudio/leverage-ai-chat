import type { ReactElement } from 'react';

interface Props {
  content: string;
}

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string };

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) tokens.push({ type: 'text', value: text.slice(last, match.index) });
    if (match[1] !== undefined)      tokens.push({ type: 'bold', value: match[1] });
    else if (match[2] !== undefined) tokens.push({ type: 'italic', value: match[2] });
    else if (match[3] !== undefined) tokens.push({ type: 'code', value: match[3] });
    else if (match[4] !== undefined) tokens.push({ type: 'link', value: match[4], href: match[5] });
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}

function Inline({ text }: { text: string }) {
  const tokens = parseInline(text);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'bold')   return <strong key={i} className="font-black text-white">{t.value}</strong>;
        if (t.type === 'italic') return <em key={i} className="italic text-foreground/90">{t.value}</em>;
        if (t.type === 'code')   return <code key={i} className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-emerald-300 text-[0.8em] font-mono">{t.value}</code>;
        if (t.type === 'link')   return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{t.value}</a>;
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}

export function MessageContent({ content }: Props) {
  const lines = content.split('\n');
  const blocks: ReactElement[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Unordered list
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+] /, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-none space-y-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--border-hover)] flex-shrink-0" />
              <span><Inline text={item} /></span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-none space-y-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2">
              <span className="min-w-[1.25rem] text-[var(--text-faint)] font-bold text-xs mt-0.5">{j + 1}.</span>
              <span><Inline text={item} /></span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph — join consecutive non-list, non-blank lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^[-*+] /.test(lines[i]) && !/^\d+\. /.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      blocks.push(
        <p key={key++}><Inline text={paraLines.join(' ')} /></p>,
      );
    }
  }

  return (
    <div className="text-sm leading-7 font-medium space-y-3">
      {blocks}
    </div>
  );
}
