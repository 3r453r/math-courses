import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "sf-logo-improved.png");
const OUTPUT = path.join(ROOT, "public", "favicon.ico");

// ICO file format: header + directory entries + PNG image data
// Modern browsers support PNG-in-ICO
async function generateIco() {
  const sizes = [16, 32, 48];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
  }

  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);           // Reserved
  header.writeUInt16LE(1, 2);           // Type: 1 = ICO
  header.writeUInt16LE(sizes.length, 4); // Number of images

  // Directory entries: 16 bytes each
  const dirSize = 16 * sizes.length;
  const dataOffset = 6 + dirSize;

  let currentOffset = dataOffset;
  const dirEntries = Buffer.alloc(dirSize);

  for (let i = 0; i < sizes.length; i++) {
    const offset = i * 16;
    const size = sizes[i];
    const pngBuf = pngBuffers[i];

    dirEntries.writeUInt8(size < 256 ? size : 0, offset);      // Width (0 = 256)
    dirEntries.writeUInt8(size < 256 ? size : 0, offset + 1);  // Height
    dirEntries.writeUInt8(0, offset + 2);    // Color palette count (0 = no palette)
    dirEntries.writeUInt8(0, offset + 3);    // Reserved
    dirEntries.writeUInt16LE(1, offset + 4); // Color planes
    dirEntries.writeUInt16LE(32, offset + 6); // Bits per pixel
    dirEntries.writeUInt32LE(pngBuf.length, offset + 8);   // Size of image data
    dirEntries.writeUInt32LE(currentOffset, offset + 12);   // Offset to image data

    currentOffset += pngBuf.length;
  }

  const ico = Buffer.concat([header, dirEntries, ...pngBuffers]);
  fs.writeFileSync(OUTPUT, ico);
  console.log(`Generated favicon.ico (${sizes.join(", ")}px) — ${ico.length} bytes`);
}

generateIco().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
