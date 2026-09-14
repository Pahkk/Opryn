import "server-only";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const GOOGLE_HOSTS = new Set(["docs.google.com", "drive.google.com"]);

export async function importSharedGoogleDriveText(rawUrl: string) {
  const source = parseGoogleDriveUrl(rawUrl);
  const response = await fetch(source.downloadUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "Opryn Google Drive Import/1.0" },
  });
  if (!response.ok)
    throw new Error(
      "Opryn couldn't open this Drive file. Set General access to ‘Anyone with the link,’ then try again.",
    );
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES)
    throw new Error("This Drive file is too large. Use a file under 10 MB.");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html"))
    throw new Error(
      "Google asked Opryn to sign in. Share the file with ‘Anyone with the link,’ then try again.",
    );
  if (
    !contentType.includes("text/") &&
    !contentType.includes("csv") &&
    !contentType.includes("json")
  )
    throw new Error(
      "This Drive format isn't supported yet. Use a Google Doc, Google Sheet, TXT, CSV, or JSON file.",
    );
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMPORT_BYTES)
    throw new Error("This Drive file is too large. Use a file under 10 MB.");
  const text = buffer.toString("utf8").replace(/\u0000/g, "").trim();
  if (text.length < 20)
    throw new Error("Opryn couldn't find enough readable text in this file.");
  if (text.length > 100_000)
    throw new Error(
      "This Drive file contains too much text. Import a smaller file first.",
    );
  return { text, sourceUrl: source.canonicalUrl };
}

function parseGoogleDriveUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Paste a valid Google Drive sharing link.");
  }
  if (url.protocol !== "https:" || !GOOGLE_HOSTS.has(url.hostname))
    throw new Error("Paste a link from Google Drive, Docs, or Sheets.");

  const doc = url.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (url.hostname === "docs.google.com" && doc)
    return {
      canonicalUrl: `https://docs.google.com/document/d/${doc[1]}/view`,
      downloadUrl: `https://docs.google.com/document/d/${doc[1]}/export?format=txt`,
    };

  const sheet = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (url.hostname === "docs.google.com" && sheet)
    return {
      canonicalUrl: `https://docs.google.com/spreadsheets/d/${sheet[1]}/view`,
      downloadUrl: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv`,
    };

  const driveFile =
    url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.searchParams.get("id");
  if (url.hostname === "drive.google.com" && driveFile)
    return {
      canonicalUrl: `https://drive.google.com/file/d/${driveFile}/view`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFile)}`,
    };

  throw new Error(
    "Use a sharing link for a Google Doc, Google Sheet, or Drive text file.",
  );
}
