"use client";

import { useState } from "react";
import { Database, FileText, Layers3, MessageSquareText, Search } from "lucide-react";

import { AnswerCard } from "../components/AnswerCard";
import { FileUpload, type UploadResult } from "../components/FileUpload";
import { QuestionBox } from "../components/QuestionBox";
import { SourceList, type SourceSnippet } from "../components/SourceList";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type AskResponse = {
  answer: string;
  sources: SourceSnippet[];
  has_evidence: boolean;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data?.detail === "string"
        ? data.detail
        : "The request failed. Check that the backend is running.";
    throw new Error(message);
  }

  return data as T;
}

export default function Home() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [answerResult, setAnswerResult] = useState<AskResponse | null>(null);
  const [askError, setAskError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadError("");

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await parseApiResponse<UploadResult>(response);
      setUploadResult(data);
      setAnswerResult(null);
      setAskError("");
    } catch (error) {
      setUploadResult(null);
      setUploadError(error instanceof Error ? error.message : "Unable to upload document.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAsk(question: string) {
    setIsAsking(true);
    setAskError("");

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });
      const data = await parseApiResponse<AskResponse>(response);
      setAnswerResult(data);
    } catch (error) {
      setAnswerResult(null);
      setAskError(error instanceof Error ? error.message : "Unable to answer question.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="min-h-dvh bg-paper px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="grid gap-5 border-b border-line pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-teal">Vector Evidence Retrieval Assistant</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              VERA
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              Upload documents, ask questions, and get source-backed answers.
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[460px]"
            aria-label="VERA retrieval workflow"
          >
            <WorkflowStep icon={FileText} label="Upload" />
            <WorkflowStep icon={Layers3} label="Chunk" />
            <WorkflowStep icon={Database} label="Index" />
            <WorkflowStep icon={Search} label="Retrieve" />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="flex flex-col gap-4">
            <FileUpload
              error={uploadError}
              isUploading={isUploading}
              onUpload={handleUpload}
              uploadResult={uploadResult}
            />
            <QuestionBox isAsking={isAsking} onAsk={handleAsk} />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <AnswerCard answer={answerResult?.answer ?? ""} error={askError} isLoading={isAsking} />
            <SourceList
              hasEvidence={answerResult?.has_evidence ?? false}
              isLoading={isAsking}
              sources={answerResult?.sources ?? []}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function WorkflowStep({
  icon: Icon,
  label,
}: {
  icon: typeof MessageSquareText;
  label: string;
}) {
  return (
    <div className="flex min-h-20 flex-col justify-between rounded-vera border border-line bg-surface p-3 shadow-soft">
      <Icon aria-hidden="true" className="h-5 w-5 text-teal" strokeWidth={2} />
      <span className="text-sm font-medium text-ink">{label}</span>
    </div>
  );
}
