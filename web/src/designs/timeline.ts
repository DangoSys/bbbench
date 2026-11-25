// The evaluation timeline as a graph: a column per step of depth; in a
// column, each node on the mean row of the nodes it needs, or the next free
// row below; elbows for the needs. Pressing a node shows what it found.
import { element } from "../dom";
import { duration, type Node } from "./data";

const height = 96;
const gapX = 28;
const gapY = 20;

function layout(nodes: Node[]): Map<string, { col: number; row: number }> {
  const col = new Map<string, number>();
  for (const node of nodes)
    col.set(node.id, node.needs.length ? Math.max(...node.needs.map((id) => col.get(id)!)) + 1 : 0);
  const place = new Map<string, { col: number; row: number }>();
  const columns = Math.max(...col.values()) + 1;
  for (let c = 0; c < columns; c++) {
    const wanted = nodes
      .filter((node) => col.get(node.id) === c)
      .map((node, order) => ({
        node,
        order,
        row: node.needs.length
          ? node.needs.reduce((sum, id) => sum + place.get(id)!.row, 0) / node.needs.length
          : 0,
      }))
      .sort((a, b) => a.row - b.row || a.order - b.order);
    let next = 0;
    for (const { node, row } of wanted) {
      next = Math.max(next, Math.round(row));
      place.set(node.id, { col: c, row: next++ });
    }
  }
  return place;
}

// An elbow from the right of a node to the left of one it leads to, rounded
// at its corners. Its vertical runs in the gap before the target; from a
// node more than a column back, in the gap after the source, then along the
// target's row.
function elbow(x1: number, y1: number, x2: number, y2: number, adjacent: boolean): string {
  const xm = adjacent ? x2 - gapX / 2 : x1 + gapX / 2;
  if (y1 === y2) return `M${x1},${y1} H${x2}`;
  const r = Math.min(8, Math.abs(y2 - y1) / 2, gapX / 2);
  const dy = y2 > y1 ? r : -r;
  return (
    `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + dy}` +
    ` V${y2 - dy} Q${xm},${y2} ${xm + r},${y2} H${x2}`
  );
}

// The lines under a node's name: its progress, when it counts something, and its time.
function summary(node: Node): string[] {
  if (node.status === "pending") return ["not started"];
  if (node.status === "running") return ["running…"];
  if (node.status === "skipped") return ["not applicable"];
  const suites = Object.values(node.suites ?? {});
  const models = node.models ?? node.estimates ?? node.datasets ?? [];
  const time = duration(node.elapsed_s!);
  if (suites.length)
    return [`${suites.reduce((s, x) => s + x.passed, 0)} / ${suites.reduce((s, x) => s + x.total, 0)}`, time];
  if (models.length) return [`${models.filter((m) => m.status === "pass").length} / ${models.length} models`, time];
  return [time];
}

// The bench-device step that runs each node (bbdev/api/steps/bench).
export const steps: Record<string, string> = {
  workload: "workload",
  "bemu-workload": "bemu-workload",
  "model-build": "model-build",
  "bench-build": "bench-build",
  "verilator-workload": "verilator-workload",
  "bemu-model": "bemu-model",
  "bemu-bench": "bemu-bench",
  "bemu-accuracy": "bemu-accuracy",
  uvm: "uvm",
  "fpga-bitstream": "buildbitstream",
};

// The nodes share the available width; below 104 px each the timeline scrolls.
// With `rerun` (the local bbdev server is there), a node bench-device runs
// has a rerun button at its top right.
export function timeline(
  nodes: Node[],
  available: number,
  show: (node: Node) => void,
  rerun?: (node: Node) => Promise<void>,
): HTMLElement {
  const place = layout(nodes);
  const cols = Math.max(...[...place.values()].map((p) => p.col)) + 1;
  const width = Math.max(104, Math.floor((available - (cols - 1) * gapX) / cols));
  const rows = Math.max(...[...place.values()].map((p) => p.row)) + 1;
  const w = cols * width + (cols - 1) * gapX;
  const h = rows * height + (rows - 1) * gapY;
  const x = (id: string) => place.get(id)!.col * (width + gapX);
  const y = (id: string) => place.get(id)!.row * (height + gapY);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  for (const node of nodes)
    for (const need of node.needs) {
      const x1 = x(need) + width;
      const y1 = y(need) + height / 2;
      const x2 = x(node.id);
      const y2 = y(node.id) + height / 2;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        elbow(x1, y1, x2, y2, place.get(node.id)!.col - place.get(need)!.col === 1),
      );
      path.setAttribute("class", nodes.find((n) => n.id === need)!.status === "pass" ? "edge done" : "edge");
      svg.append(path);
    }

  const buttons = nodes.map((node) => {
    const button = element(
      "button",
      {
        class: `step ${node.status}`,
        title: `${node.name}: ${summary(node).join(" · ")}`,
        style: `left: ${x(node.id)}px; top: ${y(node.id)}px; width: ${width}px; height: ${height}px`,
      },
      element("span", { class: "name" }, node.name),
      ...summary(node).map((line) => element("span", { class: "info" }, line)),
    );
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      show(node);
    });
    return button;
  });

  const reruns = rerun
    ? nodes
        .filter((node) => node.id in steps)
        .map((node) => {
          const button = element(
            "button",
            {
              type: "button",
              class: "rerun step-rerun",
              title: `Rerun ${node.name}`,
              style: `left: ${x(node.id) + width - 30}px; top: ${y(node.id) + 4}px`,
            },
            "↻",
          );
          button.addEventListener("click", async () => {
            button.setAttribute("disabled", "");
            try {
              await rerun(node);
            } catch (error) {
              // The request was refused: say so on the button, the reason on hover.
              button.removeAttribute("disabled");
              button.textContent = "!";
              button.classList.add("refused");
              button.title = `Rerun refused: ${String(error)}`;
            }
          });
          return button;
        })
    : [];

  return element(
    "div",
    { class: "timeline" },
    element("div", { class: "canvas", style: `width: ${w}px; height: ${h}px` }, svg, ...buttons, ...reruns),
  );
}
