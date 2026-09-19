import { buildQrCells } from './qr';

describe('buildQrCells', () => {
  it('returns a square matrix', () => {
    const cells = buildQrCells('https://example.com/post');
    expect(cells.length).toBeGreaterThan(0);
    for (const row of cells) {
      expect(row.length).toBe(cells.length);
    }
  });

  it('has at least one dark cell', () => {
    const cells = buildQrCells('https://example.com/post');
    const hasDark = cells.some((row) => row.some((cell) => cell));
    expect(hasDark).toBe(true);
  });

  it('is deterministic for the same text', () => {
    const first = buildQrCells('https://example.com/post');
    const second = buildQrCells('https://example.com/post');
    expect(second).toEqual(first);
  });

  it('produces a different matrix for different text', () => {
    const a = buildQrCells('https://example.com/post');
    const b = buildQrCells('https://example.com/tv');
    expect(a).not.toEqual(b);
  });
});
