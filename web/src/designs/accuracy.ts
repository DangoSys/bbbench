// The Accuracy page of a design: each target model on its whole dataset, a
// chart per measure. Task accuracy: the samples each level classifies as
// labelled; pass rate: the samples predicting what the reference predicts. In a chart, a group per model, a bar per
// level: PyTorch (the golden reference), BEMU, FPGA end to end. A table
// repeats the numbers. A model of continuous outputs has no task accuracy:
// a table gives the mean squared error of its outputs against the recorded
// ones instead.
import { element, valuesSwitch } from "../dom";
import type { Dataset, DesignSnapshot, Node } from "./data";

const svgNs = "http://www.w3.org/2000/svg";

// The levels, in the order of their bars: PyTorch from the reference the
// BEMU run checks against (its pass rate is its own, 1).
const levels = [
  { name: "PyTorch", node: "bemu-accuracy", class: "golden", accuracy: (d: Dataset) => d.reference_accuracy, pass: () => 1 },
  { name: "BEMU", node: "bemu-accuracy", class: "series-1", accuracy: (d: Dataset) => d.accuracy, pass: (d: Dataset) => d.pass_rate },
  { name: "FPGA end to end", node: "fpga-model", class: "series-4", accuracy: (d: Dataset) => d.accuracy, pass: (d: Dataset) => d.pass_rate },
] as const;

function svg(tag: string, attributes: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(svgNs, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function chart(label: string, measure: "accuracy" | "pass", models: string[], nodes: Node[], width: number): HTMLElement {
  const data = models.map((model) =>
    levels.map((level) => {
      const run = nodes.find((n) => n.id === level.node)?.datasets?.find((d) => d.model === model);
      return run && run.status === "pass" ? level[measure](run) : undefined;
    }),
  );
  const left = 48, right = 8, height = 240, labels = 34;
  const plot = width - left - right;
  const y = (v: number) => height - v * height;
  const group = plot / models.length;
  const bar = Math.max(4, Math.min(26, (group * 0.6) / levels.length - 2));
  const x = (m: number, l: number) => left + m * group + (group - levels.length * (bar + 2)) / 2 + l * (bar + 2);
  const root = svg("svg", { width, height: height + labels, class: "perf-chart", role: "img", "aria-label": `${label} of each model per level` });
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    root.append(svg("line", { x1: left, x2: width - right, y1: y(v), y2: y(v), class: "grid" }));
    const t = svg("text", { x: left - 6, y: y(v) + 4, class: "axis", "text-anchor": "end" });
    t.textContent = `${v * 100}%`;
    root.append(t);
  }
  data.forEach((row, m) => {
    row.forEach((value, l) => {
      if (value === undefined) return;
      const top = y(value), x0 = x(m, l), r = Math.min(4, bar / 2, Math.max(0, height - top) / 2);
      const d = `M${x0},${height} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bar - r} Q${x0 + bar},${top} ${x0 + bar},${top + r} V${height} Z`;
      const path = svg("path", { d, class: levels[l].class });
      const hint = document.createElementNS(svgNs, "title");
      hint.textContent = `${(100 * value).toFixed(2)}%`;
      path.append(hint);
      root.append(path);
      // Its value above it, read upwards (the Values switch).
      const number = svg("text", { x: x0 + bar / 2 + 4, y: top - 4, class: "number", transform: `rotate(-90 ${x0 + bar / 2 + 4} ${top - 4})` });
      number.textContent = `${(100 * value).toFixed(1)}%`;
      root.append(number);
    });
    const t = svg("text", { x: left + m * group + group / 2, y: height + 16, class: "axis model", "text-anchor": "middle" });
    t.textContent = models[m];
    root.append(t);
  });
  const legend = element(
    "div",
    { class: "perf-legend" },
    ...levels.map((level) => element("span", {}, element("i", { class: `swatch ${level.class}` }), level.name)),
    valuesSwitch(),
  );
  const table = element(
    "table",
    {},
    element("thead", {}, element("tr", {}, element("th", {}, "Model"), ...levels.map((level) => element("th", { class: "number" }, level.name)))),
    element(
      "tbody",
      {},
      ...data.map((row, m) =>
        element(
          "tr",
          {},
          element("td", {}, models[m]),
          ...row.map((value) => element("td", { class: "number" }, value === undefined ? "—" : `${(100 * value).toFixed(2)}%`)),
        ),
      ),
    ),
  );
  return element("section", { class: "perf" }, element("h3", {}, label), legend, root as unknown as HTMLElement, table);
}

export function accuracy(snapshot: DesignSnapshot, available: number): HTMLElement[] {
  const models = [...new Set(snapshot.nodes.flatMap((n) => (n.datasets ?? []).map((d) => d.model)))].sort();
  if (!models.length) return [element("p", { class: "muted" }, "No model has run on its dataset yet.")];
  const samples = snapshot.nodes
    .flatMap((n) => n.datasets ?? [])
    .map((d) => `${d.model}: ${d.samples.toLocaleString("en-US")}`)
    .join(" · ");
  const runs = snapshot.nodes.find((n) => n.id === "bemu-accuracy")?.datasets ?? [];
  const continuous = runs.filter((d) => d.action_mse !== undefined);
  const detectors = runs.filter((d) => d.map50_95 !== undefined);
  const classified = models.filter((model) => ![...continuous, ...detectors].some((d) => d.model === model));
  const errors = element(
    "section",
    { class: "perf" },
    element("h3", {}, "Action error (MSE against the recorded actions)"),
    element(
      "table",
      {},
      element("thead", {}, element("tr", {}, element("th", {}, "Model"), element("th", { class: "number" }, "PyTorch"), element("th", { class: "number" }, "BEMU"))),
      element(
        "tbody",
        {},
        ...continuous.map((d) =>
          element(
            "tr",
            {},
            element("td", {}, d.model),
            element("td", { class: "number" }, d.reference_action_mse!.toFixed(4)),
            element("td", { class: "number" }, d.action_mse!.toFixed(4)),
          ),
        ),
      ),
    ),
  );
  return [
    element("p", { class: "muted" }, `Samples per model — ${samples}`),
    ...(classified.length ? [chart("Task accuracy", "accuracy", classified, snapshot.nodes, available)] : []),
    ...(continuous.length ? [errors] : []),
    ...(detectors.length ? [element("section", { class: "perf" },
      element("h3", {}, "Detection mAP50–95"),
      element("table", {},
        element("thead", {}, element("tr", {}, ...["Model", "Dataset", "PyTorch FP32", "BEMU"].map((title) => element("th", {}, title)))),
        element("tbody", {}, ...detectors.map((d) => element("tr", {},
          element("td", {}, d.model), element("td", {}, d.dataset!),
          element("td", { class: "number" }, `${(100 * d.reference_map50_95!).toFixed(2)}%`),
          element("td", { class: "number" }, `${(100 * d.map50_95!).toFixed(2)}%`),
        ))),
      ),
    )] : []),
    chart("Sample pass rate", "pass", models, snapshot.nodes, available),
  ];
}
