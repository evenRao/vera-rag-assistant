"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export type UploadResult = {
  filename: string;
  chunks_indexed: number;
  message: string;
};

type FileUploadProps = {
  error: string;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
  uploadResult: UploadResult | null;
};

export function FileUpload({ error, isUploading, onUpload, uploadResult }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setLocalError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setLocalError("Choose a .txt or .md document before uploading.");
      return;
    }

    if (!/\.(txt|md)$/i.test(selectedFile.name)) {
      setLocalError("Only .txt and .md documents are supported.");
      return;
    }

    await onUpload(selectedFile);
  }

  const visibleError = localError || error;

  return (
    <section className="panel soft-enter" aria-labelledby="upload-heading">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-vera bg-teal-soft text-teal">
          <UploadCloud aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h2 id="upload-heading" className="text-lg font-semibold text-ink">
            Upload document
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">Supported files: .txt and .md.</p>
        </div>
      </div>

      <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="document">
            Document file
          </label>
          <input
            accept=".txt,.md,text/plain,text/markdown"
            className="block w-full cursor-pointer rounded-vera border border-line bg-white text-sm text-ink file:mr-4 file:min-h-11 file:border-0 file:bg-ink file:px-4 file:text-sm file:font-medium file:text-white hover:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
            disabled={isUploading}
            id="document"
            onChange={handleFileChange}
            type="file"
          />
        </div>

        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-vera bg-teal px-4 text-sm font-semibold text-white transition hover:bg-teal-strong focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUploading}
          type="submit"
        >
          {isUploading ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
          )}
          {isUploading ? "Indexing" : "Upload and index"}
        </button>
      </form>

      {visibleError ? (
        <div className="mt-4 flex gap-2 rounded-vera border border-danger-line bg-danger-soft p-3 text-sm leading-6 text-danger" role="alert">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{visibleError}</span>
        </div>
      ) : null}

      {uploadResult ? (
        <div className="mt-4 flex gap-2 rounded-vera border border-success-line bg-success-soft p-3 text-sm leading-6 text-success" role="status">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {uploadResult.filename} indexed into {uploadResult.chunks_indexed} chunks.
          </span>
        </div>
      ) : null}
    </section>
  );
}
