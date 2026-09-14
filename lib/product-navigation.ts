/** Stable route ownership; Teach must not also select Knowledge. */
export function isProductRouteActive(href: string, pathname: string) {
  if (href === "/app") return pathname === href;
  if (href === "/app/processes")
    return (
      (pathname.startsWith("/app/processes") &&
        !pathname.startsWith("/app/processes/new")) ||
      pathname.startsWith("/app/knowledge/")
    );
  if (href === "/app/integrations")
    return (
      pathname.startsWith(href) || pathname.startsWith("/app/ai-connections")
    );
  return pathname === href || pathname.startsWith(`${href}/`);
}
