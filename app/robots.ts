import type { MetadataRoute } from "next";

const CANONICAL_ORIGIN = "https://www.opryn.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/onboarding/"],
    },
    host: CANONICAL_ORIGIN,
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
