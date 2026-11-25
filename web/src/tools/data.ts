// The tool snapshots of save/: `bbdev bench-tool` measures one tool on one
// design and writes tools/<tool>/<design>/<snapshot>/tools.json.
import { index } from "../snapshot";

// A workload the tool ran to its end.
export interface Workload {
  workload: string;
  elapsed_s: number;
  cycles: number;
}

// A tool on a design, on the tool's own workloads (BEMU: Linux boot and whole
// models, run again for every trace; Verilator: the first ten workloads of
// its bare list; FPGA: the bare-metal whole models): the simulated cycles and wall time of those that passed,
// summed, and each of them.
export interface ToolSnapshot {
  commit: string;
  dirty: boolean;
  taken: string;
  design: string;
  // The tool's name as the pages show it: BEMU, Verilator, FPGA.
  tool: string;
  // The flag it ran with: every trace on, or DiffTest; none is its fastest.
  flag?: "all-trace" | "diff";
  cycles: number;
  elapsed_s: number;
  workloads: Workload[];
}

// The latest measurement of each tool, with each flag, on each design:
// tools/<tool>[-<flag>]/<design>/<snapshot>.
export async function latest(): Promise<ToolSnapshot[]> {
  const { snapshots } = await index();
  const found = new Map<string, string>();
  for (const entry of snapshots.filter((e) => e.files.includes("tools.json")))
    found.set(entry.id.split("/").slice(1, 3).join("/"), entry.id);
  return Promise.all(
    [...found.values()].map(async (id) => {
      const response = await fetch(`./${id}/tools.json`);
      if (!response.ok) throw new Error(`${id}/tools.json: ${response.status}`);
      return (await response.json()) as ToolSnapshot;
    }),
  );
}
