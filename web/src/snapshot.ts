// The snapshots of save/, as `bbdev bench-prefab`, `bench-device` and `bench-tool` write them.

export interface SnapshotEntry {
  id: string;
  commit: string;
  dirty: boolean;
  taken: string;
  files: string[];
}

export interface Index {
  snapshots: SnapshotEntry[];
}

export interface Port {
  inBW: number;
  outBW: number;
  mmioReadBW: number;
  mmioWriteBW: number;
}

// The Ball as its default config builds it alone.
export interface Config {
  name: string;
  instructions: string[];
  port: Port;
  param: Record<string, unknown>;
  host: Record<string, unknown>;
}

export interface Module {
  instance: string;
  module: string;
  um2: number;
  combinational_um2: number;
  noncombinational_um2: number;
}

export interface Timing {
  slack_ns: number;
  startpoint: string;
  endpoint: string;
}

// An evaluation whose flow failed or was cancelled, with the flow's error.
export interface Failed {
  status: "failure" | "cancelled";
  error: string;
}

// What DC reports of one area run.
export interface DcArea {
  status: "pass";
  constraints_met: boolean;
  tool: string;
  library: string;
  hierarchy: Module[];
  timing: Timing;
  violations: Record<string, number>;
}

// A Ball's area: its own instance inside its BallDomain.
export type Area = (DcArea & { ball_um2: number }) | Failed;

// Coverage scores as urg prints them: "60.00", or "--" when not measured.
export type Scores = Record<string, string>;

export type Uvm =
  | {
      status: "pass";
      coverage: Scores;
      modules: { module: string; coverage: Scores }[];
      groups: { group: string; score: string }[];
    }
  | { status: "failure" | "cancelled"; error: string };

// Cycles of the throughput and latency tests, each instruction against the
// Ball's BEMU cycle model (a mismatch fails the run).
export type Performance =
  | { status: "pass"; throughput: Cycles[]; latency: Cycles[] }
  | { status: "failure" | "cancelled"; error: string };

// One measured instruction: BBPERF <instruction> <iter> <cycles>.
export interface Cycles {
  instruction: string;
  iter: number;
  cycles: number;
}

export interface PowerModule {
  instance: string;
  module: string;
  internal_w: number;
  switching_w: number;
  leakage_w: number;
  total_w: number;
}

// PrimeTime PX on the area run's netlist: a Ball with its UVM test's
// activity, a thread or a hart with its declared workload's.
export interface PowerPassed {
  status: "pass";
  internal_w: number;
  switching_w: number;
  leakage_w: number;
  total_w: number;
  // The percent of registers and of all nets whose toggles came from the
  // simulation; the rest PrimeTime propagated or defaulted. Older runs lack it.
  annotated?: { registers: number; nets: number };
  hierarchy: PowerModule[];
}

export type Power = PowerPassed | Failed;

// A power figure whose registers mostly lack simulated toggles is an estimate.
export const estimated = (p: PowerPassed) => p.annotated !== undefined && p.annotated.registers < 90;

export interface BallResult {
  ball: string;
  path: string;
  config: Config;
  area?: Area;
  power?: Power;
  uvm?: Uvm;
  performance?: Performance;
}

export interface BallSnapshot {
  commit: string;
  dirty: boolean;
  taken: string;
  balls: BallResult[];
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

export const index = () => json<Index>("./index.json");
export const balls = (id: string) => json<BallSnapshot>(`./${id}/ball.json`);

// A Ball across the snapshots. A run of one Ball, or of one evaluation, makes
// a snapshot of just that, so each evaluation reads from its own latest one.
export interface Ball {
  path: string;
  config: Config;
  area?: Area;
  power?: Power;
  uvm?: Uvm;
  performance?: Performance;
  history: { entry: SnapshotEntry; result: BallResult }[];
}

export async function prefab(): Promise<Map<string, Ball>> {
  const { snapshots } = await index();
  const all = await Promise.all(
    snapshots
      .filter((entry) => entry.files.includes("ball.json"))
      .map(async (entry) => ({ entry, snapshot: await balls(entry.id) })),
  );
  const found = new Map<string, Ball>();
  for (const { entry, snapshot } of all)
    for (const result of snapshot.balls) {
      const ball = found.get(result.path) ?? { path: result.path, config: result.config, history: [] };
      ball.config = result.config;
      if (result.area) ball.area = result.area;
      if (result.power) ball.power = result.power;
      if (result.uvm) ball.uvm = result.uvm;
      if (result.performance) ball.performance = result.performance;
      ball.history.push({ entry, result });
      found.set(result.path, ball);
    }
  return found;
}

// A thread or a hart alone, from its default config.
export type Kind = "thread" | "hart";

// A thread's or a hart's area: the whole top DC synthesized.
export type UnitArea = (DcArea & { um2: number }) | Failed;

// One backend's bare-tests: each listed test with its status ("pass",
// "fail", "timeout", or "not run" when the batch never reached it).
export interface Suite {
  status: "pass" | "failure";
  log: string;
  passed: number;
  total: number;
  tests: { test: string; status: string }[];
}

export type Tests = { status: "pass" | "failure"; backends: Record<string, Suite | Failed> } | Failed;

export interface UnitResult {
  path: string;
  test?: Tests;
  area?: UnitArea;
  power?: Power;
}

export interface Unit {
  path: string;
  test?: Tests;
  area?: UnitArea;
  power?: Power;
  history: { entry: SnapshotEntry; result: UnitResult }[];
}

// The threads or harts across the snapshots, each evaluation from its own
// latest snapshot, as for Balls.
export async function units(kind: Kind): Promise<Map<string, Unit>> {
  const file = `${kind}.json`;
  const { snapshots } = await index();
  const all = await Promise.all(
    snapshots
      .filter((entry) => entry.files.includes(file))
      .map(async (entry) => ({ entry, results: (await json<Record<string, UnitResult[]>>(`./${entry.id}/${file}`))[`${kind}s`] })),
  );
  const found = new Map<string, Unit>();
  for (const { entry, results } of all)
    for (const result of results) {
      const unit = found.get(result.path) ?? { path: result.path, history: [] };
      if (result.test) unit.test = result.test;
      if (result.area) unit.area = result.area;
      if (result.power) unit.power = result.power;
      unit.history.push({ entry, result });
      found.set(result.path, unit);
    }
  return found;
}
