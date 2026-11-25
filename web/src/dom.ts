// Pieces the pages share: building elements and showing a result.
import { estimated, type Area, type Ball, type SnapshotEntry, type UnitArea } from "./snapshot";

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

// The numbers of the bars, written on every bar chart of the page or left to
// hovering: one switch for all of them, remembered in this browser.
try {
  if (localStorage.getItem("show-values")) document.body.classList.add("show-values");
} catch {
  // Without storage the switch starts off.
}

export function valuesSwitch(): HTMLElement {
  const button = element(
    "button",
    { type: "button", class: "values-switch", "aria-pressed": String(document.body.classList.contains("show-values")) },
    "Values",
  );
  button.addEventListener("click", () => {
    const on = document.body.classList.toggle("show-values");
    try {
      if (on) localStorage.setItem("show-values", "1");
      else localStorage.removeItem("show-values");
    } catch {
      // Not remembered.
    }
    for (const other of document.querySelectorAll(".values-switch")) other.setAttribute("aria-pressed", String(on));
  });
  return button;
}

export function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
}

// Watts as mW, or µW below a milliwatt.
export const watts = (w: number) => (w >= 1e-3 ? `${(w * 1e3).toPrecision(3)} mW` : `${(w * 1e6).toPrecision(3)} µW`);

export const um2 = (value: number) => `${Math.round(value).toLocaleString("en-US")} µm²`;

// Compact: 30.85 mm², 0.014 mm²; below 0.01 mm² in µm² (trace: 324 µm²).
export function mm2(value: number): string {
  const mm = value / 1e6;
  if (mm < 0.01) return `${Math.round(value).toLocaleString("en-US")} µm²`;
  return `${mm >= 1 ? mm.toFixed(2) : mm.toPrecision(2)} mm²`;
}

export function label(entry: SnapshotEntry): string {
  const d = new Date(entry.taken);
  const two = (n: number) => String(n).padStart(2, "0");
  const taken = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
  return taken;
}

// The owner of a Ball, a thread or a hart: the prefab, or the design whose
// balls/, threads/ or harts/ it sits in.
export function owner(path: string): string {
  const design = path.match(/^examples\/designs\/([^/]+)\/(balls|threads|harts)\//);
  return design ? design[1] : "prefab";
}

export type State = "met" | "violated" | "failed" | "none";

export function state(area: Area | UnitArea | undefined): State {
  if (area === undefined) return "none";
  if (area.status !== "pass") return "failed";
  return area.constraints_met ? "met" : "violated";
}

// Areas span five decades (trace 324 µm², mxmm 30 mm²) and power about as
// many: their bars are log scale over every Ball, so cards compare at a glance.
export function logScale(values: number[]): (value: number) => number {
  if (!values.length) return () => 0;
  const low = Math.log10(Math.min(...values));
  const high = Math.log10(Math.max(...values));
  return (value) => 4 + (96 * (Math.log10(value) - low)) / (high - low || 1);
}

export interface Scales {
  area: (um2: number) => number;
  power: (w: number) => number;
}

export function scales(found: Ball[]): Scales {
  return {
    area: logScale(found.flatMap((b) => (b.area?.status === "pass" ? [b.area.ball_um2] : []))),
    power: logScale(found.flatMap((b) => (b.power?.status === "pass" ? [b.power.total_w] : []))),
  };
}

// A Ball's results as bars: Area green when DC met its constraints, red when
// not; Power is the Ball's total; UVM is the coverage, green when the test
// passed, red when it failed. Each bar links to its page of the analysis.
export function figures(ball: Ball, scale: Scales, page: string): HTMLElement {
  const row = (name: string, width: number, tone: string, value: string) =>
    element(
      "a",
      { class: `figure ${tone}`, href: `${page}#${name.toLowerCase()}` },
      element("span", { class: "name" }, name),
      element("span", { class: "track" }, element("span", { style: `width: ${width}%` })),
      element("span", { class: "value" }, value),
    );
  const { area, power, uvm } = ball;
  return element(
    "div",
    { class: "figures" },
    area?.status === "pass"
      ? row("Area", scale.area(area.ball_um2), state(area), mm2(area.ball_um2))
      : row("Area", area ? 100 : 0, area ? "failed" : "", area ? "failed" : "—"),
    power?.status === "pass"
      ? row("Power", scale.power(power.total_w), "neutral", (estimated(power) ? "≈ " : "") + watts(power.total_w))
      : row("Power", power ? 100 : 0, power ? "failed" : "", power ? "failed" : "—"),
    uvm?.status === "pass"
      ? row("UVM", Number(uvm.coverage.SCORE), "met", `${Number(uvm.coverage.SCORE).toFixed(1)} %`)
      : row("UVM", uvm ? 100 : 0, uvm ? "failed" : "", uvm ? "failed" : "—"),
  );
}
