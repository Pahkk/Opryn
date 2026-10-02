import type { MetadataRoute } from "next";

const CANONICAL_ORIGIN = "https://www.opryn.app";
const PUBLIC_ROUTES = [
  "",
  "/about",
  "/ai",
  "/contact",
  "/integrations",
  "/pricing",
  "/privacy",
  "/security",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${CANONICAL_ORIGIN}${path || "/"}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
