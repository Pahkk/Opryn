// Mechanical crop/resize of the supplied artwork; never redraw the brand.
// Usage: node scripts/generate-favicons.mjs /path/to/OprynLogo.png
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

if (!process.argv[2]) throw new Error("Provide the original Opryn symbol PNG.");
const { data, info } = await sharp(process.argv[2])
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let left = info.width,
  top = info.height,
  right = -1,
  bottom = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    // Remove only the near-white background. Keep all colored artwork intact.
    if (Math.min(data[i], data[i + 1], data[i + 2]) > 240) data[i + 3] = 0;
    if (data[i + 3]) {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
}
if (right < left) throw new Error("No symbol found in source.");
const cropped = await sharp(data, { raw: info })
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png()
  .toBuffer();
async function icon(size, apple = false) {
  const inset = apple ? 12 : 1;
  const symbol = await sharp(cropped)
    .resize(size - inset * 2, size - inset * 2, {
      fit: "contain",
      background: "#00000000",
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: apple ? "#ffffff" : "#00000000",
    },
  })
    .composite([{ input: symbol, gravity: "centre" }])
    .png()
    .toBuffer();
}
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => icon(size)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await Promise.all([
  writeFile("app/favicon.ico", Buffer.concat([header, ...images])),
  writeFile("public/favicon-16x16.png", images[0]),
  writeFile("public/favicon-32x32.png", images[1]),
  writeFile("public/favicon-48x48.png", images[2]),
  writeFile("public/apple-touch-icon.png", await icon(180, true)),
]);
console.log(
  "Created 16/32/48 ICO and transparent PNGs, plus an opaque 180px Apple touch icon.",
);
