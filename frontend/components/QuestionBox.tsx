"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";

type QuestionBoxProps = {
  isAsking: boolean;
  onAsk: (question: string) => Promise<void>;
};

export function QuestionBox({ isAsking, onAsk }: QuestionBoxProps) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuestion = question.trim();

    if (!cleanQuestion) {
      setError("Enter a question before asking VERA.");
      return;
    }

    setError("");
    await onAsk(cleanQuestion);
  }

  return (
    <section className="panel soft-enter" aria-labelledby="question-heading">
      <h2 id="question-heading" className="text-lg font-semibold text-ink">
        Ask a question
      </h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="question">
            Question
          </label>
          <textarea
            className="min-h-32 w-full resize-y rounded-vera border border-line bg-white px-3 py-3 text-base leading-6 text-ink outline-none transition placeholder:text-muted hover:border-teal focus:border-teal focus:ring-2 focus:ring-teal"
            disabled={isAsking}
            id="question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What does this document say about the main risks?"
            value={question}
          />
        </div>

        {error ? (
          <div className="flex gap-2 rounded-vera border border-danger-line bg-danger-soft p-3 text-sm leading-6 text-danger" role="alert">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-vera bg-ink px-4 text-sm font-semibold text-white transition hover:bg-teal-strong focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isAsking}
          type="submit"
        >
          {isAsking ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Search aria-hidden="true" className="h-4 w-4" />
          )}
          {isAsking ? "Searching" : "Ask VERA"}
        </button>
      </form>
    </section>
  );
}
