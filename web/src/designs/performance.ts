// The Performance page of a design: the cycles of each target model at every
// level that measures it, a chart per OS (bare metal, Linux). In a chart, a
// group per model, a bar per level: BEMU, Verilator GVN, FPGA GVN, FPGA end
// to end; on each bar a dot, the simulation time it took, read on the right
// axis. A table repeats the numbers.
import { element, valuesSwitch } from "../dom";
import { duration, type DesignSnapshot, type Node } from "./data";

const svgNs = "http://www.w3.org/2000/svg";

// The levels, in the order of their bars; a GVN level estimates the NPU
// cycles, the same under either OS.
const levels = [
  { node: "bemu-model", name: "BEMU" },
  { node: "verilator-gvn", name: "Verilator GVN" },
  { node: "fpga-gvn", name: "FPGA GVN" },
  { node: "fpga-model", name: "FPGA end to end" },
] as const;

type Measure = { cycles: number; seconds?: number };

// The measure of a model at a level under an OS, if it ran and passed.
function measure(node: Node | undefined, model: string, os: string): Measure | undefined {
  const run =
    node?.models?.find((m) => m.model === model && m.os === os) ??
    node?.estimates?.find((e) => e.model === model);
  if (!run || run.status !== "pass" || run.cycles === undefined) return undefined;
  return { cycles: run.cycles, seconds: run.elapsed_s };
}

function svg(tag: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function title(node: SVGElement, text: string): SVGElement {
  const t = document.createElementNS(svgNs, "title");
  t.textContent = text;
  node.append(t);
  return node;
}

// Powers of ten from below the smallest value to above the largest.
function decades(values: number[]): [number, number] {
  return [Math.floor(Math.log10(Math.min(...values))), Math.ceil(Math.log10(Math.max(...values)))];
}

// A count in three digits: 118M.
function compact(value: number): string {
  const units = ["", "K", "M", "G", "T"];
  const step = Math.min(4, Math.floor(Math.log10(value) / 3));
  return `${+(value / 10 ** (3 * step)).toPrecision(3)}${units[step]}`;
}

function cycleLabel(power: number): string {
  const units = ["", "K", "M", "G", "T"];
  return `${10 ** (power % 3)}${units[Math.floor(power / 3)]}`;
}

function chart(os: string, label: string, models: string[], nodes: Node[], width: number): HTMLElement {
  const data = models.map((model) =>
    levels.map((level) => measure(nodes.find((n) => n.id === level.node), model, os)),
  );
  const cycles = data.flat().filter((m): m is Measure => m !== undefined).map((m) => m.cycles);
  const seconds = data
    .flat()
    .filter((m): m is Measure => m?.seconds !== undefined)
    .map((m) => m.seconds!);
  if (!cycles.length) return element("section", {}, element("h3", {}, label), element("p", { class: "muted" }, "No model has run yet."));
  const left = 56, right = 56, barsHeight = 280, labels = 34;
  const plot = width - left - right;
  const height = barsHeight + labels;
  const [low, high] = decades(cycles);
  const y = (v: number) => barsHeight - ((Math.log10(v) - low) / (high - low)) * barsHeight;
  const [sLow, sHigh] = seconds.length ? decades(seconds) : [0, 1];
  const yTime = (v: number) =>
    barsHeight - ((Math.log10(v) - sLow) / Math.max(1, sHigh - sLow)) * barsHeight;
  const group = plot / models.length;
  const bar = Math.max(4, Math.min(22, (group * 0.72) / levels.length - 2));
  const x = (m: number, l: number) => left + m * group + (group - levels.length * (bar + 2)) / 2 + l * (bar + 2);

  const root = svg("svg", { width, height, class: "perf-chart", role: "img", "aria-label": `${label}: cycles of each model per level, log scale` }) as SVGSVGElement;
  // Recessive grid and axis labels: a line per decade.
  for (let p = low; p <= high; p++) {
    root.append(svg("line", { x1: left, x2: width - right, y1: y(10 ** p), y2: y(10 ** p), class: "grid" }));
    const t = svg("text", { x: left - 6, y: y(10 ** p) + 4, class: "axis", "text-anchor": "end" });
    t.textContent = cycleLabel(p);
    root.append(t);
  }
  // The simulation time on the right axis, its ticks only (the grid is the
  // cycles').
  for (let p = sLow; seconds.length && p <= sHigh; p++) {
    const t = svg("text", { x: width - right + 6, y: yTime(10 ** p) + 4, class: "axis time" });
    t.textContent = duration(10 ** p);
    root.append(t);
  }
  const captions = [
    ["Cycles", 12],
    ["Simulation time", width - 10],
  ] as const;
  for (const [text, at] of captions) {
    const t = svg("text", { x: at, y: barsHeight / 2, class: "axis", transform: `rotate(-90 ${at} ${barsHeight / 2})`, "text-anchor": "middle" });
    t.textContent = text;
    root.append(t);
  }
  data.forEach((row, m) => {
    row.forEach((value, l) => {
      if (!value) return;
      const top = y(value.cycles), x0 = x(m, l), r = Math.min(4, bar / 2);
      // A bar anchored to the baseline, its data end rounded.
      const d = `M${x0},${barsHeight} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bar - r} Q${x0 + bar},${top} ${x0 + bar},${top + r} V${barsHeight} Z`;
      root.append(title(svg("path", { d, class: `series-${l + 1}` }), `${value.cycles.toLocaleString("en-US")} cycles`));
      // Its cycles above it, read upwards (the Values switch).
      const number = svg("text", { x: x0 + bar / 2 + 4, y: top - 4, class: "number", transform: `rotate(-90 ${x0 + bar / 2 + 4} ${top - 4})` });
      number.textContent = compact(value.cycles);
      root.append(number);
      if (value.seconds !== undefined)
        root.append(title(svg("circle", { cx: x0 + bar / 2, cy: yTime(value.seconds), r: 6, class: "dot" }), duration(value.seconds)));
    });
    const t = svg("text", { x: left + m * group + group / 2, y: height - labels + 16, class: "axis model", "text-anchor": "middle" });
    t.textContent = models[m];
    root.append(t);
  });

  const legend = element(
    "div",
    { class: "perf-legend" },
    ...levels.map((level, l) => element("span", {}, element("i", { class: `swatch series-${l + 1}` }), level.name)),
    element("span", {}, element("i", { class: "swatch dot" }), "Simulation time (right axis)"),
    valuesSwitch(),
  );
  const table = element(
    "table",
    {},
    element(
      "thead",
      {},
      element("tr", {}, element("th", {}, "Model"), ...levels.map((level) => element("th", { class: "number" }, level.name))),
    ),
    element(
      "tbody",
      {},
      ...data.map((row, m) =>
        element(
          "tr",
          {},
          element("td", {}, models[m]),
          ...row.map((value) =>
            element(
              "td",
              { class: "number" },
              value
                ? `${value.cycles.toLocaleString("en-US")}${value.seconds === undefined ? "" : ` · ${duration(value.seconds)}`}`
                : "—",
            ),
          ),
        ),
      ),
    ),
  );
  return element("section", { class: "perf" }, element("h3", {}, label), legend, root as unknown as HTMLElement, table);
}

// A design without target models is measured by its benchmark workloads
// (e.g. embench on multi-rocket): their simulated cycles at each batch level.
function benchmarks(snapshot: DesignSnapshot): HTMLElement[] {
  const rows = snapshot.nodes.flatMap((n) =>
    Object.values(n.suites ?? {}).flatMap((s) =>
      s.workloads
        .filter((w) => w.workload.includes("-benchmark-") && w.cycles !== undefined)
        .map((w) =>
          element(
            "tr",
            {},
            element("td", {}, n.name),
            element("td", {}, w.workload),
            element("td", { class: w.status === "pass" ? "" : "fail" }, w.status),
            element("td", { class: "number" }, w.cycles!.toLocaleString("en-US")),
          ),
        ),
    ),
  );
  if (!rows.length) return [element("p", { class: "muted" }, "No benchmark workload has run yet.")];
  return [
    element(
      "table",
      {},
      element("thead", {}, element("tr", {}, element("th", {}, "Level"), element("th", {}, "Benchmark"), element("th", {}, "Status"), element("th", { class: "number" }, "Cycles"))),
      element("tbody", {}, ...rows),
    ),
  ];
}

export function performance(snapshot: DesignSnapshot, available: number): HTMLElement[] {
  if (snapshot.nodes.some((n) => n.id === "bemu-model" && n.status === "skipped")) return benchmarks(snapshot);
  const models = [
    ...new Set(
      snapshot.nodes.flatMap((n) => [...(n.models ?? []).map((m) => m.model), ...(n.estimates ?? []).map((e) => e.model)]),
    ),
  ].sort();
  if (!models.length) return [element("p", { class: "muted" }, "No model has run yet.")];
  return [
    chart("baremetal", "Bare metal", models, snapshot.nodes, available),
    chart("linux", "Linux", models, snapshot.nodes, available),
  ];
}
