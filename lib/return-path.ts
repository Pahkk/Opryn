export function safeAppReturnPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://opryn.local");
    const isAppPath =
      url.pathname === "/app" ||
      url.pathname.startsWith("/app/") ||
      url.pathname === "/onboarding";
    if (url.origin !== "https://opryn.local" || !isAppPath) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
