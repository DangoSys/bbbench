import type { Simulator } from "./simulation";

// Cycle-exact RTL simulation: workloads and slices.
export const verilator: Simulator = { name: "Verilator", tone: "s2", model: { name: "Verilator + GVN", node: "verilator-gvn-perf" } };
