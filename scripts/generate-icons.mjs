import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "sf-logo-improved.png");
const PUBLIC = path.join(ROOT, "public");

async function generateRegularIcons() {
  const sizes = [
    { name: "favicon-16x16.png", size: 16 },
    { name: "favicon-32x32.png", size: 32 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "icon-192.png", size: 192 },
    { name: "icon-512.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC, name));
    console.log(`Generated ${name} (${size}x${size})`);
  }
}

async function generateMaskableIcons() {
  // Maskable icons need ~20% safe zone on each side
  // The logo should occupy ~60% of the icon area, centered on a solid background
  const sizes = [
    { name: "icon-192-maskable.png", size: 192 },
    { name: "icon-512-maskable.png", size: 512 },
  ];

  for (const { name, size } of sizes) {
    const logoSize = Math.round(size * 0.6);
    const padding = Math.round((size - logoSize) / 2);

    const resizedLogo = await sharp(SOURCE)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 30, g: 27, b: 75, alpha: 255 }, // indigo-950 (#1e1b4b)
      },
    })
      .composite([{ input: resizedLogo, left: padding, top: padding }])
      .png()
      .toFile(path.join(PUBLIC, name));

    console.log(`Generated ${name} (${size}x${size}, maskable with white bg)`);
  }
}

async function generateOgImage() {
  const width = 1200;
  const height = 630;
  const logoSize = 180;

  // Create gradient background using SVG
  const gradientSvg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6366f1"/>
          <stop offset="50%" style="stop-color:#8b5cf6"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
    </svg>`;

  const background = await sharp(Buffer.from(gradientSvg))
    .png()
    .toBuffer();

  // Create a white silhouette of the logo for better contrast on gradient bg
  // Extract alpha channel, then use it to create white-on-transparent version
  const resized = sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // Replace all RGB with white, keep alpha
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = 255;     // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
      // keep alpha as-is
    }
  }

  const whiteLogo = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  // Create text + layout as a single SVG overlay
  const logoTop = 120;
  const titleY = logoTop + logoSize + 70;
  const subtitleY = titleY + 55;

  const textSvg = `
    <svg width="${width}" height="${height}">
      <text x="${width / 2}" y="${titleY}"
        text-anchor="middle"
        font-family="Segoe UI, system-ui, -apple-system, sans-serif"
        font-weight="700" font-size="72" fill="white">StemForge</text>
      <text x="${width / 2}" y="${subtitleY}"
        text-anchor="middle"
        font-family="Segoe UI, system-ui, -apple-system, sans-serif"
        font-weight="400" font-size="32" fill="rgba(255,255,255,0.85)">AI-powered structured learning</text>
    </svg>`;

  const textOverlay = await sharp(Buffer.from(textSvg))
    .resize(width, height)
    .png()
    .toBuffer();

  const logoLeft = Math.round((width - logoSize) / 2);

  await sharp(background)
    .composite([
      { input: whiteLogo, left: logoLeft, top: logoTop },
      { input: textOverlay, left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(PUBLIC, "og-image.png"));

  console.log(`Generated og-image.png (${width}x${height})`);
}

async function main() {
  console.log("Generating icons from:", SOURCE);
  console.log("Output directory:", PUBLIC);
  console.log("");

  await generateRegularIcons();
  console.log("");
  await generateMaskableIcons();
  console.log("");
  await generateOgImage();
  console.log("");
  console.log("Done! All assets generated.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
