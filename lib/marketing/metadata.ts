import type { Metadata } from "next";

export function publicMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const url = `https://www.opryn.app${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Opryn", type: "website" },
    twitter: { card: "summary", title, description },
  };
}
