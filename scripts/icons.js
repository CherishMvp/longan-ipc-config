import fs from 'node:fs';
import path from 'node:path';
import png2icons from 'png2icons';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = fs.readFileSync(path.resolve(__dirname, '../public/icon.png'));

// Ensure output dir exists
const outDir = path.resolve(__dirname, '../electron/build');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Create ICO (Windows)
const ico = png2icons.createICO(input, png2icons.HERMITE, 0, false);
if (ico) {
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
  console.log('✅ Generated electron/build/icon.ico');
} else {
  console.error('❌ Failed to generate ICO');
}

// Create ICNS (Mac)
const icns = png2icons.createICNS(input, png2icons.HERMITE, 0);
if (icns) {
  fs.writeFileSync(path.join(outDir, 'icon.icns'), icns);
  console.log('✅ Generated electron/build/icon.icns');
} else {
  console.error('❌ Failed to generate ICNS');
}

// Copy PNG for Linux
fs.copyFileSync(
  path.resolve(__dirname, '../public/icon.png'), 
  path.join(outDir, 'icon.png')
);
console.log('✅ Copied electron/build/icon.png');
