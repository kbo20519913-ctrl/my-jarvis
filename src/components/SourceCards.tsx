import { ExternalLink } from 'lucide-react'
import type { Source } from '../lib/types.ts'

export function SourceCards({ sources }: { sources: Source[] }) {
  if (!sources.length) return null
  return (
    <ul className="mt-4 grid gap-2 md:grid-cols-2">
      {sources.map((source) => (
        <li key={source.url} className="rounded-[12px] bg-panel p-3">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 text-sm text-paper hover:text-gold"
          >
            <ExternalLink size={14} className="mt-0.5 shrink-0 text-gold" strokeWidth={1.75} />
            <span>
              <span className="block font-medium">{source.title}</span>
              {source.snippet ? (
                <span className="mt-1 block text-[12px] text-mute">{source.snippet}</span>
              ) : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
