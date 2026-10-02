"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MotionPanel } from "./motion-panel";
const Host = createContext<HTMLElement | null>(null);
/** Keep provider identity in its row while the workflow occupies the row's full width. */
export function TeachWorkflowScope({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <Host.Provider value={host}>
      {children}
      <div ref={setHost} className="teach-workflow-slot" />
    </Host.Provider>
  );
}
export function TeachWorkflow({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const host = useContext(Host);
  const panel = (
    <MotionPanel open={open} className="teach-inline-workflow">
      {children}
    </MotionPanel>
  );
  return host ? createPortal(panel, host) : panel;
}
