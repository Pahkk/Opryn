"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountControls, useAuth } from "./auth";
import { Logo } from "./ui";
import { company } from "@/lib/marketing/company";

const links = [
  ["Product", "/#inside-opryn"],
  ["Integrations", "/integrations"],
  ["AI", "/ai"],
  ["Pricing", "/pricing"],
];

export function Navbar() {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`public-nav fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${scrolled ? "is-scrolled border-b border-[#e3e8ef] bg-[#fbfcfe]" : "bg-transparent"}`}
    >
      <div className="container-shell flex h-[76px] items-center justify-between">
        <Logo />
        <nav
          className="hidden items-center gap-7 lg:flex"
          aria-label="Main navigation"
        >
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="nav-link relative py-2 text-[13px] font-medium text-[#576274] transition-colors hover:text-[#111b2e]"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <AccountControls />
          ) : (
            <Link className="button button-ghost" href="/login">
              Sign In
            </Link>
          )}
          <Link
            className="button button-primary"
            href={user ? "/app" : "/signup"}
          >
            {user ? "Open Opryn" : "Get Started"}
          </Link>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl border border-[#dce2e9] bg-white lg:hidden"
          onClick={() => setMenu(!menu)}
          aria-expanded={menu}
          aria-label="Toggle navigation menu"
          aria-controls="public-mobile-navigation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenu(false);
          }}
        >
          {menu ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>
      {menu && (
        <nav
          id="public-mobile-navigation"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenu(false);
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-controls="public-mobile-navigation"]',
                )
                ?.focus();
            }
          }}
          className="public-mobile-menu mobile-menu-in border-t border-[#e4e8ee] bg-white px-5 py-4 shadow-lg lg:hidden"
          aria-label="Mobile navigation"
        >
          <div className="mx-auto flex max-w-[640px] flex-col">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenu(false)}
                className="border-b border-[#edf0f4] py-3.5 text-sm font-medium"
              >
                {label}
              </a>
            ))}
            {user ? (
              <AccountControls mobile />
            ) : (
              <Link className="py-3.5 text-sm font-medium" href="/login">
                Sign In
              </Link>
            )}
            <Link
              className="button button-primary mt-2"
              href={user ? "/app" : "/signup"}
              onClick={() => setMenu(false)}
            >
              {user ? "Open Opryn" : "Get Started"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="public-footer editorial-footer border-t border-[#dfe5ed] bg-[#f8f9fb] py-8 text-[#10213d]">
      <div className="container-shell editorial-footer-brand">
        <Logo />
        <p>
          Operational knowledge
          <br />
          for your people and AI.
        </p>
      </div>
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
