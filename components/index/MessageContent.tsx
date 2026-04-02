interface Props {
  content: string;
}

/**
 * Renders a plain assistant message with paragraph and inline-bold support.
 * Paragraphs are split on double newlines; **text** tokens are bolded.
 */
export function MessageContent({ content }: Props) {
  return (
    <div className="text-sm leading-relaxed font-medium space-y-3">
      {content.split('\n\n').map((paragraph, pIdx) => {
        // Paragraph with bullet-style bold lines
        if (paragraph.includes('\n**') && paragraph.includes('**')) {
          const lines = paragraph.split('\n');
          return (
            <div key={`p-${pIdx}-${paragraph.slice(0, 12)}`} className="space-y-2">
              {lines.map((line, lIdx) => {
                if (line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <div key={`l-${lIdx}-${line.slice(0, 12)}`} className="flex items-start gap-2">
                      {parts.map((part, partIdx) => {
                        if (partIdx % 2 === 1) {
                          return <span key={partIdx} className="font-black text-white">{part}</span>;
                        } else if (part.trim()) {
                          return <span key={partIdx} className="text-foreground/80">{part}</span>;
                        }
                        return null;
                      })}
                    </div>
                  );
                }
                return <div key={`l-${lIdx}-${line.slice(0, 12)}`}>{line}</div>;
              })}
            </div>
          );
        }

        // Regular paragraph with inline bold support
        if (paragraph.includes('**')) {
          const parts = paragraph.split('**');
          return (
            <p key={`p-${pIdx}-${paragraph.slice(0, 12)}`}>
              {parts.map((part, partIdx) => {
                if (partIdx % 2 === 1) {
                  return <span key={`b-${partIdx}`} className="font-black text-white">{part}</span>;
                }
                return <span key={`s-${partIdx}`}>{part}</span>;
              })}
            </p>
          );
        }

        return <p key={`p-${pIdx}-${paragraph.slice(0, 12)}`}>{paragraph}</p>;
      })}
    </div>
  );
}
