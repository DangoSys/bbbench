// The analysis pieces the Ball, thread and hart pages share: tables, bar
// charts, the history of one evaluation, and the DC area and PrimeTime power
// of one run.
import { element, logScale, mm2, state, um2, valuesSwitch, watts } from "./dom";
import { estimated, type Tests, type DcArea, type PowerPassed, type Unit } from "./snapshot";

export function keyValues(rows: [string, string][]): HTMLElement {
  if (!rows.length) return element("p", { class: "muted" }, "None.");
  return element(
    "table",
    { class: "kv" },
    element("tbody", {}, ...rows.map(([k, v]) => element("tr", {}, element("th", {}, k), element("td", {}, v)))),
  );
}

export function section(title: string, ...body: (Node | string)[]): HTMLElement {
  return element("section", { class: "panel" }, element("h2", {}, title), ...body);
}

// A bar chart, one row per bar; clicking a bar shows its own analysis below.
export interface Bar {
  label: string;
  value: number;
  text: string;
  detail: () => HTMLElement[];
}

export function chart(bars: Bar[]): HTMLElement {
  const max = Math.max(...bars.map((b) => b.value), 0);
  const below = element("div", { class: "detail" });
  const rows = bars.map((bar) => {
    const row = element(
      "button",
      { type: "button", class: "row", title: `${bar.label}: ${bar.text}` },
      element("span", { class: "label" }, bar.label),
      element("span", { class: "track" }, element("span", { style: `width: ${max > 0 ? (100 * bar.value) / max : 0}%` })),
      element("span", { class: "number" }, bar.text),
    );
    row.addEventListener("click", () => {
      for (const other of rows) other.removeAttribute("aria-pressed");
      row.setAttribute("aria-pressed", "true");
      below.replaceChildren(...bar.detail());
    });
    return row;
  });
  rows[0]?.click();
  return element("div", { class: "chart" }, element("div", { class: "rows" }, ...rows), below);
}

// The history of one evaluation, a plain bar chart: time across, the metric
// up, the newest of at most `shown` runs on the right; a failed run is a red
// mark on the axis. Clicking a bar opens that run's report below.
const shown = 20;

export interface Run {
  label: string;
  // From a commit with local changes, not a published (CI) one.
  dirty: boolean;
  axis: string;
  value: number | undefined;
  text: string;
  detail: () => HTMLElement[];
}

const svgNs = "http://www.w3.org/2000/svg";
function svg(tag: string, attributes: Record<string, string | number>, ...children: (Node | string)[]): SVGElement {
  const node = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  node.append(...children);
  return node;
}

// A round axis top and step: 0, 10, 20, 30, 40 for 30.85.
function ticks(top: number): number[] {
  const raw = top / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= raw)!;
  return Array.from({ length: Math.ceil(top / step) + 1 }, (_, i) => i * step);
}

export function history(all: Run[], unit: string, top?: number): HTMLElement {
  const bars = all.slice(-shown);
  const below = element("div", { class: "detail" });
  const [width, height, left, right, upper, lower] = [760, 260, 64, 12, 12, 56];
  const plotWidth = width - left - right;
  const plotHeight = height - upper - lower;
  const values = bars.flatMap((b) => (b.value === undefined ? [] : [b.value]));
  const marks = ticks(top ?? (Math.max(...values, 0) * 1.1 || 1));
  const yMax = marks.at(-1)!;
  const y = (v: number) => upper + plotHeight * (1 - v / yMax);
  const band = plotWidth / Math.max(bars.length, 10);
  const chart = svg("svg", { viewBox: `0 0 ${width} ${height}`, class: "plot", role: "img" });
  for (const m of marks)
    chart.append(
      svg("line", { x1: left, x2: width - right, y1: y(m), y2: y(m), class: m === 0 ? "baseline" : "grid" }),
      svg("text", { x: left - 8, y: y(m) + 4, class: "tick", "text-anchor": "end" }, String(Number(m.toPrecision(3)))),
    );
  chart.append(
    svg("text", { x: 14, y: upper + plotHeight / 2, class: "tick", transform: `rotate(-90 14 ${upper + plotHeight / 2})`, "text-anchor": "middle" }, unit),
  );
  const groups = bars.map((bar, i) => {
    const x = left + i * band;
    const group = svg(
      "g",
      { class: "bar", tabindex: 0 },
      svg("title", {}, `${bar.label}: ${bar.text}`),
      svg("rect", { x, y: upper, width: band, height: plotHeight, class: "hit" }),
      bar.value === undefined
        ? svg("rect", { x: x + band * 0.2, y: y(0) - 3, width: band * 0.6, height: 3, class: "failed" })
        : svg("rect", { x: x + band * 0.2, y: y(bar.value), width: band * 0.6, height: y(0) - y(bar.value), rx: 3, class: bar.dirty ? "value dirty" : "value" }),
      // Its value above it (the Values switch): upwards where the bars are too narrow for it.
      ...(bar.value === undefined
        ? []
        : [
            bar.text.length * 6.5 > band
              ? svg("text", { x: x + band / 2 + 4, y: y(bar.value) - 4, class: "number", transform: `rotate(-90 ${x + band / 2 + 4} ${y(bar.value) - 4})` }, bar.text)
              : svg("text", { x: x + band / 2, y: y(bar.value) - 4, class: "number", "text-anchor": "middle" }, bar.text),
          ]),
      svg("text", { x: x + band / 2, y: height - lower + 14, class: "tick", "text-anchor": "end", transform: `rotate(-40 ${x + band / 2} ${height - lower + 14})` }, bar.axis),
    );
    group.addEventListener("click", () => {
      for (const other of groups) other.classList.remove("selected");
      group.classList.add("selected");
      below.replaceChildren(...bar.detail());
    });
    return group;
  });
  chart.append(...groups);
  groups.at(-1)?.dispatchEvent(new Event("click"));
  const key = (tone: string, text: string) =>
    element("span", { class: "key" }, element("span", { class: `swatch ${tone}` }), text);
  const legend = element("p", { class: "legend muted" }, key("clean", "committed (CI)"), key("dirty", "local changes (dirty)"), valuesSwitch());
  return element("div", { class: "history" }, chart, legend, below);
}

// The DC run of an area evaluation: `total` names what it measured (the
// Ball inside its BallDomain, or the whole thread or hart).
export function areaRun(a: DcArea, total: [string, number]): HTMLElement[] {
  const violations = Object.entries(a.violations);
  const rows: [string, string][] = [
    [total[0], um2(total[1])],
    ["Constraints", a.constraints_met ? "met" : "violated"],
    ["Worst setup slack", `${a.timing.slack_ns.toFixed(2)} ns`],
    ["Worst path", `${a.timing.startpoint} → ${a.timing.endpoint}`],
    ["Violations", violations.length ? violations.map(([kind, n]) => `${kind} ${n}`).join(", ") : "none"],
    ["Tool", a.tool],
    ["Library", a.library],
  ];
  return [
    keyValues(rows),
    element("h3", {}, "Area by module"),
    chart(
      a.hierarchy.map((m) => ({
        label: m.instance,
        value: m.um2,
        text: mm2(m.um2),
        detail: () => [
          keyValues([
            ["Module", m.module],
            ["Area", um2(m.um2)],
            ["Own combinational", um2(m.combinational_um2)],
            ["Own sequential", um2(m.noncombinational_um2)],
          ]),
        ],
      })),
    ),
  ];
}

// The PrimeTime run of a power evaluation; `activity` says what switched.
export function powerRun(p: PowerPassed, activity: string): HTMLElement[] {
  return [
    keyValues([
      ["Total", watts(p.total_w)],
      ["Internal", watts(p.internal_w)],
      ["Switching", watts(p.switching_w)],
      ["Leakage", watts(p.leakage_w)],
      ["Activity", activity],
      ["Registers from activity", p.annotated ? `${p.annotated.registers} %` : "—"],
      ["Nets from activity", p.annotated ? `${p.annotated.nets} %` : "—"],
    ]),
    element("h3", {}, "Power by module"),
    chart(
      p.hierarchy.map((m) => ({
        label: m.instance,
        value: m.total_w,
        text: watts(m.total_w),
        detail: () => [
          keyValues([
            ["Module", m.module],
            ["Total", watts(m.total_w)],
            ["Internal", watts(m.internal_w)],
            ["Switching", watts(m.switching_w)],
            ["Leakage", watts(m.leakage_w)],
          ]),
        ],
      })),
    ),
  ];
}

export const failure = (r: { status: string; error: string }) =>
  element("p", { class: "fail" }, `${r.status}: ${r.error}`);

// The backends a thread's or a hart's regressions run on, as the pages name them.
export const backendName: Record<string, string> = { bemu: "BEMU", verilator: "Verilator" };

// Passed over listed tests across the backends whose batch ran.
export function tally(c: Tests): [number, number] {
  if (!("backends" in c)) return [0, 0];
  const suites = Object.values(c.backends).flatMap((b) => ("tests" in b ? [b] : []));
  return [suites.reduce((n, s) => n + s.passed, 0), suites.reduce((n, s) => n + s.total, 0)];
}

export interface UnitScales {
  area: (um2: number) => number;
  power: (w: number) => number;
}

export function unitScales(found: Unit[]): UnitScales {
  return {
    area: logScale(found.flatMap((u) => (u.area?.status === "pass" ? [u.area.um2] : []))),
    power: logScale(found.flatMap((u) => (u.power?.status === "pass" ? [u.power.total_w] : []))),
  };
}

// A thread's or a hart's results as bars, each linking to its page:
// Tests is the passed share of its tests on BEMU and Verilator,
// Area and Power as a Ball's.
export function unitFigures(unit: Unit, scale: UnitScales, page: string): HTMLElement {
  const row = (name: string, width: number, tone: string, value: string) =>
    element(
      "a",
      { class: `figure ${tone}`, href: `${page}#${name.toLowerCase()}` },
      element("span", { class: "name" }, name),
      element("span", { class: "track" }, element("span", { style: `width: ${width}%` })),
      element("span", { class: "value" }, value),
    );
  const none = (name: string) => row(name, 0, "", "—");
  const { test, area, power } = unit;
  const [passed, total] = test ? tally(test) : [0, 0];
  return element(
    "div",
    { class: "figures" },
    test
      ? row("Tests", total ? (100 * passed) / total : 100, test.status === "pass" ? "met" : "failed", total ? `${passed}/${total}` : "failed")
      : none("Tests"),
    area?.status === "pass"
      ? row("Area", scale.area(area.um2), state(area), mm2(area.um2))
      : area
        ? row("Area", 100, "failed", "failed")
        : none("Area"),
    power?.status === "pass"
      ? row("Power", scale.power(power.total_w), "neutral", (estimated(power) ? "≈ " : "") + watts(power.total_w))
      : power
        ? row("Power", 100, "failed", "failed")
        : none("Power"),
  );
}
