"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import { MotionRegion } from "@/components/motion/motion-region";
import { MotionNumber } from "@/components/motion/motion-number";
import { MotionProgress } from "@/components/motion/motion-progress";

type DashboardPulseProps = {
  answeredCount: number;
  askedCount: number;
  handledRate: number;
  needsYou: number;
  approvedCount: number;
  reviewCount: number;
  returnedTime: string | null;
  nextAction: {
    label: string;
    title: string;
    description: string;
    href: string;
  };
};

const AUTO_REFRESH_MS = 90_000;
const subscribeHydration = () => () => {};
const browserHydrated = () => true;
const serverHydrated = () => false;

export function DashboardPulse({
  answeredCount,
  askedCount,
  handledRate,
  needsYou,
  approvedCount,
  reviewCount,
  returnedTime,
  nextAction,
}: DashboardPulseProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  // Server/browser clocks and time zones differ; render the same initial label.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    browserHydrated,
    serverHydrated,
  );

  const refresh = useCallback(() => {
    startRefresh(() => {
      router.refresh();
      setLastUpdated(new Date());
    });
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const headline = returnedTime
    ? `${returnedTime} estimated back`
    : askedCount
      ? `${answeredCount} handled`
      : "Ready to answer";

  return (
    <MotionRegion variant="quiet">
      <section
        className="dashboard-pulse"
        aria-labelledby="workspace-pulse-title"
      >
        <div className="dashboard-pulse__main">
          <div className="dashboard-pulse__status" data-pulse-reveal>
            <span className="dashboard-pulse__live" aria-hidden="true" />
            <span>Workspace pulse</span>
            <span className="dashboard-pulse__updated" aria-live="polite">
              {isRefreshing
                ? "Updating…"
                : hydrated
                  ? `Updated ${formatUpdatedTime(lastUpdated)}`
                  : "Live workspace"}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard"
            >
              <RefreshCw
                aria-hidden
                size={14}
                className={isRefreshing ? "dashboard-pulse__spin" : ""}
              />
            </button>
          </div>

          <p
            className="dashboard-pulse__headline"
            id="workspace-pulse-title"
            data-pulse-reveal
          >
            {headline}
          </p>
          <p className="dashboard-pulse__summary" data-pulse-reveal>
            {askedCount
              ? `${answeredCount} of ${askedCount} questions were answered from approved company knowledge this week.${returnedTime ? " Time returned is an estimate based on eligible team use." : ""}`
              : "Once your team starts asking, Opryn will show what it handles and where knowledge is missing."}
          </p>

          <div className="dashboard-pulse__progress" data-pulse-reveal>
            <div className="dashboard-pulse__progress-copy">
              <span>Questions handled by Opryn</span>
              <strong>
                <MotionNumber value={handledRate} />%
              </strong>
            </div>
            <div
              className="dashboard-pulse__track"
              role="progressbar"
              aria-label="Questions handled by Opryn"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={handledRate}
            >
              <MotionProgress value={handledRate / 100} />
            </div>
          </div>

          <dl className="dashboard-pulse__stats" data-pulse-reveal>
            <div>
              <dt>Approved knowledge</dt>
              <dd>
                <MotionNumber value={approvedCount} />
              </dd>
            </div>
            <div data-tone={needsYou ? "attention" : "quiet"}>
              <dt>Needs you</dt>
              <dd>
                <MotionNumber value={needsYou} />
              </dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>
                <MotionNumber value={reviewCount} />
              </dd>
            </div>
          </dl>
        </div>

        <aside className="dashboard-pulse__next" data-pulse-reveal>
          <p>{nextAction.label}</p>
          <h2>{nextAction.title}</h2>
          <span>{nextAction.description}</span>
          <Link href={nextAction.href}>
            Continue <ArrowRight aria-hidden size={16} />
          </Link>
        </aside>
      </section>
    </MotionRegion>
  );
}

function formatUpdatedTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
