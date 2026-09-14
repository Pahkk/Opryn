"use client";
import { useEffect, useState, type ComponentProps } from "react";
import { ProcessReview } from "./process-review";
type ReviewData = Omit<ComponentProps<typeof ProcessReview>, "returnTo">;
export function LibraryProcessReview({ id }: { id: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/knowledge-library/process/${id}`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        return body;
      })
      .then(setData)
      .catch((error) => {
        if (!abort.signal.aborted) setError(error.message);
      });
    return () => abort.abort();
  }, [id, retry]);
  if (error)
    return (
      <div role="alert">
        <p>{error}</p>
        <button
          className="opryn-button-secondary"
          onClick={() => {
            setError("");
            setRetry((v) => v + 1);
          }}
        >
          Retry review
        </button>
      </div>
    );
  if (!data) return <p role="status">Loading review…</p>;
  return <ProcessReview {...data} returnTo="/app/processes" />;
}
