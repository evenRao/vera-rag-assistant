import { FileText, Loader2 } from "lucide-react";

export type SourceSnippet = {
  content: string;
  metadata: {
    filename: string;
    chunk_id: number;
    relevance_score?: number | null;
  };
};

type SourceListProps = {
  hasEvidence: boolean;
  isLoading: boolean;
  sources: SourceSnippet[];
};

const MAX_SNIPPET_LENGTH = 1000;

export function SourceList({ hasEvidence, isLoading, sources }: SourceListProps) {
  const visibleSources = hasEvidence ? sources : [];

  return (
    <section aria-labelledby="sources-heading" className="soft-enter">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal">Evidence</p>
          <h2 id="sources-heading" className="mt-1 text-2xl font-semibold text-ink">
            Source snippets
          </h2>
        </div>
        <span className="rounded-vera border border-line bg-surface px-3 py-1 text-sm font-medium text-muted">
          {visibleSources.length} {visibleSources.length === 1 ? "source" : "sources"}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {isLoading ? (
          <div className="flex min-h-24 items-center gap-3 rounded-vera border border-line bg-surface p-4 text-sm text-muted shadow-soft" role="status">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-teal" />
            <span>Collecting relevant source snippets.</span>
          </div>
        ) : null}

        {!isLoading && visibleSources.length === 0 ? (
          <div className="rounded-vera border border-dashed border-line bg-surface p-5 text-sm leading-6 text-muted">
            No relevant sources found.
          </div>
        ) : null}

        {!isLoading
          ? visibleSources.map((source, index) => (
              <article
                className="rounded-vera border border-line bg-surface p-4 shadow-soft"
                key={`${source.metadata.filename}-${source.metadata.chunk_id}-${index}`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex min-h-8 items-center gap-2 rounded-vera bg-teal-soft px-3 font-semibold text-teal">
                    <FileText aria-hidden="true" className="h-4 w-4" />
                    {source.metadata.filename}
                  </span>
                  <span className="inline-flex min-h-8 items-center rounded-vera bg-amber-soft px-3 font-medium text-amber">
                    Chunk {source.metadata.chunk_id}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-ink">
                  {formatSnippet(source.content)}
                </p>
              </article>
            ))
          : null}
      </div>
    </section>
  );
}

function formatSnippet(content: string) {
  const cleanContent = content.trim();

  if (cleanContent.length <= MAX_SNIPPET_LENGTH) {
    return cleanContent;
  }

  return `${cleanContent.slice(0, MAX_SNIPPET_LENGTH).trimEnd()}...`;
}
