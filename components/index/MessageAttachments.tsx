import { ImageIcon, FileText } from 'lucide-react';

interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  url: string;
  size: number;
  data?: { headers: string[]; rows: string[][] } | null;
}

interface Props {
  attachments: Attachment[];
}

/**
 * Renders file attachments (images and CSV tables) inside a chat message.
 */
export function MessageAttachments({ attachments }: Props) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {attachments.map((attachment) => (
        <div key={attachment.id}>
          {attachment.type === 'image' && (
            <div className="relative group/img rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
              <img
                src={attachment.url || '/placeholder.svg'}
                alt={attachment.name}
                className="w-full max-w-xl rounded-xl"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover/img:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-xs font-bold text-foreground/80">{attachment.name}</span>
                  <span className="text-xs text-[var(--text-faint)] ml-auto">{(attachment.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          )}

          {attachment.type === 'csv' && attachment.data && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-overlay)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                <FileText className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-foreground/80">{attachment.name}</span>
                <span className="text-xs text-[var(--text-faint)] ml-auto">
                  {attachment.data.rows.length} rows × {attachment.data.headers.length} columns
                </span>
              </div>
              <div className="overflow-x-auto max-h-96 custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-elevated)] backdrop-blur-sm">
                    <tr>
                      {attachment.data.headers.map((header, idx) => (
                        <th key={`hdr-${idx}-${header}`} className="px-4 py-2.5 text-left font-bold text-foreground/80 border-b border-[var(--border-subtle)]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attachment.data.rows.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-[var(--bg-elevated)] transition-colors border-b border-[var(--border-subtle)]">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2.5 text-[var(--text-muted)] font-medium">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attachment.data.rows.length > 100 && (
                  <div className="px-4 py-3 bg-[var(--bg-elevated)] text-center">
                    <span className="text-xs text-[var(--text-faint)]">
                      Showing first 100 rows of {attachment.data.rows.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
