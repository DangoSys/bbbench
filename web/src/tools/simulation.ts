// The Latency simulation page. First how fast each simulator runs: a chart per
// simulator (BEMU, Verilator, FPGA), each design a group of bars, one per way
// of running it (fastest, every trace, DiffTest), each its frequency: the
// simulated cycles of its workloads over their wall time, as the tool bench
// sums them. Then the performance evaluation of the models, from the design
// timelines: what each simulator reports as a model's cycles, and how long it
// takes to report it.
import { element } from "../dom";
import type { Design, Node } from "../designs/data";
import { chart, legend, type Group, type Series } from "./chart";
import type { ToolSnapshot } from "./data";

export interface Simulator {
  // The tool of its bench-tool snapshots.
  name: string;
  // Its series color among the simulators: s1, s2, s3 in timeline order.
  tone: string;
  // What evaluates a model's performance on it: the name and its timeline node.
  model: { name: string; node: string };
}

// The ways a simulator is run, by the flag of its snapshots.
const runs: (Series & { flag: ToolSnapshot["flag"] })[] = [
  { flag: undefined, name: "Fastest", tone: "s4" },
  { flag: "all-trace", name: "Every trace", tone: "s5" },
  { flag: "diff", name: "DiffTest", tone: "s6" },
];

function scaled(v: number, units: [number, string][]): string {
  const [scale, unit] = units.find(([s]) => v >= s) ?? units[units.length - 1];
  return `${+(v / scale).toPrecision(3)} ${unit}`;
}

const hertz = (v: number) => scaled(v, [[1e6, "MHz"], [1e3, "kHz"], [1, "Hz"]]);
const cycles = (v: number) => scaled(v, [[1e9, "G"], [1e6, "M"], [1e3, "K"], [1, ""]]).trim();
const time = (v: number) => scaled(v, [[3600, "h"], [60, "min"], [1, "s"]]);

// The models a timeline node ran to a result: bare metal where it runs both.
function results(node: Node | undefined): { model: string; cycles?: number; elapsed_s?: number }[] {
  return [...(node?.models ?? []).filter((m) => m.os !== "linux"), ...(node?.estimates ?? [])].filter(
    (m) => m.status === "pass",
  );
}

export function simulation(simulators: Simulator[], snapshots: ToolSnapshot[], designs: Map<string, Design>): HTMLElement[] {
  const measured = [...new Set(snapshots.map((s) => s.design))].sort();
  const frequency = (sim: Simulator) =>
    measured.map((design) => ({
      label: design,
      values: runs.map(({ flag }) => {
        const run = snapshots.find((s) => s.design === design && s.tool === sim.name && s.flag === flag);
        return run && run.cycles / run.elapsed_s;
      }),
    }));
  const sources: Series[] = simulators.map((sim) => ({ name: sim.model.name, tone: sim.tone }));
  // Every model any simulator has a result of, design by design.
  const models = (measure: "cycles" | "elapsed_s"): Group[] =>
    [...designs.keys()].sort().flatMap((design) => {
      const found = simulators.map((sim) => results(designs.get(design)!.latest.nodes.find((n) => n.id === sim.model.node)));
      return [...new Set(found.flatMap((rows) => rows.map((m) => m.model)))].map((model) => ({
        label: model,
        section: design,
        values: found.map((rows) => rows.find((m) => m.model === model)?.[measure]),
      }));
    });
  return [
    element("h2", {}, "Simulation speed"),
    legend(runs),
    ...simulators.map((sim) => chart(`${sim.name} · frequency`, runs, frequency(sim), hertz)),
    element("h2", {}, "Performance evaluation"),
    legend(sources),
    chart("Accuracy · the cycles of a model", sources, models("cycles"), cycles),
    chart("Speed · the time to get them", sources, models("elapsed_s"), time),
  ];
}
