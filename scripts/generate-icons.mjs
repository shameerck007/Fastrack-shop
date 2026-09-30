import sharp from "sharp";
import path from "node:path";

const src = path.resolve("public/fastrack-logo-mark.png");
const outDir = path.resolve("public");

async function makeIcon(size, filename, { padding = 0.72, background = "#ffffff" } = {}) {
  const markSize = Math.round(size * padding);
  const mark = await sharp(src).resize(markSize, markSize, { fit: "contain" }).toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, filename));

  console.log(`wrote ${filename} (${size}x${size})`);
}

await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(180, "apple-touch-icon.png");
// Maskable icon needs more inner padding so OS-applied crop shapes don't clip the mark.
await makeIcon(512, "icon-maskable-512.png", { padding: 0.6 });
