"use client";

import { useState } from "react";

type NotionPage = { id: string; name: string; type: string };

export function NotionPagePicker({
  connectionId,
  onSelected,
  label = "Choose pages",
}: {
  connectionId: string;
  onSelected: (pageIds: string[]) => void | Promise<void>;
  label?: string;
}) {
  const [pages, setPages] = useState<NotionPage[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (pages) {
      setPages(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/files?available=1`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Notion pages could not be loaded.");
      setPages(data.available ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Notion pages could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/files`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: selected }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Those pages could not be selected.");
      await onSelected(selected);
      setSelected([]);
      setPages(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Those pages could not be selected.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="connection-files">
      <button className="opryn-action" type="button" disabled={busy} onClick={load}>
        {busy ? "Loading Notion…" : pages ? "Close page list" : label}
      </button>
      {pages ? (
        <div className="mt-4 grid gap-2">
          {pages.length ? (
            pages.map((page) => (
              <label className="connection-file" key={page.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(page.id)}
                  disabled={
                    !selected.includes(page.id) && selected.length >= 8
                  }
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, page.id]
                        : current.filter((id) => id !== page.id),
                    )
                  }
                />
                <span>
                  <strong>{page.name}</strong>
                  <small>Notion page</small>
                </span>
              </label>
            ))
          ) : (
            <p>
              No pages are available. Share a page with the Opryn connection in
              Notion, then try again.
            </p>
          )}
          {pages.length ? (
            <button
              className="opryn-button-secondary"
              type="button"
              disabled={busy || !selected.length}
              onClick={save}
            >
              Add selected pages
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="connection-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
