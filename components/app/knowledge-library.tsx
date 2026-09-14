"use client";
import { StaggerList } from "@/components/motion/motion-region";
import "./knowledge-library.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lazy, Suspense, useState } from "react";
import { DialogSurface } from "./dialog-surface";
const LibraryProcessReview = lazy(() =>
  import("./library-process-review").then((module) => ({
    default: module.LibraryProcessReview,
  })),
);
import {
  KNOWLEDGE_CATEGORIES,
  LIBRARY_VIEWS,
  type LibraryItem,
} from "@/lib/knowledge-library";

export function KnowledgeLibrary({
  items,
  reviewItems,
  usedItems,
  total,
  categories,
  sources,
  filters,
  page,
  pageSize,
  canManage,
  organizationName,
  initialItem,
}: {
  initialItem?: LibraryItem | null;
  items: LibraryItem[];
  reviewItems: LibraryItem[];
  usedItems: LibraryItem[];
  total: number;
  categories: Record<string, number>;
  sources: string[];
  filters: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  canManage: boolean;
  organizationName: string;
}) {
  const [selected, setSelected] = useState<LibraryItem | null>(
    initialItem || null,
  );
  const [categorySheet, setCategorySheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const view = filters.view || "overview";
  function href(values: Record<string, string>) {
    const params = new URLSearchParams(
      Object.entries(filters).filter(
        (pair): pair is [string, string] => !!pair[1],
      ),
    );
    params.delete("page");
    params.delete("type");
    params.delete("knowledge");
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/app/processes?${params}`;
  }
  function navigation() {
    return (
      <>
        <nav aria-label="Knowledge views">
          <Link
            aria-current={view === "overview" ? "page" : undefined}
            href="/app/processes"
          >
            Overview
          </Link>
          <Link
            aria-current={
              view === "all" && !filters.category ? "page" : undefined
            }
            href={href({ view: "all", category: "" })}
          >
            All knowledge
          </Link>
        </nav>
        <p className="library-label">Categories</p>
        <nav aria-label="Knowledge categories">
          {Object.entries(KNOWLEDGE_CATEGORIES).map(([id, label]) => (
            <Link
              key={id}
              href={href({ category: id, view: "all" })}
              aria-current={filters.category === id ? "page" : undefined}
            >
              <span>{label}</span>
              <span>{categories[id] || 0}</span>
            </Link>
          ))}
        </nav>
        <p className="library-label">Smart views</p>
        <nav aria-label="Smart views">
          {Object.entries(LIBRARY_VIEWS)
            .filter(([id]) => !["overview", "all"].includes(id))
            .map(([id, label]) => (
              <Link
                key={id}
                href={href({ view: id, category: "", status: "", days: "" })}
                aria-current={view === id ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
        </nav>
      </>
    );
  }
  function rows(list: LibraryItem[], empty: string) {
    return (
      <StaggerList
        className="library-rows"
        changeKey={list
          .map((item) => `${item.entity}:${item.id}:${item.updated_at}`)
          .join("|")}
      >
        {list.length ? (
          list.map((item) => (
            <button
              type="button"
              className="library-row"
              key={`${item.entity}-${item.id}`}
              data-motion-row={`${item.entity}-${item.id}`}
              data-motion-version={item.updated_at}
              onClick={() => setSelected(item)}
            >
              <span>
                <strong>{item.title}</strong>
                <span>
                  {KNOWLEDGE_CATEGORIES[item.category] || "Uncategorized"} ·{" "}
                  {statusLabel(item.status)}
                </span>
                <small>
                  {item.source_title ? `${item.source_title} · ` : ""}
                  {item.source}
                </small>
              </span>
              <span className="library-row-date">
                {date(item.updated_at)}
                <span aria-hidden> →</span>
              </span>
            </button>
          ))
        ) : (
          <p className="library-empty">{empty}</p>
        )}
      </StaggerList>
    );
  }
  return (
    <div className="knowledge-library">
      <header className="library-heading">
        <div>
          <h1 className="opryn-page-title">Knowledge</h1>
          <p>What your company knows. Reviewed, organized, and ready to use.</p>
        </div>
        {canManage && (
          <Link href="/app/processes/new" className="opryn-action">
            Teach Opryn
          </Link>
        )}
      </header>
      <form className="library-search" action="/app/processes">
        <label className="sr-only" htmlFor="knowledge-search">
          Search company knowledge
        </label>
        <input
          id="knowledge-search"
          data-guide="knowledge.search"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Search company knowledge…"
        />
        <input type="hidden" name="view" value="all" />
        {filters.category && (
          <input type="hidden" name="category" value={filters.category} />
        )}
        <button type="submit">Search</button>
      </form>
      <div className="library-mobile-controls">
        <button
          data-guide="knowledge.categories"
          onClick={() => setCategorySheet(true)}
        >
          {filters.category
            ? KNOWLEDGE_CATEGORIES[
                filters.category as keyof typeof KNOWLEDGE_CATEGORIES
              ]
            : "All Knowledge"}{" "}
          ↓
        </button>
        <button onClick={() => setFilterSheet(true)}>Filters</button>
      </div>
      <div className="library-layout">
        <aside className="library-sidebar" data-guide="knowledge.categories">
          {navigation()}
        </aside>
        <div className="library-main" data-guide="knowledge.reviews">
          <div className="library-section-heading">
            <h2>
              {filters.category
                ? KNOWLEDGE_CATEGORIES[
                    filters.category as keyof typeof KNOWLEDGE_CATEGORIES
                  ]
                : LIBRARY_VIEWS[view as keyof typeof LIBRARY_VIEWS] ||
                  "All knowledge"}
            </h2>
            <button
              className="library-desktop-filter"
              onClick={() => setFilterSheet(true)}
            >
              Filters
              {filters.status || filters.source || filters.days
                ? " · Active"
                : ""}
            </button>
          </div>
          {(filters.q || filters.status || filters.source || filters.days) && (
            <p className="library-filter-summary">
              {[
                filters.q && `“${filters.q}”`,
                filters.status && statusLabel(filters.status),
                filters.source,
                filters.days && `Last ${filters.days} days`,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              <Link href="/app/processes?view=all">Clear filters</Link>
            </p>
          )}
          {view === "overview" ? (
            <>
              <section
                className="library-category-overview"
                aria-label="Categories"
              >
                {Object.entries(KNOWLEDGE_CATEGORIES)
                  .filter(([id]) => categories[id])
                  .slice(0, 6)
                  .map(([id, label]) => (
                    <Link key={id} href={href({ category: id, view: "all" })}>
                      <strong>{label}</strong>
                      <span>
                        {categories[id]}{" "}
                        {categories[id] === 1 ? "item" : "items"} →
                      </span>
                    </Link>
                  ))}
              </section>
              <section>
                <div className="library-section-heading">
                  <h3>Recently updated</h3>
                  <Link href={href({ view: "all" })}>View all knowledge →</Link>
                </div>
                {rows(
                  items,
                  "No knowledge yet. Start with one process, policy, or answer.",
                )}
              </section>
              <section>
                <div className="library-section-heading">
                  <h3>Needs review</h3>
                  <Link href={href({ view: "needs_review" })}>Review →</Link>
                </div>
                {rows(reviewItems, "No items waiting for review.")}
              </section>
              <section>
                <div className="library-section-heading">
                  <h3>Most used</h3>
                  <Link href={href({ view: "used" })}>View activity →</Link>
                </div>
                {rows(
                  usedItems,
                  "When knowledge is used in answers, it will appear here.",
                )}
              </section>
            </>
          ) : (
            <>
              {rows(items, "No knowledge matches these filters.")}
              <nav className="library-pagination" aria-label="Knowledge pages">
                <span>
                  {total
                    ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
                    : "0 items"}
                </span>
                {page > 1 && (
                  <Link href={href({ page: String(page - 1) })}>Previous</Link>
                )}
                {page * pageSize < total && (
                  <Link href={href({ page: String(page + 1) })}>Next →</Link>
                )}
              </nav>
            </>
          )}
        </div>
      </div>
      {categorySheet && (
        <DialogSurface
          label="Choose knowledge category"
          className="dialog-review"
          onClose={() => setCategorySheet(false)}
        >
          <section className="dialog-content library-sheet">
            <header>
              <h2>Browse knowledge</h2>
              <button onClick={() => setCategorySheet(false)}>Close</button>
            </header>
            {navigation()}
          </section>
        </DialogSurface>
      )}
      {filterSheet && (
        <DialogSurface
          label="Filter company knowledge"
          className="dialog-review"
          onClose={() => setFilterSheet(false)}
        >
          <section className="dialog-content library-sheet">
            <header>
              <h2>Filters</h2>
              <button onClick={() => setFilterSheet(false)}>Close</button>
            </header>
            <form action="/app/processes" className="library-filter-form">
              <input type="hidden" name="view" value="all" />
              <input type="hidden" name="q" value={filters.q || ""} />
              <label>
                Category
                <select
                  aria-label="Category"
                  name="category"
                  defaultValue={filters.category || ""}
                >
                  <option value="">All categories</option>
                  {Object.entries(KNOWLEDGE_CATEGORIES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  aria-label="Status"
                  name="status"
                  defaultValue={filters.status || ""}
                >
                  <option value="">All statuses</option>
                  {["approved", "needs_review", "observed", "conflict"].map(
                    (id) => (
                      <option key={id} value={id}>
                        {statusLabel(id)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Source
                <select
                  aria-label="Source"
                  name="source"
                  defaultValue={filters.source || ""}
                >
                  <option value="">All sources</option>
                  {sources.map((source) => (
                    <option key={source}>{source}</option>
                  ))}
                </select>
              </label>
              <label>
                Updated
                <select
                  aria-label="Updated"
                  name="days"
                  defaultValue={filters.days || ""}
                >
                  <option value="">Any time</option>
                  <option value="1">Last 24 hours</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </label>
              <button className="opryn-action">Apply filters</button>
            </form>
          </section>
        </DialogSurface>
      )}
      {selected && (
        <KnowledgeDetail
          key={`${selected.entity}-${selected.id}`}
          item={selected}
          canManage={canManage}
          organizationName={organizationName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function KnowledgeDetail({
  item,
  canManage,
  organizationName,
  onClose,
}: {
  item: LibraryItem;
  canManage: boolean;
  organizationName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(item.category);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [revision, setRevision] = useState(item.revision);
  const [decisionUpdatedAt, setDecisionUpdatedAt] = useState(item.updated_at);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editing, setEditing] = useState(false);
  const reviewHref =
    item.entity === "proposal"
      ? `/app/needs-you?item=proposal-${item.id}`
      : item.entity === "process"
        ? `/app/processes/${item.id}?edit=true&returnTo=%2Fapp%2Fprocesses`
        : `/app/knowledge/${item.id}/history`;
  async function archive() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-library/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.process_id || item.id,
          entity: item.process_id ? "process" : item.entity,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not archive.");
    } finally {
      setBusy(false);
    }
  }
  async function saveMetadata() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/knowledge-library/metadata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          entity: item.entity,
          category,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          revision,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision);
      if (data.updatedAt) setDecisionUpdatedAt(data.updatedAt);
      setMessage("Classification saved.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: "approve" | "deny") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/knowledge-proposals/${item.id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: item.version,
            updatedAt: decisionUpdatedAt,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The decision was not saved.");
      router.refresh();
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogSurface
      label={item.title}
      className="dialog-review"
      onClose={onClose}
      busy={busy}
    >
      <article className="dialog-content library-sheet">
        <header>
          <p>Knowledge · {organizationName}</p>
          <button onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>
        <h2>{item.title}</h2>
        <p className="library-status">{statusLabel(item.status)}</p>
        <p className="library-answer">{item.content}</p>
        <dl className="library-details">
          <div>
            <dt>Source</dt>
            <dd>
              {item.source_title || item.source}
              {item.source_url && /^https?:\/\//.test(item.source_url) && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open original source ↗
                  </a>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{date(item.updated_at)}</dd>
          </div>
          <div>
            <dt>Last confirmed</dt>
            <dd>
              {item.confirmed_at ? date(item.confirmed_at) : "Not recorded"}
            </dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{item.version}</dd>
          </div>
        </dl>
        {editing && item.entity === "process" ? (
          <Suspense fallback={<p role="status">Loading review…</p>}>
            <LibraryProcessReview id={item.id} />
          </Suspense>
        ) : canManage ? (
          <div className="library-filter-form">
            <label>
              Category
              <select
                aria-label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                {Object.entries(KNOWLEDGE_CATEGORIES).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tags
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Separate tags with commas"
              />
            </label>
            <button
              className="opryn-button-secondary"
              disabled={busy}
              onClick={saveMetadata}
            >
              Save classification
            </button>
          </div>
        ) : (
          <p>
            {KNOWLEDGE_CATEGORIES[item.category]}
            {item.tags.length ? ` · ${item.tags.join(", ")}` : ""}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <footer className="library-detail-actions">
          {canManage && item.entity === "proposal" && !item.review_required ? (
            <>
              <p>
                Accept makes this available to people and AI connections with
                access.
              </p>
              <button
                className="opryn-action"
                disabled={busy}
                onClick={() => decide("approve")}
              >
                Accept
              </button>
              <button
                className="opryn-button-secondary"
                disabled={busy}
                onClick={() => decide("deny")}
              >
                Deny
              </button>
            </>
          ) : null}
          {canManage &&
            (item.entity === "process" ? (
              <button
                className="opryn-button-secondary"
                onClick={() => setEditing((v) => !v)}
              >
                {editing
                  ? "Close editor"
                  : item.status === "approved"
                    ? "Edit"
                    : "Review and edit"}
              </button>
            ) : (
              <Link className="opryn-button-secondary" href={reviewHref}>
                {item.status === "approved"
                  ? "Version history / review"
                  : "Review and edit"}
              </Link>
            ))}
          {canManage && item.entity !== "proposal" && !confirmArchive && (
            <button
              className="opryn-button-secondary"
              onClick={() => setConfirmArchive(true)}
            >
              Archive
              {item.entity === "knowledge" && item.process_id
                ? " related process"
                : ""}
            </button>
          )}
          {confirmArchive && (
            <div>
              <p>
                Archive{" "}
                {item.process_id
                  ? "this process and its associated knowledge"
                  : "this knowledge"}
                ? It will stop being available for new answers. Original source
                files and history are kept.
              </p>
              <button
                className="opryn-button-secondary"
                disabled={busy}
                onClick={() => setConfirmArchive(false)}
              >
                Keep knowledge
              </button>
              <button
                className="opryn-action"
                disabled={busy}
                onClick={archive}
              >
                Confirm archive
              </button>
            </div>
          )}
          <Link
            href={`/app/ask?q=${encodeURIComponent(`What does our company knowledge say about ${item.title}?`)}`}
          >
            Ask Opryn about this →
          </Link>
          {canManage && (
            <Link
              href={`/app/processes/new?prompt=${encodeURIComponent(`Clarify ${item.title}`)}`}
            >
              Teach Opryn about this →
            </Link>
          )}
          {item.process_id && (
            <Link href={`/app/processes/${item.process_id}`}>
              {item.entity === "process"
                ? "Read full process →"
                : "Related process →"}
            </Link>
          )}
        </footer>
      </article>
    </DialogSurface>
  );
}
function statusLabel(status: string) {
  return (
    (
      {
        approved: "Approved",
        needs_review: "Needs Review",
        observed: "Observed",
        conflict: "Conflict",
      } as Record<string, string>
    )[status] || status
  );
}
function date(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
