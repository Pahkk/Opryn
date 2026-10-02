"use client";

import {
  ArrowUpRight,
  BookOpen,
  Bot,
  ChevronDown,
  CircleCheck,
  Menu,
  Network,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AccountControls, useAuth } from "./auth";
import { PublicHomeLogo } from "@/components/marketing/editorial-motion";
import { company } from "@/lib/marketing/company";
import { MotionRegion } from "@/components/motion/motion-region";
import { MotionButton } from "@/components/motion/motion-button";
import {
  PublicAction,
  PublicReveal,
} from "@/components/marketing/public-motion";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { usePathname } from "next/navigation";

const navGroups = {
  Product: {
    eyebrow: "How Opryn works",
    description:
      "Turn what your business knows into reviewed answers people can trust.",
    links: [
      {
        label: "The Opryn loop",
        detail: "Teach, review, approve, reuse",
        href: "/#how-it-works",
        icon: Network,
      },
      {
        label: "Ask your company",
        detail: "Answers grounded in approved knowledge",
        href: "/#answer-everywhere",
        icon: BookOpen,
      },
      {
        label: "Human review",
        detail: "People decide what becomes official",
        href: "/#review",
        icon: CircleCheck,
      },
    ],
  },
  Integrations: {
    eyebrow: "Connected knowledge",
    description:
      "Choose what Opryn can learn from and where approved guidance can be used.",
    links: [
      {
        label: "All integrations",
        detail: "Explore supported connections",
        href: "/integrations",
        icon: Network,
      },
      {
        label: "Connected AI",
        detail: "Controlled access to company context",
        href: "/ai",
        icon: Bot,
      },
    ],
  },
  AI: {
    eyebrow: "AI with company context",
    description:
      "Give compatible AI access to approved knowledge—not permission to invent policy.",
    links: [
      {
        label: "Opryn for AI",
        detail: "See the controlled knowledge flow",
        href: "/ai",
        icon: Bot,
      },
      {
        label: "Source-backed answers",
        detail: "Keep provenance attached",
        href: "/#knowledge-loop",
        icon: BookOpen,
      },
    ],
  },
} as const;

type NavGroup = keyof typeof navGroups;

function isGroupActive(group: NavGroup, pathname: string) {
  if (group === "Product") return pathname === "/";
  if (group === "Integrations") return pathname === "/integrations";
  return pathname === "/ai";
}

export function Navbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const reduced = useProductReducedMotion();
  const [menu, setMenu] = useState(false);
  const [openGroup, setOpenGroup] = useState<NavGroup | null>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const navigatePublic = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    closeMenu = false,
  ) => {
    if (href.startsWith("/#") && pathname === "/") {
      event.preventDefault();
      const anchor = href.slice(2);
      const target = document.getElementById(anchor);
      if (target) {
        target.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
        window.history.replaceState(null, "", `#${anchor}`);
      }
    } else if (!href.includes("#")) {
      event.preventDefault();
      // A public route should begin at its own introduction, never inherit the
      // prior page's scroll offset. A document navigation is intentional here.
      window.location.assign(href);
    }
    if (closeMenu) setMenu(false);
    setOpenGroup(null);
  };
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenGroup(null);
      setMenu(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  return (
    <header
      className={`public-nav opryn-skipper-nav fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${scrolled || openGroup ? "is-scrolled border-b border-[#e3e8ef] bg-[#fbfcfe]" : "bg-transparent"}`}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpenGroup(null);
      }}
    >
      <div className="container-shell flex h-[76px] items-center justify-between">
        <PublicHomeLogo />
        <MotionTabs>
          <nav
            className="opryn-desktop-nav hidden items-center lg:flex"
            aria-label="Main navigation"
          >
            {(Object.keys(navGroups) as NavGroup[]).map((label) => {
              const active = isGroupActive(label, pathname);
              const expanded = openGroup === label;
              return (
                <button
                  type="button"
                  key={label}
                  className="nav-link opryn-nav-trigger relative"
                  aria-expanded={expanded}
                  aria-controls="opryn-public-nav-panel"
                  aria-current={active ? "page" : undefined}
                  onPointerEnter={() => setOpenGroup(label)}
                  onFocus={() => setOpenGroup(label)}
                  onClick={() => setOpenGroup(expanded ? null : label)}
                >
                  <span>{label}</span>
                  <ChevronDown aria-hidden="true" size={13} />
                  {active ? <ActiveIndicator /> : null}
                </button>
              );
            })}
            <Link
              href="/pricing"
              scroll={false}
              aria-current={pathname === "/pricing" ? "page" : undefined}
              className="nav-link opryn-nav-direct relative"
              onClick={(event) => navigatePublic(event, "/pricing")}
              onPointerEnter={() => setOpenGroup(null)}
              onFocus={() => setOpenGroup(null)}
            >
              Pricing
              {pathname === "/pricing" ? <ActiveIndicator /> : null}
            </Link>
          </nav>
        </MotionTabs>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <AccountControls />
          ) : (
            <Link className="button button-ghost" href="/login">
              Sign In
            </Link>
          )}
          <PublicAction rolling href={user ? "/app" : "/signup"}>
            {user ? "Open Opryn" : "Get Started"}
          </PublicAction>
        </div>
        <MotionButton
          type="button"
          className="grid size-11 place-items-center rounded-xl border border-[#dce2e9] bg-white lg:hidden"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label="Toggle navigation menu"
          aria-controls={menu ? "public-mobile-navigation" : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenu(false);
          }}
        >
          {menu ? <X size={19} /> : <Menu size={19} />}
        </MotionButton>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {openGroup ? (
          <motion.div
            id="opryn-public-nav-panel"
            key={openGroup}
            className="opryn-nav-panel hidden lg:block"
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{
              duration: reduced ? 0 : 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
            onFocusCapture={() => setOpenGroup(openGroup)}
          >
            <div className="container-shell opryn-nav-panel-grid">
              <div className="opryn-nav-panel-intro">
                <span>{navGroups[openGroup].eyebrow}</span>
                <p>{navGroups[openGroup].description}</p>
              </div>
              <div className="opryn-nav-panel-links">
                {navGroups[openGroup].links.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.href}
                      initial={reduced ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: reduced ? 0 : 0.18,
                        delay: reduced ? 0 : index * 0.035,
                      }}
                    >
                      <Link
                        href={item.href}
                        scroll
                        onClick={(event) => navigatePublic(event, item.href)}
                      >
                        <span className="opryn-nav-panel-icon">
                          <Icon size={17} />
                        </span>
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <ArrowUpRight aria-hidden="true" size={15} />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {menu ? (
          <motion.nav
            id="public-mobile-navigation"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              duration: reduced ? 0 : 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="public-mobile-menu opryn-mobile-nav border-t border-[#e4e8ee] bg-white shadow-lg lg:hidden"
            aria-label="Mobile navigation"
          >
            <MotionRegion
              variant="status"
              className="mx-auto max-w-[640px] px-5 py-5"
            >
              {(Object.keys(navGroups) as NavGroup[]).map((group) => (
                <section className="opryn-mobile-nav-group" key={group}>
                  <p>{group}</p>
                  {navGroups[group].links.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      scroll
                      onClick={(event) =>
                        navigatePublic(event, item.href, true)
                      }
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight aria-hidden="true" size={14} />
                    </Link>
                  ))}
                </section>
              ))}
              <Link
                className="opryn-mobile-pricing"
                href="/pricing"
                scroll
                onClick={(event) => navigatePublic(event, "/pricing", true)}
              >
                Pricing
              </Link>
              <div className="opryn-mobile-nav-actions">
                {user ? (
                  <AccountControls mobile />
                ) : (
                  <Link href="/login">Sign In</Link>
                )}
                <PublicAction
                  rolling
                  href={user ? "/app" : "/signup"}
                  onClick={() => setMenu(false)}
                >
                  {user ? "Open Opryn" : "Get Started"}
                </PublicAction>
              </div>
            </MotionRegion>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="public-footer editorial-footer border-t border-[#dfe5ed] bg-[#f8f9fb] py-8 text-[#10213d]">
      <PublicReveal className="container-shell editorial-footer-brand">
        <PublicHomeLogo />
        <p>
          Company knowledge
          <br />
          for your people and AI.
        </p>
      </PublicReveal>
      <div className="container-shell launch-footer">
        {[
          [
            "Product",
            [
              ["How It Works", "/#how-it-works"],
              ["Integrations", "/integrations"],
              ["AI Connections", "/ai"],
              ["Pricing", "/pricing"],
            ],
          ],
          [
            "Company",
            [
              ["About", "/about"],
              ["Security", "/security"],
              ["Contact", "/contact"],
            ],
          ],
          [
            "Legal",
            [
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
            ],
          ],
          [
            "Account",
            [
              ["Sign In", "/login"],
              ["Get Started", "/signup"],
            ],
          ],
        ].map(([label, items]) => (
          <nav key={label as string} aria-label={`${label} footer links`}>
            <strong>{label as string}</strong>
            {(items as string[][]).map(([text, href]) => (
              <Link key={href} href={href}>
                {text}
              </Link>
            ))}
          </nav>
        ))}
        <p className="launch-footer-note">
          © 2026 Opryn.
          {company.supportEmail ? (
            <>
              {" "}
              ·{" "}
              <a href={`mailto:${company.supportEmail}`}>
                {company.supportEmail}
              </a>
            </>
          ) : null}
        </p>
      </div>
    </footer>
  );
}
