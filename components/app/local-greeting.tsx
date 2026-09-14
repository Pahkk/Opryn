"use client";

import { useSyncExternalStore } from "react";

function localGreeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}

function subscribe(callback: () => void) {
  const immediate = window.setTimeout(callback, 0);
  const interval = window.setInterval(callback, 60_000);
  return () => {
    window.clearTimeout(immediate);
    window.clearInterval(interval);
  };
}

export function LocalGreeting({ name }: { name: string }) {
  const greeting = useSyncExternalStore(
    subscribe,
    localGreeting,
    () => "Hello",
  );

  return (
    <h1 className="mt-2 text-[32px] font-semibold tracking-[-.045em] sm:text-[38px]">
      {greeting}, {name}
    </h1>
  );
}
