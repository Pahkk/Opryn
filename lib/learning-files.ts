// Shared by the browser picker and server validation. Keep uploads below the
// hosting platform's request-body limit, including multipart overhead.
export const LEARNING_FILE_MAX_BYTES = 4_000_000;
export const LEARNING_TEXT_MAX_BYTES = 100_000;
export const LEARNING_FILE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};
export const LEARNING_FILE_ACCEPT = Object.keys(LEARNING_FILE_TYPES)
  .map((extension) => `.${extension}`)
  .join(",");
export const LEARNING_FILE_HELP =
  "PNG, JPG/JPEG, WebP, PDF, Word (.docx or .doc), TXT, Markdown, CSV, or JSON. Images and documents: up to 4 MB each. Text files: up to 100 KB each.";

export function learningFileType(file: {
  name: string;
  size: number;
  type: string;
}) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = LEARNING_FILE_TYPES[extension];
  const text = ["txt", "md", "csv", "json"].includes(extension);
  if (!mime)
    throw new Error(
      "Choose a supported image, PDF, Word document, or text file.",
    );
  if (!file.size)
    throw new Error(`${file.name} is empty. Choose a file with content.`);
  if (file.size > (text ? LEARNING_TEXT_MAX_BYTES : LEARNING_FILE_MAX_BYTES))
    throw new Error(
      `${file.name} is too large. ${text ? "Text files can be up to 100 KB." : "Images and documents can be up to 4 MB."}`,
    );
  // Some OS pickers omit MIME types or report generic binary data. The server
  // also checks signatures; never use a browser-supplied MIME as the authority.
  if (
    !text &&
    file.type &&
    file.type !== "application/octet-stream" &&
    file.type !== mime
  )
    throw new Error(
      `${file.name} has a file type that does not match its extension.`,
    );
  return { extension, mime, text };
}
