"use client";
import { useEffect, useId, useState } from "react";
const dirtyForms = new Set<string>();
export function hasUnsavedChanges() {
  return dirtyForms.size > 0;
}
export function useUnsavedChanges(dirty: boolean) {
  const id = useId();
  useEffect(() => {
    if (!dirty) return;
    dirtyForms.add(id);
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]");
      if (
        !anchor ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        anchor.getAttribute("target") === "_blank"
      )
        return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (!window.confirm("Leave without saving your changes?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      dirtyForms.delete(id);
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, id]);
}
export function useSaveFeedback() {
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  return { saving, setSaving, error, setError, message, setMessage };
}
