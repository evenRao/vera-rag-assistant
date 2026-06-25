import { AlertCircle, Loader2, MessageSquareText } from "lucide-react";

type AnswerCardProps = {
  answer: string;
  error: string;
  isLoading: boolean;
};

export function AnswerCard({ answer, error, isLoading }: AnswerCardProps) {
  return (
    <section className="panel min-h-[260px] soft-enter" aria-labelledby="answer-heading">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="text-sm font-semibold text-teal">Answer</p>
          <h2 id="answer-heading" className="mt-1 text-2xl font-semibold text-ink">
            Source-grounded response
          </h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-vera bg-amber-soft text-amber">
          <MessageSquareText aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-vera border border-line bg-paper p-4 text-sm text-muted" role="status">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-teal" />
            <span>Retrieving evidence and generating an answer.</span>
          </div>
        ) : null}

        {error && !isLoading ? (
          <div className="flex gap-2 rounded-vera border border-danger-line bg-danger-soft p-4 text-sm leading-6 text-danger" role="alert">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {answer && !isLoading ? (
          <p className="whitespace-pre-wrap break-words text-base leading-8 text-ink">{answer}</p>
        ) : null}

        {!answer && !error && !isLoading ? (
          <div className="rounded-vera border border-dashed border-line bg-paper p-5 text-sm leading-6 text-muted">
            Answers will appear here after you upload a document and ask a question.
          </div>
        ) : null}
      </div>
    </section>
  );
}
