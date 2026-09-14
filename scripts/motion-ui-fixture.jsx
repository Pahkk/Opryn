// Local-only: real GSAP/React, no services or credentials.
import React, { useEffect, useState, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MotionRegion, StaggerList } from "../components/motion/motion-region";
import { FlowLine } from "../components/motion/flow-line";
import { MotionNumber } from "../components/motion/motion-number";
import { DialogSurface } from "../components/app/dialog-surface";
import { gsap, motionScope } from "../lib/motion/gsap";
function Fixture() {
  const [state, setState] = useState({
    step: 0,
    rows: ["Policy", "Process"],
    open: false,
    error: false,
    reduced: false,
    mounted: true,
  });
  useEffect(() => {
    window.motionFixture = {
      update(patch) {
        flushSync(() => setState((s) => ({ ...s, ...patch })));
      },
      active: () =>
        gsap.globalTimeline
          .getChildren(true, true, true)
          .filter((t) => t.totalProgress() < 1).length,
      fail() {
        const scope = motionScope(document.querySelector(".fixture-content"));
        scope.run(() => {
          gsap.set(".fixture-content", { opacity: 0 });
          throw new Error("Intentional test failure");
        });
        scope.dispose();
      },
    };
    return () => {
      delete window.motionFixture;
    };
  }, []);
  return (
    <div
      className="opryn-app"
      data-motion={state.reduced ? "reduced" : "system"}
    >
      <nav className="fixture-nav">
        <strong>Opryn motion verification</strong>
        <button onClick={() => setState((s) => ({ ...s, open: true }))}>
          Open details
        </button>
      </nav>
      {state.mounted && (
        <main>
          <MotionRegion changeKey={state.step} className="fixture-content">
            <h1>Teach → Review → Approved</h1>
            <p>Stage {state.step}. Explicit samples, no live connections.</p>
            <input aria-label="Unsaved note" defaultValue="Keep my note" />
            {state.error && (
              <p role="alert">Permission errors must appear immediately.</p>
            )}
            <FlowLine />
          </MotionRegion>
          <p>
            Confirmed items: <MotionNumber value={42 + state.step} />
          </p>
          <StaggerList
            className="library-rows"
            changeKey={state.rows.join("|")}
          >
            {state.rows.map((row) => (
              <button className="library-row" key={row} data-motion-row={row}>
                {row}
              </button>
            ))}
          </StaggerList>
          {state.open && (
            <DialogSurface
              label="Knowledge details"
              onClose={() => setState((s) => ({ ...s, open: false }))}
              className="dialog-review"
            >
              <section className="dialog-content library-sheet">
                <h2>Approved knowledge</h2>
                <p>Selected source → review → company guidance.</p>
                <button
                  onClick={() => setState((s) => ({ ...s, open: false }))}
                >
                  Close details
                </button>
              </section>
            </DialogSurface>
          )}
        </main>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
