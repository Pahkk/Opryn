"use client";

import { createContext, useContext } from "react";

export const WorkspaceContext = createContext("");
export function WorkspaceNotice({
  action = "Working in",
}: {
  action?: string;
}) {
  const name = useContext(WorkspaceContext);
  return name ? (
    <p className="workspace-notice">
      {action} <strong>{name}</strong>
    </p>
  ) : null;
}
