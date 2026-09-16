"use client";

import { MotionRegion } from "@/components/motion/motion-region";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Building2,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import {
  APP_TOAST_EVENT,
  readAppToast,
  type AppToastMessage,
} from "@/lib/client-toast";
import { createClient } from "@/lib/supabase/client";
import { hasFeature, type PlanFeature, type PlanId } from "@/lib/billing/plans";
import { OprynLogo } from "@/components/opryn-logo";
import { DialogSurface } from "@/components/app/dialog-surface";
import { WorkspaceContext } from "@/components/app/workspace-context";
import { isProductRouteActive } from "@/lib/product-navigation";
import { hasUnsavedChanges } from "@/components/app/settings/form-state";
import dynamic from "next/dynamic";
const OprynGuide = dynamic(
  () =>
    import("@/components/guide/opryn-guide").then(
      (module) => module.OprynGuide,
    ),
  { ssr: false },
);
import {
  AskIcon,
  ConnectionIcon,
  HelpIcon,
  HomeIcon,
  KnowledgeIcon,
  NeedsYouIcon,
  SettingsIcon,
  TeamIcon,
  TeachIcon,
  type OprynIconProps,
} from "@/components/opryn-icons/opryn-icons";
import {
  NotificationBell,
  type AppNotification,
} from "@/components/app/notification-bell";

type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<OprynIconProps>;
  admin?: boolean;
  feature?: PlanFeature;
};
type NavigationGroup = { label?: string; items: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  {
    items: [
      { href: "/app", label: "Home", icon: HomeIcon },
      { href: "/app/ask", label: "Ask Opryn", icon: AskIcon },
      {
        href: "/app/processes/new",
        label: "Teach Opryn",
        icon: TeachIcon,
        admin: true,
      },
      { href: "/app/processes", label: "Knowledge", icon: KnowledgeIcon },
      {
        href: "/app/needs-you",
        label: "Needs You",
        icon: NeedsYouIcon,
        admin: true,
      },
      { href: "/app/team", label: "Team", icon: TeamIcon, admin: true },
      {
        href: "/app/integrations",
        label: "Connections",
        icon: ConnectionIcon,
        admin: true,
      },
    ],
  },
  {
    label: "Support & settings",
    items: [
      {
        href: "/app/settings",
        label: "Settings",
        icon: SettingsIcon,
      },
      { href: "/app/help", label: "Help", icon: HelpIcon },
    ],
  },
];

type Props = {
  organizationId: string;
  organizations: Array<{ id: string; name: string }>;
  children: React.ReactNode;
  organization: { name: string; logoUrl: string | null };
  user: { fullName: string; email: string; avatarUrl?: string | null };
  preferences?: {
    density: "comfortable" | "compact";
    motion: "system" | "reduced";
  };
  isAdmin: boolean;
  notifications: AppNotification[];
  notificationCount: number;
  pendingApprovalCount: number;
  needsYouCount: number;
  plan: PlanId;
};

export function AppShell({
  organizationId,
  organizations,
  children,
  organization,
  user,
  isAdmin,
  notifications,
  notificationCount,
  pendingApprovalCount,
  needsYouCount,
  plan,
  preferences,
}: Props) {
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<AppToastMessage | null>(null);
  const groups = useMemo(
    () =>
      (isAdmin
        ? navigationGroups
        : [
            {
              items: [
                { href: "/app/ask", label: "Ask Opryn", icon: AskIcon },
                {
                  href: "/app/training",
                  label: "My Learning",
                  icon: BookOpenText,
                },
                {
                  href: "/app/processes",
                  label: "Knowledge",
                  icon: KnowledgeIcon,
                },
                ...(needsYouCount
                  ? [
                      {
                        href: "/app/needs-you",
                        label: "Needs You",
                        icon: NeedsYouIcon,
                      },
                    ]
                  : []),
              ],
            },
            {
              label: "Your account",
              items: [
                {
                  href: "/app/settings",
                  label: "Settings",
                  icon: SettingsIcon,
                },
                { href: "/app/help", label: "Help", icon: HelpIcon },
              ],
            },
          ]
      )
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !("admin" in item && item.admin) || isAdmin,
          ),
        }))
        .filter((group) => group.items.length),
    [isAdmin, needsYouCount],
  );
  const navigation = groups.flatMap((group) => group.items);
  const initial = user.fullName.slice(0, 1).toUpperCase();

  useEffect(() => {
    // Bind workspace mutations to the workspace that rendered the form, including
    // stale tabs. The backend checks this header against verified membership.
    const originalFetch = window.fetch;
    const boundFetch: typeof fetch = (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.origin,
      );
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/account") &&
        url.pathname !== "/api/workspace"
      ) {
        const headers = new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
        );
        headers.set("x-opryn-organization", organizationId);
        return originalFetch(input, { ...init, headers });
      }
      return originalFetch(input, init);
    };
    window.fetch = boundFetch;
    const changed = (event: StorageEvent) => {
      if (
        event.key === "opryn-workspace-change" &&
        event.newValue &&
        !event.newValue.startsWith(`${organizationId}:`)
      ) {
        // Native beforeunload preserves unsaved work if the user cancels.
        // Keep the form visible in that case; bound API requests fail closed
        // until the old tab reloads into the newly selected workspace.
        window.location.reload();
      }
    };
    window.addEventListener("storage", changed);
    return () => {
      if (window.fetch === boundFetch) window.fetch = originalFetch;
      window.removeEventListener("storage", changed);
    };
  }, [organizationId]);

  useEffect(() => {
    function receiveToast() {
      const pending = readAppToast();
      if (pending) setToast(pending);
    }
    receiveToast();
    window.addEventListener(APP_TOAST_EVENT, receiveToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, receiveToast);
  }, [pathname]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        if (profileRef.current?.contains(document.activeElement)) {
          profileRef.current
            .querySelector<HTMLButtonElement>(
              'button[aria-label="Open profile menu"]',
            )
            ?.focus();
        }
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node))
        setProfileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  async function signOut() {
    if (
      hasUnsavedChanges() &&
      !window.confirm("Sign out without saving your changes?")
    )
      return;
    const { error } = await createClient().auth.signOut();
    if (error) {
      setToast({
        id: Date.now(),
        title: "Sign-out failed",
        description: "Check your connection and try again.",
      });
      return;
    }
    // Full navigation discards authenticated router payloads.
    // Authentication boundaries must discard all workspace router cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  async function switchWorkspace(id: string) {
    if (id === organizationId || switching) return;
    if (
      hasUnsavedChanges() &&
      !window.confirm("Switch workspaces without saving your changes?")
    )
      return;
    setSwitching(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: id }),
      });
      if (!response.ok) throw new Error();
      try {
        localStorage.setItem("opryn-workspace-change", `${id}:${Date.now()}`);
      } catch {
        /* Storage may be disabled; server binding still protects writes. */
      }
      // A full navigation clears client caches and avoids opening an old entity
      // under the newly chosen business. Membership is verified server-side.
      // Clear the client router cache on an organization switch; do not reuse another workspace's payloads.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/app");
    } catch {
      setSwitching(false);
      setToast({
        id: Date.now(),
        title: "Workspace couldn't be changed",
        description: "Your current workspace is unchanged. Please try again.",
      });
    }
  }

  return (
    <WorkspaceContext.Provider value={organization.name}>
      <div
        className="opryn-app"
        data-density={preferences?.density ?? "comfortable"}
        data-motion={preferences?.motion ?? "system"}
      >
        <a href="#workspace-main" className="app-skip-link">
          Skip to content
        </a>
        {toast ? (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="app-success-toast fixed left-4 right-4 top-20 z-[120] overflow-hidden rounded-[13px] border border-[#bfd4f7] bg-white shadow-[var(--opryn-shadow-lg)] sm:left-auto sm:right-6 sm:w-full sm:max-w-sm"
          >
            <div className="flex items-start gap-3 p-4 pr-12">
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-[var(--opryn-navy)]">
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-1 text-xs leading-5 text-[var(--opryn-muted)]">
                    {toast.description}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-[7px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
            >
              <X className="size-4" />
            </button>
            <div className="app-success-toast-progress h-[3px] origin-left bg-[var(--opryn-blue)]" />
          </div>
        ) : null}

        <DesktopSidebar
          groups={groups}
          pathname={pathname}
          plan={plan}
          organization={organization}
          user={user}
          initial={initial}
          isAdmin={isAdmin}
          pendingApprovalCount={pendingApprovalCount}
          needsYouCount={needsYouCount}
        />

        {menuOpen ? (
          <DialogSurface
            label="Workspace navigation"
            onClose={() => setMenuOpen(false)}
            className="dialog-navigation"
          >
            <aside
              className="product-sidebar dialog-content h-full max-w-[320px] overflow-y-auto p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-12 items-center justify-between">
                <OprynLogo size="small" priority />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="grid size-11 place-items-center rounded-xl text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-6 flex items-center gap-3 border-y border-white/10 py-4">
                <OrganizationMark
                  name={organization.name}
                  logoUrl={organization.logoUrl}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {organization.name}
                  </p>
                  <p className="sidebar-caption mt-1 text-xs">
                    Company workspace
                  </p>
                </div>
              </div>
              <SidebarNavigation
                groups={groups}
                pathname={pathname}
                plan={plan}
                mobile
                onNavigate={() => setMenuOpen(false)}
                pendingApprovalCount={pendingApprovalCount}
                needsYouCount={needsYouCount}
              />
            </aside>
          </DialogSurface>
        ) : null}

        <div className="min-w-0 lg:pl-[258px]">
          <header className="opryn-app-topbar sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[var(--opryn-line)] bg-white/92 px-4 backdrop-blur-xl sm:px-6 lg:px-9">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="grid size-10 place-items-center rounded-[9px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)] lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search company knowledge"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
              >
                <Search className="size-4" />
              </button>
              {organizations.length > 1 ? (
                <select
                  aria-label="Active business"
                  value={organizationId}
                  disabled={switching}
                  onChange={(event) => void switchWorkspace(event.target.value)}
                  className="h-11 min-w-0 max-w-[min(38vw,280px)] truncate rounded-xl border border-[var(--opryn-line)] bg-white px-2 text-sm font-semibold"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-sm font-semibold text-[var(--opryn-navy)]">
                  {organization.name}
                </p>
              )}
            </div>
            <div className="relative flex items-center gap-2" ref={profileRef}>
              {isAdmin ? (
                <Link
                  href="/app/processes/new"
                  prefetch={false}
                  className="opryn-action app-header-teach mr-1"
                >
                  <TeachIcon size={16} /> Teach Opryn
                </Link>
              ) : null}
              <NotificationBell
                initialItems={notifications}
                initialCount={notificationCount}
              />
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="grid size-11 shrink-0 place-items-center rounded-full border border-[#cfd9e8] bg-[var(--opryn-blue-surface)] text-xs font-bold text-[var(--opryn-blue)] hover:border-[#8eafe5]"
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
              >
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </button>
              {profileOpen ? (
                <div className="absolute right-0 top-12 w-60 rounded-[13px] border border-[var(--opryn-line)] bg-white p-2 shadow-[var(--opryn-shadow-lg)]">
                  <div className="border-b border-[var(--opryn-line)] px-2 py-2.5">
                    <p className="truncate text-sm font-semibold text-[var(--opryn-navy)]">
                      {user.fullName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--opryn-muted)]">
                      {user.email}
                    </p>
                  </div>
                  <Link
                    href="/app/settings/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-[var(--opryn-neutral)]"
                  >
                    My Profile
                  </Link>
                  <Link
                    href="/app/settings/preferences"
                    onClick={() => setProfileOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-[var(--opryn-neutral)]"
                  >
                    Preferences
                  </Link>
                  <Link
                    href="/app/settings/security"
                    onClick={() => setProfileOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-[var(--opryn-neutral)]"
                  >
                    Sign-in & Security
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="mt-1 flex w-full items-center gap-2 rounded-[8px] px-2 py-2.5 text-sm text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)] hover:text-[var(--opryn-navy)]"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <OprynGuide
            key={organizationId}
            organizationId={organizationId}
            workspace={organization.name}
          />
          <main
            id="workspace-main"
            data-guide={
              pathname === "/app"
                ? "home.overview"
                : pathname === "/app/learning-sources"
                  ? "teach.sources"
                  : undefined
            }
            tabIndex={-1}
            key={pathname}
            className="page-shell mx-auto w-full min-w-0 max-w-[1320px] p-4 pb-24 sm:p-7 sm:pb-24 lg:p-10 lg:pb-12"
          >
            {switching ? (
              <p
                role="status"
                className="py-8 text-sm text-[var(--opryn-muted)]"
              >
                Switching workspace…
              </p>
            ) : pathname.includes("/settings/") &&
              /billing|security|data/.test(pathname) ? (
              <div data-motion-immediate>{children}</div>
            ) : (
              <MotionRegion
                changeKey={pathname}
                variant={pathname.includes("/settings") ? "quiet" : "page"}
              >
                {children}
              </MotionRegion>
            )}
          </main>
        </div>

        <MobileBottomNavigation
          isAdmin={isAdmin}
          pathname={pathname}
          onMore={() => setMenuOpen(true)}
        />
        {searchOpen ? (
          <GlobalSearch
            navigation={navigation}
            onClose={() => setSearchOpen(false)}
          />
        ) : null}
      </div>
    </WorkspaceContext.Provider>
  );
}

function DesktopSidebar({
  groups,
  pathname,
  plan,
  organization,
  user,
  initial,
  isAdmin,
  pendingApprovalCount,
  needsYouCount,
}: {
  groups: NavigationGroup[];
  pathname: string;
  plan: PlanId;
  organization: { name: string; logoUrl: string | null };
  user: { fullName: string; email: string };
  initial: string;
  isAdmin: boolean;
  pendingApprovalCount: number;
  needsYouCount: number;
}) {
  return (
    <aside className="product-sidebar fixed inset-y-0 left-0 z-50 hidden w-[258px] flex-col lg:flex">
      <div className="sidebar-divider flex h-[68px] items-center border-b px-6">
        <Link href="/app" prefetch={false} aria-label="Opryn dashboard">
          <OprynLogo size="small" priority />
        </Link>
      </div>
      <div className="sidebar-divider mx-5 border-b py-4">
        <div className="flex items-center gap-3">
          <OrganizationMark
            name={organization.name}
            logoUrl={organization.logoUrl}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {organization.name}
            </p>
            <p className="sidebar-caption mt-0.5 text-xs">
              {isAdmin ? "Owner workspace" : "Team workspace"}
            </p>
          </div>
        </div>
      </div>
      <SidebarNavigation
        groups={groups}
        pathname={pathname}
        plan={plan}
        pendingApprovalCount={pendingApprovalCount}
        needsYouCount={needsYouCount}
      />
      <div className="border-t border-white/9 p-4">
        <Link
          href="/app/settings/profile"
          className="sidebar-account flex w-full items-center gap-3 rounded-xl p-2 text-left"
        >
          <span className="sidebar-avatar grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-white/88">
              {user.fullName}
            </span>
            <span className="mt-0.5 block truncate text-[10px] text-white/40">
              {user.email}
            </span>
          </span>
          <ArrowRight className="size-3.5 text-white/38" />
        </Link>
      </div>
    </aside>
  );
}

function SidebarNavigation({
  groups,
  pathname,
  plan,
  mobile = false,
  onNavigate,
  pendingApprovalCount = 0,
  needsYouCount = 0,
}: {
  groups: NavigationGroup[];
  pathname: string;
  plan: PlanId;
  mobile?: boolean;
  onNavigate?: () => void;
  pendingApprovalCount?: number;
  needsYouCount?: number;
}) {
  return (
    <nav
      className={`flex-1 overflow-y-auto ${mobile ? "mt-5" : "px-3 py-5"}`}
      aria-label={mobile ? "Mobile navigation" : "Application navigation"}
    >
      {groups.map((group, groupIndex) => (
        <div
          key={group.label || "primary"}
          className={groupIndex ? "sidebar-divider mt-5 border-t pt-4" : ""}
        >
          {group.label ? (
            <p className="sidebar-label mb-2 px-3 font-semibold tracking-wide">
              {group.label}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                pathname={pathname}
                plan={plan}
                onNavigate={onNavigate}
                pendingApprovalCount={pendingApprovalCount}
                needsYouCount={needsYouCount}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavigationLink({
  item,
  pathname,
  plan,
  onNavigate,
  pendingApprovalCount,
  needsYouCount,
}: {
  item: NavigationItem;
  pathname: string;
  plan: PlanId;
  onNavigate?: () => void;
  pendingApprovalCount: number;
  needsYouCount: number;
}) {
  const active = isProductRouteActive(item.href, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="sidebar-link group relative flex items-center gap-3 px-3 text-sm font-medium"
    >
      <Icon
        size={18}
        className={
          active ? "text-[#69abff]" : "text-white/43 group-hover:text-white/70"
        }
      />
      <span>{item.label}</span>
      {item.href === "/app/processes" && pendingApprovalCount > 0 ? (
        <span className="ml-auto min-w-5 rounded-full bg-[#4a9bff] px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
          {Math.min(pendingApprovalCount, 99)}
        </span>
      ) : null}
      {item.href === "/app/needs-you" && needsYouCount > 0 ? (
        <span className="ml-auto min-w-5 rounded-md bg-[#eaf2ff] px-1.5 py-0.5 text-center text-xs font-bold text-[var(--opryn-blue)]">
          {Math.min(needsYouCount, 99)}
        </span>
      ) : null}
      {item.feature && !hasFeature(plan, item.feature) ? (
        <span className="opryn-premium-label ml-auto border-white/10 bg-white/7 text-white/50">
          Premium
        </span>
      ) : null}
    </Link>
  );
}

function MobileBottomNavigation({
  isAdmin,
  pathname,
  onMore,
}: {
  isAdmin: boolean;
  pathname: string;
  onMore: () => void;
}) {
  const items: Array<NavigationItem & { shortLabel: string }> = isAdmin
    ? [
        { href: "/app", label: "Home", shortLabel: "Home", icon: HomeIcon },
        {
          href: "/app/ask",
          label: "Ask Opryn",
          shortLabel: "Ask",
          icon: AskIcon,
        },
        {
          href: "/app/processes/new",
          label: "Teach Opryn",
          shortLabel: "Teach",
          icon: TeachIcon,
        },
      ]
    : [
        {
          href: "/app/training",
          label: "My Learning",
          shortLabel: "My Learning",
          icon: BookOpenText,
        },
        {
          href: "/app/ask",
          label: "Ask Opryn",
          shortLabel: "Ask",
          icon: AskIcon,
        },
        {
          href: "/app/processes",
          label: "Knowledge",
          shortLabel: "Knowledge",
          icon: KnowledgeIcon,
        },
      ];
  return (
    <nav
      className="product-bottom-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[var(--opryn-line)] bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      aria-label="Quick navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/app"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-[9px] text-[10px] font-semibold ${active ? "text-[var(--opryn-blue)]" : "text-[var(--opryn-muted)]"}`}
          >
            {active ? (
              <span className="absolute top-0 h-[2px] w-5 rounded bg-[var(--opryn-blue)]" />
            ) : null}
            <Icon size={20} />
            {item.shortLabel}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-[9px] text-[10px] font-semibold text-[var(--opryn-muted)]"
      >
        <Menu className="size-5" /> More
      </button>
    </nav>
  );
}

function OrganizationMark({
  name,
  logoUrl,
  inverse = false,
}: {
  name: string;
  logoUrl: string | null;
  inverse?: boolean;
}) {
  if (logoUrl)
    return (
      <span
        role="img"
        aria-label={`${name} logo`}
        className={`block size-9 shrink-0 rounded-[9px] border bg-white bg-cover bg-center bg-no-repeat ${inverse ? "border-white/12" : "border-[var(--opryn-line)]"}`}
        style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
      />
    );

  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-[9px] ${inverse ? "bg-white/8 text-white/72" : "bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)]"}`}
      aria-hidden="true"
    >
      <Building2 size={17} />
    </span>
  );
}

function GlobalSearch({
  navigation,
  onClose,
}: {
  navigation: NavigationItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => inputRef.current?.focus(), []);
  const matches = navigation.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function searchKnowledge(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    onClose();
    router.push(`/app/processes?q=${encodeURIComponent(value)}`);
  }
  return (
    <DialogSurface onClose={onClose} label="Search company knowledge">
      <section
        className="dialog-content w-full max-w-2xl overflow-hidden rounded-[16px] border border-white/30 bg-white shadow-[var(--opryn-shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={searchKnowledge}
          className="flex items-center gap-3 border-b border-[var(--opryn-line)] px-5"
        >
          <Search className="size-5 text-[var(--opryn-blue)]" />
          <input
            ref={inputRef}
            aria-label="Search company knowledge"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company knowledge…"
            className="h-16 min-w-0 flex-1 bg-transparent text-base text-[var(--opryn-navy)] outline-none placeholder:text-[var(--opryn-faint)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-[7px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
        </form>
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {query.trim() ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push(
                  `/app/processes?q=${encodeURIComponent(query.trim())}`,
                );
              }}
              className="flex w-full items-center gap-3 rounded-[10px] bg-[var(--opryn-blue-surface)] p-3 text-left text-sm font-semibold text-[var(--opryn-blue)] hover:bg-[#e8f1ff]"
            >
              <KnowledgeIcon size={18} /> Search company knowledge for “
              {query.trim()}” <ArrowRight className="ml-auto size-4" />
            </button>
          ) : (
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold text-[var(--opryn-faint)]">
              GO TO
            </p>
          )}
          {matches.slice(0, 7).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="mt-1 flex items-center gap-3 rounded-[10px] px-3 py-3 text-sm font-medium text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)] hover:text-[var(--opryn-navy)]"
              >
                <Icon size={18} /> {item.label}
              </Link>
            );
          })}
        </div>
      </section>
    </DialogSurface>
  );
}
