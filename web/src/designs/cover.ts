// A design's cover, drawn from what it is made of: each hart a panel, its
// threads rows in it, their balls cells, in the design's own hue. Two designs
// differ in their covers as they differ in their composition.
import type { Overview } from "./data";
import { hue } from "./hue";

const svgNs = "http://www.w3.org/2000/svg";

function rect(x: number, y: number, w: number, h: number, fill: string, opacity = 1): SVGRectElement {
  const r = document.createElementNS(svgNs, "rect");
  r.setAttribute("x", String(x));
  r.setAttribute("y", String(y));
  r.setAttribute("width", String(w));
  r.setAttribute("height", String(h));
  r.setAttribute("fill", fill);
  r.setAttribute("opacity", String(opacity));
  return r;
}

export function cover(design: string, overview: Overview, withTitle: boolean): SVGSVGElement {
  const h = hue(design);
  const size = 100;
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("class", "cover");
  svg.append(rect(0, 0, size, size, `hsl(${h} 45% 16%)`));
  // Diagonal light bands behind the composition.
  for (let i = 0; i < 4; i++) {
    const band = document.createElementNS(svgNs, "polygon");
    const x = -40 + i * 38;
    band.setAttribute("points", `${x},${size} ${x + 18},${size} ${x + 78},0 ${x + 60},0`);
    band.setAttribute("fill", `hsl(${h + i * 12} 70% 60%)`);
    band.setAttribute("opacity", String(0.06 + 0.03 * i));
    svg.append(band);
  }
  const pad = 10;
  const { harts, threads } = overview;
  // Harts on a grid; in each, its threads as rows of ball cells, or its own
  // accelerator's balls as one block of cells, or else one solid CPU block.
  const area = withTitle ? 64 : 80;
  const cols = Math.ceil(Math.sqrt(harts.length));
  const rows = Math.ceil(harts.length / Math.max(cols, 1));
  const gap = harts.length > 8 ? 2 : 4;
  const hartW = (size - 2 * pad - (cols - 1) * gap) / Math.max(cols, 1);
  const hartH = (area - (rows - 1) * gap) / Math.max(rows, 1);
  const cells = (x: number, y: number, w: number, hh: number, balls: string[], shade: number) => {
    const n = Math.ceil(Math.sqrt(balls.length));
    const m = Math.ceil(balls.length / n);
    const cw = (w - (n - 1) * 2) / n;
    const ch = (hh - (m - 1) * 2) / m;
    balls.forEach((_, k) =>
      svg.append(rect(x + (k % n) * (cw + 2), y + Math.floor(k / n) * (ch + 2), cw, ch, `hsl(${h + k * 25} 75% ${shade}%)`, 0.9)),
    );
  };
  let next = 0;
  harts.forEach((hart, i) => {
    const x = pad + (i % cols) * (hartW + gap);
    const y0 = pad + Math.floor(i / cols) * (hartH + gap);
    svg.append(rect(x, y0, hartW, hartH, `hsl(${h} 60% 55%)`, 0.18));
    const own = threads.slice(next, next + hart.threads);
    next += hart.threads;
    const inset = Math.min(3, hartW / 6);
    if (own.length) {
      const rowH = (hartH - 2 * inset - (own.length - 1) * 2) / own.length;
      own.forEach((thread, j) => {
        const y = y0 + inset + j * (rowH + 2);
        const cellW = (hartW - 2 * inset - (thread.balls.length - 1) * 2) / thread.balls.length;
        thread.balls.forEach((_, k) =>
          svg.append(rect(x + inset + k * (cellW + 2), y, cellW, rowH, `hsl(${h + k * 25} 75% ${58 + (j % 2) * 8}%)`, 0.9)),
        );
      });
    } else if (hart.balls?.length) {
      cells(x + inset, y0 + inset, hartW - 2 * inset, hartH - 2 * inset, hart.balls, 62);
    } else {
      svg.append(rect(x + hartW * 0.25, y0 + hartH * 0.25, hartW * 0.5, hartH * 0.5, `hsl(${h} 70% 62%)`, 0.85));
    }
  });
  if (withTitle) {
    const title = document.createElementNS(svgNs, "text");
    title.setAttribute("x", String(pad));
    title.setAttribute("y", String(size - 9));
    title.setAttribute("class", "cover-title");
    title.textContent = design;
    svg.append(title);
  }
  return svg;
}
