// Platform exports from the generated wallet artwork. Run from the project root.
const path = require('node:path');
const Jimp = require('jimp-compact');

async function main() {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'assets', 'images');
  const source = await Jimp.read(path.join(output, 'wallet-source.png'));
  let left = source.bitmap.width, top = source.bitmap.height, right = 0, bottom = 0;
  source.scan(0, 0, source.bitmap.width, source.bitmap.height, function (x, y, offset) {
    if (this.bitmap.data[offset + 3] > 32) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  });
  const mark = source.clone().crop(left, top, right - left + 1, bottom - top + 1);
  const place = (canvas, artwork) => canvas.composite(artwork,
    Math.round((1024 - artwork.bitmap.width) / 2), Math.round((1024 - artwork.bitmap.height) / 2));
  const iconMark = mark.clone().resize(720, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  const icon = place(new Jimp(1024, 1024, '#176346'), iconMark);
  icon.scan(0, 0, 1024, 1024, function (_x, _y, offset) { this.bitmap.data[offset + 3] = 255; });
  icon.rgba(false);
  await icon.writeAsync(path.join(output, 'wallet-icon.png'));

  // All visible foreground pixels stay inside a 600px circle on the 1024px layer.
  // Android masks a smaller area of an adaptive layer than iOS masks of its icon.
  let radius = 0;
  mark.scan(0, 0, mark.bitmap.width, mark.bitmap.height, function (x, y, offset) {
    if (this.bitmap.data[offset + 3] > 32) radius = Math.max(radius,
      Math.hypot(x - this.bitmap.width / 2, y - this.bitmap.height / 2));
  });
  const foregroundMark = mark.clone().resize(Math.floor(mark.bitmap.width * 300 / radius), Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  const foreground = place(new Jimp(1024, 1024, 0x00000000), foregroundMark);
  await foreground.writeAsync(path.join(output, 'wallet-adaptive-foreground.png'));
  const monochrome = foreground.clone();
  monochrome.scan(0, 0, 1024, 1024, function (_x, _y, offset) {
    this.bitmap.data[offset] = 255;
    this.bitmap.data[offset + 1] = 255;
    this.bitmap.data[offset + 2] = 255;
  });
  await monochrome.writeAsync(path.join(output, 'wallet-monochrome.png'));
  await icon.clone().resize(256, 256, Jimp.RESIZE_BICUBIC).writeAsync(path.join(output, 'wallet-preview.png'));
  console.log('Exported 1024px wallet icons, adaptive foreground, monochrome layer, and preview.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
