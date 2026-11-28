// The design snapshots of save/, as `bbdev bench-device` writes them.
import { index, type SnapshotEntry } from "../snapshot";

export interface Workload {
  workload: string;
  status: "pass" | "fail" | "timeout" | "crash" | "infra_error";
  elapsed_s: number | null;
  // Simulated cycles, where the simulator leaves them (BEMU: cpu-state.log).
  cycles?: number;
}

// One model run whole on a simulator: its program's exit and inference cycles.
export interface ModelRun {
  // bench-device --bemu-model runs each model bare metal and under Linux.
  os?: "baremetal" | "linux";
  model: string;
  status: "running" | "pass" | "failure" | "timeout";
  cycles?: number;
  elapsed_s?: number;
  // The program's own check against the model's reference output.
  max_diff?: number;
  elements?: number;
  relative?: number;
  log?: string;
  error?: string;
}

// One distinct GVN slice of a Verilator GVN estimate: the times it runs in the
// model and its cycles on Verilator (null when it failed there).
export interface SliceEstimate {
  instance: string;
  repeats: number;
  exit: number;
  cycles: number | null;
  total: number | null;
  share: number | null;
}

// A model's rough end-to-end NPU cycles from its GVN slices on Verilator.
export interface Estimate {
  model: string;
  status: "running" | "pass" | "failure";
  cycles?: number;
  // The simulation time of the slices on Verilator.
  elapsed_s?: number;
  slices?: SliceEstimate[];
  log?: string;
  error?: string;
}

// A model on its whole dataset: the task accuracy (samples classified as
// labelled), the pass rate (samples predicting what the reference predicts)
// and the accuracy of the reference (PyTorch) on the same samples, each a
// fraction.
export interface Dataset {
  model: string;
  status: "pass" | "failure";
  samples: number;
  ran?: number;
  accuracy?: number;
  pass_rate: number;
  reference_accuracy?: number;
  // A model of continuous outputs (actions): the mean squared errors of the
  // device's and the reference's outputs against the recorded ones.
  action_mse?: number;
  reference_action_mse?: number;
  map50_95?: number;
  reference_map50_95?: number;
  dataset?: string;
  elapsed_s?: number;
  log?: string;
  error?: string;
}

// One batch run: its log directory under log/ and the workloads it ran.
export interface Suite {
  log: string;
  passed: number;
  total: number;
  workloads: Workload[];
}

export interface IpVerification {
  ip: string;
  status: "pass" | "failure" | "pending" | "running" | "unavailable";
  error?: string;
  profiles?: {
    profile: string;
    configuration: string;
    tests: {
      test: string;
      status: string;
      coverage: {
        dut: Record<string, number | null>;
        dut_raw: Record<string, number | null>;
        functional: Record<string, number>;
      } | null;
    }[];
  }[];
}

// A node of the evaluation timeline: it starts once every node it needs has
// passed. Pending nodes have not run yet; bench rewrites the snapshot as a
// node starts (running) and ends.
export interface Node {
  id: string;
  name: string;
  needs: string[];
  status: "pending" | "running" | "pass" | "failure" | "skipped";
  elapsed_s?: number;
  error?: string;
  suites?: Record<string, Suite>;
  uvm?: IpVerification[];
  models?: ModelRun[];
  estimates?: Estimate[];
  datasets?: Dataset[];
}

export interface Overview {
  ips: { ip: string; has_suite: boolean }[];
  // balls: the hart's own accelerator, outside any thread.
  harts: { id: number; component: string; threads: number; balls?: string[] }[];
  threads: { cpu: string; balls: string[] }[];
}

export interface DesignSnapshot {
  commit: string;
  dirty: boolean;
  taken: string;
  design: string;
  nodes: Node[];
}

export interface Design {
  latest: DesignSnapshot;
  history: { entry: SnapshotEntry; snapshot: DesignSnapshot }[];
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

// Every evaluated design, by name, in the order of their latest snapshot.
// A bench runs one node of the timeline per snapshot, so `latest` is the
// newest snapshot with each node from the newest snapshot that ran it; a node
// that never ran and does not apply to the design (model build and BEMU model
// without models, bench build and BEMU bench without benchmarks, from the
// map) is skipped.
export async function designs(all: MapDesign[]): Promise<Map<string, Design>> {
  const { snapshots } = await index();
  const loaded = await Promise.all(
    snapshots
      .filter((entry) => entry.files.includes("design.json"))
      .map(async (entry) => ({ entry, snapshot: await json<DesignSnapshot>(`./${entry.id}/design.json`) })),
  );
  const found = new Map<string, Design>();
  for (const { entry, snapshot } of loaded) {
    const design = found.get(snapshot.design) ?? { latest: snapshot, history: [] };
    design.history.push({ entry, snapshot });
    found.set(snapshot.design, design);
  }
  for (const [name, design] of found) {
    const newest = design.history[design.history.length - 1].snapshot;
    const { models, benches, overview } = all.find((d) => d.design === name)!;
    const applies = (id: string) =>
      !(["model-build", "bemu-model", "bemu-accuracy", "verilator-gvn-perf", "verilator-gvn-debug", "fpga-gvn", "fpga-model"].includes(id) && !models.length) &&
      !(["bench-build", "bemu-bench"].includes(id) && !benches.length) &&
      !(id === "uvm" && !overview.ips.length);
    design.latest = {
      ...newest,
      nodes: newest.nodes.map((node) => {
        const ran = design.history
          .map((h) => h.snapshot.nodes.find((n) => n.id === node.id))
          .filter((n): n is Node => n !== undefined && n.status !== "pending")
          .pop();
        if (ran?.id === "bemu-accuracy" && models.length && (ran.status === "pass" || ran.status === "skipped")) {
          const passed = new Set(ran.datasets?.filter((r) => r.status === "pass" && r.samples > 0 && r.ran === r.samples).map((r) => r.model));
          const missing = models.filter((model) => !passed.has(model));
          if (missing.length) return { ...ran, status: "failure", error: `Missing complete accuracy results: ${missing.join(", ")}` };
        }
        if (ran?.id === "verilator-gvn-debug" && ran.status === "pass") {
          const missing = models.filter((model) => {
            const suite = ran.suites?.[model];
            return !suite || !suite.total || suite.passed !== suite.total;
          });
          if (missing.length) return { ...ran, status: "failure", error: `Incomplete RTL debug results: ${missing.join(", ")}` };
        }
        if (ran?.id === "fpga-model" && (ran.status === "pass" || ran.status === "skipped")) {
          const passed = new Set(ran.models?.filter((r) => r.status === "pass" && (r.cycles ?? 0) > 0).map((r) => `${r.model}/${r.os}`));
          const missing = models.flatMap((model) => ["baremetal", "linux"].map((os) => `${model}/${os}`)).filter((entry) => !passed.has(entry));
          if (missing.length) return { ...ran, status: "failure", error: `Missing complete FPGA runs: ${missing.join(", ")}` };
        }
        if ((ran?.id === "verilator-gvn-perf" || ran?.id === "fpga-gvn") && ran.status !== "skipped") {
          const estimates = (ran.estimates ?? []).map((e) =>
            e.status === "pass" && !(e.slices?.length && e.slices.every((s) => s.exit === 0 && (s.cycles ?? 0) > 0))
              ? { ...e, status: "failure" as const }
              : e,
          );
          const passed = new Set(estimates.filter((e) => e.status === "pass").map((e) => e.model));
          const incomplete = !estimates.length || estimates.some((e) => e.status !== "pass") || models.some((m) => !passed.has(m));
          return { ...ran, estimates, status: ran.status === "pass" && incomplete ? "failure" : ran.status };
        }
        if (ran?.id === "uvm" && (ran.status === "skipped" || ran.status === "pass")) {
          const passed = new Set(ran.uvm?.filter((ip) => ip.status === "pass").map((ip) => ip.ip));
          const missing = overview.ips.filter((ip) => !passed.has(ip.ip)).map((ip) => ip.ip);
          if (missing.length) return { ...ran, status: "failure", error: `Missing UVM results: ${missing.join(", ")}` };
        }
        return ran ?? (applies(node.id) ? node : { ...node, status: "skipped" });
      }),
    };
  }
  return found;
}

// Workloads passed over run, across every batch node that ran.
export function correctness(snapshot: DesignSnapshot): { passed: number; total: number } | undefined {
  const suites = snapshot.nodes.flatMap((n) => Object.values(n.suites ?? {}));
  if (!suites.length) return undefined;
  return {
    passed: suites.reduce((sum, s) => sum + s.passed, 0),
    total: suites.reduce((sum, s) => sum + s.total, 0),
  };
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ${Math.round(seconds % 60)} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

// The design map bbmap exports: every design, what it is for, the models
// written for it, its one default config and the composition of that
// config. It does not depend on any evaluation.
export interface MapDesign {
  design: string;
  description: string;
  models: string[];
  benches: string[];
  config: string;
  overview: Overview;
}

export async function map(): Promise<MapDesign[]> {
  return (await json<{ designs: MapDesign[] }>("./bbmap.json")).designs;
}
