export function TagList({ tags, className = "" }: { tags: string[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full px-2.5 py-1 text-xs text-muted ring-1 ring-line transition-colors hover:text-ink hover:ring-ink/30"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
