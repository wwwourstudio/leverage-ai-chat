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
            <div className="relative group/img rounded-xl overflow-hidden border border-gray-700/50 bg-gray-900/50">
              <img
                src={attachment.url || '/placeholder.svg'}
                alt={attachment.name}
                className="w-full max-w-xl rounded-xl"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover/img:opacity-100 transition-opacity">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-300">{attachment.name}</span>
                  <span className="text-xs text-gray-500 ml-auto">{(attachment.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            </div>
          )}

          {attachment.type === 'csv' && attachment.data && (
            <div className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/50 border-b border-gray-700/50">
                <FileText className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-gray-300">{attachment.name}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {attachment.data.rows.length} rows × {attachment.data.headers.length} columns
                </span>
              </div>
              <div className="overflow-x-auto max-h-96 custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-800/80 backdrop-blur-sm">
                    <tr>
                      {attachment.data.headers.map((header, idx) => (
                        <th key={`hdr-${idx}-${header}`} className="px-4 py-2.5 text-left font-bold text-gray-300 border-b border-gray-700/50">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {attachment.data.rows.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-800/30 transition-colors border-b border-gray-800/30">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2.5 text-gray-400 font-medium">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attachment.data.rows.length > 100 && (
                  <div className="px-4 py-3 bg-gray-800/30 text-center">
                    <span className="text-xs text-gray-500">
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
