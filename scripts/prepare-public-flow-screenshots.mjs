import sharp from "sharp";
import { join } from "node:path";

// Crop only browser QA captures. Never modifies supplied Opryn artwork.
const directory = join(process.cwd(), "artifacts/public-flow-redesign");
const crops = [
  ["home-desktop-full.png", "home-desktop-hero.png", 0, 805],
  ["home-desktop-full.png", "home-cobalt-section.png", 803, 1113],
  ["ai-desktop-full.png", "ai-desktop-hero.png", 0, 803],
  ["ai-desktop-full.png", "ai-permissions.png", 803, 645],
  ["ai-desktop-full.png", "ai-human-review.png", 1448, 802],
  ["pricing-desktop-full.png", "pricing-desktop-plans.png", 0, 1150],
  ["home-mobile-full.png", "home-mobile-hero.png", 0, 1320],
  ["ai-mobile-full.png", "ai-mobile-hero.png", 0, 1360],
  ["pricing-mobile-full.png", "pricing-mobile-plans.png", 0, 1850],
];
for (const [input, output, top, height] of crops) {
  const source = sharp(join(directory, input));
  const meta = await source.metadata();
  await source
    .extract({ left: 0, top, width: meta.width, height })
    .png()
    .toFile(join(directory, output));
}
const mobilePanels = await Promise.all(
  [
    "home-mobile-hero.png",
    "ai-mobile-hero.png",
    "pricing-mobile-plans.png",
  ].map((filename) =>
    sharp(join(directory, filename))
      .resize({ width: 390 })
      .extend({
        bottom: filename.startsWith("pricing")
          ? 0
          : filename.startsWith("ai")
            ? 490
            : 530,
        background: "#FFFCF7",
      })
      .png()
      .toBuffer(),
  ),
);
await sharp({
  create: { width: 1210, height: 1850, channels: 4, background: "#EAF4FF" },
})
  .composite(
    mobilePanels.map((input, index) => ({ input, left: index * 410, top: 0 })),
  )
  .png()
  .toFile(join(directory, "mobile-pages.png"));
console.log(
  "Prepared nine screenshot crops and a mobile contact sheet from actual browser captures.",
);
