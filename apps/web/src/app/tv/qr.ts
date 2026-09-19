import qrcode from 'qrcode-generator';

/**
 * A plain boolean module grid for `text`, `true` meaning "dark". Returned as data rather than
 * markup so `/tv` can render it as `@for`'d SVG `<rect>`s — the library's own
 * `createSvgTag()`/`createImgTag()` return HTML strings, which would need `[innerHTML]`, banned
 * repo-wide (spec §7.12/CLAUDE.md).
 */
export function buildQrCells(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const size = qr.getModuleCount();
  const cells: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(qr.isDark(row, col));
    }
    cells.push(line);
  }
  return cells;
}
