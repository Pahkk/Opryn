"use client";

import Link from "next/link";
import { DialogSurface } from "@/components/app/dialog-surface";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Check, CircleHelp, Inbox, UserPlus, X } from "lucide-react";

export type AppNotification = {
  id: string;
  notificationId?: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
  kind: "question" | "invite" | "update";
  createdAt: string;
};

export function NotificationBell({
  initialItems,
  initialCount,
}: {
  initialItems: AppNotification[];
  initialCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [locallyRead, setLocallyRead] = useState<Set<string>>(() => new Set());
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => router.refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [open, router]);

  async function markRead(notificationIds?: string[], refresh = true) {
    const ids = notificationIds?.filter(Boolean) ?? [];
    if (!ids.length) return;
    try {
      const response = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) return;
      setLocallyRead((current) => new Set([...current, ...ids]));
      if (refresh) router.refresh();
    } catch {
      /* Reading a notification must never block its review link. */
    }
  }

  const items = initialItems.map((item) =>
    item.notificationId && locallyRead.has(item.notificationId)
      ? { ...item, unread: false }
      : item,
  );
  const locallyReadCount = initialItems.filter(
    (item) =>
      item.unread &&
      item.notificationId &&
      locallyRead.has(item.notificationId),
  ).length;
  const count = Math.max(0, initialCount - locallyReadCount);
  const readableIds = items
    .filter((item) => item.unread && item.notificationId)
    .map((item) => item.notificationId as string);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) router.refresh();
        }}
        className={`relative grid size-10 place-items-center rounded-lg text-[#6b7788] transition hover:bg-[#f2f4f7] ${open ? "bg-[#edf2ff] text-[#3158d8]" : ""}`}
        aria-label={
          count
            ? `Open notifications, ${count} ${count === 1 ? "item" : "items"} need attention`
            : "Open notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-[19px]" />
        {count ? (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-[#3158d8] px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <DialogSurface label="Notifications" onClose={() => setOpen(false)}>
          <section className="dialog-content w-full rounded-2xl border border-[#dfe5ed] bg-white shadow-[var(--opryn-shadow-lg)] sm:max-w-lg">
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="float-right m-2 grid size-11 place-items-center rounded-xl hover:bg-[var(--opryn-neutral)]"
            >
              <X size={18} />
            </button>
            <header className="flex items-center justify-between border-b border-[#edf0f4] px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold">Notifications</h2>
                <p className="mt-0.5 text-xs text-[#7a8596]">
                  Questions, invitations, and company updates
                </p>
              </div>
              {readableIds.length ? (
                <button
                  type="button"
                  disabled={marking}
                  onClick={async () => {
                    setMarking(true);
                    await markRead(readableIds);
                    setMarking(false);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#3158d8] hover:bg-[#edf2ff] disabled:opacity-50"
                >
                  <Check className="size-3.5" /> Mark updates read
                </button>
              ) : null}
            </header>

            {items.length ? (
              <div className="p-2">
                {items.map((item) => {
                  const Icon =
                    item.kind === "question"
                      ? CircleHelp
                      : item.kind === "invite"
                        ? UserPlus
                        : Bell;
                  const iconStyle =
                    item.kind === "question"
                      ? "bg-[#f0eef6] text-[#645b87]"
                      : item.kind === "invite"
                        ? "bg-[#eaf7f1] text-[#177257]"
                        : "bg-[#edf2ff] text-[#3158d8]";
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        if (item.notificationId && item.unread) {
                          void markRead([item.notificationId], false);
                        }
                        setOpen(false);
                      }}
                      className="group flex items-start gap-3 rounded-xl p-3 transition hover:bg-[#f6f8fb]"
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconStyle}`}
                      >
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="flex-1 text-sm font-semibold leading-5 text-[#253148]">
                            {item.title}
                          </span>
                          {item.unread ? (
                            <span
                              className="mt-1.5 size-2 shrink-0 rounded-full bg-[#3158d8]"
                              aria-label="Unread"
                            />
                          ) : null}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#718095]">
                          {item.body}
                        </span>
                        <span className="mt-1.5 block text-[11px] font-medium text-[#9aa3b0]">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#f2f5f8] text-[#7a8596]">
                  <Inbox className="size-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold">
                  You’re all caught up.
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#7a8596]">
                  New questions and company updates will appear here.
                </p>
              </div>
            )}

            <footer className="border-t border-[#edf0f4] p-2">
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center justify-center rounded-xl text-xs font-semibold text-[#53627a] hover:bg-[#f3f5f8]"
              >
                Back to home
              </Link>
            </footer>
          </section>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d ago`;
}
