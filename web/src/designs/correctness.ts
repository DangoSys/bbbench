// The Correctness page of a design: how many workloads pass at each level of
// the timeline that ran them.
import { element } from "../dom";
import type { DesignSnapshot } from "./data";

export function correctness(snapshot: DesignSnapshot): HTMLElement[] {
  const rows = snapshot.nodes.flatMap((node) =>
    node.suites
      ? Object.entries(node.suites).map(([name, s]) =>
          element(
            "tr",
            {},
            element("td", {}, node.name),
            element("td", {}, name),
            element("td", { class: s.passed === s.total ? "number" : "number fail" }, `${s.passed} / ${s.total}`),
          ),
        )
      : [],
  );
  if (!rows.length) return [element("p", { class: "muted" }, "No batch has run yet.")];
  return [
    element("p", { class: "muted" }, "Workloads passed at each level. Press a batch on the Overview timeline for each workload."),
    element(
      "table",
      {},
      element("thead", {}, element("tr", {}, element("th", {}, "Level"), element("th", {}, "Suite"), element("th", { class: "number" }, "Passed"))),
      element("tbody", {}, ...rows),
    ),
  ];
}
