"use client";
import { useState } from "react";
import {
  OprynAction,
  useActionFeedback,
} from "@/components/motion/opryn-action";
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
} from "@/lib/knowledge-library";

export function KnowledgeClassification({
  id,
  initialCategory,
  initialTags,
  initialRevision,
}: {
  id: string;
  initialCategory: KnowledgeCategory;
  initialTags: string[];
  initialRevision: number;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [tags, setTags] = useState(initialTags.join(", "));
  const [revision, setRevision] = useState(initialRevision);
  const feedback = useActionFeedback();
  const [savedValues, setSavedValues] = useState("");
  async function save() {
    await feedback.run(async () => {
      const response = await fetch("/api/knowledge-library/metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          entity: "process",
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          revision,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Classification could not be saved.");
      setRevision(data.revision);
      setSavedValues(JSON.stringify({ category, tags }));
    });
  }
  return (
    <section className="rounded-xl border border-[#CBCFCA] bg-[#FAF9F5] p-5">
      <h3 className="text-lg font-semibold">Organize in Knowledge</h3>
      <p className="mt-2 text-sm text-[#59635B]">
        Check the suggested category before approval. Uncertain findings stay
        uncategorized.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          Category
          <select
            className="mt-2 min-h-11 w-full rounded-lg border p-2 text-base"
            value={category}
            onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
          >
            {Object.entries(KNOWLEDGE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags
          <input
            className="mt-2 min-h-11 w-full rounded-lg border p-2 text-base"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Refunds, Finance"
          />
        </label>
      </div>
      <div className="mt-4">
        <OprynAction
          label="Save classification"
          pendingLabel="Saving…"
          successLabel="Saved"
          variant="secondary"
          repeatable
          state={
            feedback.state === "success" &&
            savedValues !== JSON.stringify({ category, tags })
              ? "idle"
              : feedback.state
          }
          errorMessage={feedback.error}
          onClick={save}
        />
      </div>
    </section>
  );
}
