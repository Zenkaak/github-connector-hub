/**
 * ProseText — renders user-submitted long text as proper paragraphs.
 * Splits on double-newlines first; if the text is one big blob, splits on
 * sentence boundaries into paragraphs of ~2-3 sentences for readability.
 */
interface Props {
  text?: string | null;
  className?: string;
}

export function ProseText({ text, className = '' }: Props) {
  if (!text) return null;

  const trimmed = text.trim();
  let paragraphs: string[] = [];

  // 1. Honor explicit paragraph breaks
  const explicit = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (explicit.length > 1) {
    paragraphs = explicit;
  } else if (trimmed.length > 280) {
    // 2. One blob — split into sentences and group every 2-3 sentences
    const sentences = trimmed.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trimmed];
    const cleaned = sentences.map((s) => s.trim()).filter(Boolean);
    const groupSize = cleaned.length > 6 ? 3 : 2;
    for (let i = 0; i < cleaned.length; i += groupSize) {
      paragraphs.push(cleaned.slice(i, i + groupSize).join(' '));
    }
  } else {
    paragraphs = [trimmed];
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {paragraphs.map((p, i) => (
        <p key={i} className="leading-relaxed whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
