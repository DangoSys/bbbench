// The Overview page of a design: its timeline, what a pressed node found, and
// what the design is made of.
import { element } from "../dom";
import {
  duration,
  type DesignSnapshot,
  type Estimate,
  type MapDesign,
  type Node,
  type Suite,
} from "./data";
import { timeline } from "./timeline";

function suite(name: string, s: Suite): HTMLElement {
  return element(
    "section",
    {},
    element("h3", {}, `${name} · ${s.passed} / ${s.total} passed`),
    element(
      "table",
      {},
      element(
        "thead",
        {},
        element(
          "tr",
          {},
          element("th", {}, "Workload"),
          element("th", {}, "Status"),
          element("th", { class: "number" }, "Time"),
        ),
      ),
      element(
        "tbody",
        {},
        ...s.workloads.map((w) =>
          element(
            "tr",
            {},
            element("td", {}, w.workload),
            element(
              "td",
              { class: w.status === "pass" ? "" : "fail" },
              w.status,
            ),
            element("td", { class: "number" }, w.elapsed_s === null ? "—" : duration(w.elapsed_s)),
          ),
        ),
      ),
    ),
  );
}

// A model's estimate and the slices it adds up, the largest first.
function estimate(e: Estimate): HTMLElement {
  const number = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : v.toLocaleString("en-US");
  return element(
    "section",
    {},
    element(
      "h3",
      { class: e.status === "pass" ? "" : "fail" },
      `${e.model} · ${e.status === "pass" && e.cycles !== undefined ? `${number(e.cycles)} NPU cycles` : e.status}`,
    ),
    ...(e.error ? [element("pre", {}, e.error)] : []),
    ...(e.slices
      ? [
          element(
            "table",
            {},
            element(
              "thead",
              {},
              element(
                "tr",
                {},
                element("th", {}, "Slice"),
                element("th", { class: "number" }, "Repeats"),
                element("th", { class: "number" }, "Verilator cycles"),
                element("th", { class: "number" }, "Total"),
                element("th", { class: "number" }, "Share"),
              ),
            ),
            element(
              "tbody",
              {},
              ...e.slices.map((s) =>
                element(
                  "tr",
                  {},
                  element("td", { class: s.exit ? "fail" : "" }, s.instance),
                  element("td", { class: "number" }, number(s.repeats)),
                  element("td", { class: "number" }, number(s.cycles)),
                  element("td", { class: "number" }, number(s.total)),
                  element(
                    "td",
                    { class: "number" },
                    s.share === null ? "—" : `${(100 * s.share).toFixed(1)}%`,
                  ),
                ),
              ),
            ),
          ),
        ]
      : []),
  );
}

function detail(node: Node, nodes: Node[]): HTMLElement[] {
  const head = element("h2", {}, node.name);
  if (node.status === "skipped")
    return [
      head,
      element("p", { class: "muted" }, "Not applicable to this design."),
    ];
  if (node.status === "pending") {
    const needs = node.needs
      .map((id) => nodes.find((n) => n.id === id)!.name)
      .join(", ");
    return [
      head,
      element(
        "p",
        { class: "muted" },
        needs ? `Starts once ${needs} passed.` : "Starts first.",
      ),
    ];
  }
  return [
    head,
    element(
      "p",
      { class: node.status === "failure" ? "fail" : "muted" },
      [
        node.status,
        node.elapsed_s === undefined ? "" : duration(node.elapsed_s),
      ]
        .filter(Boolean)
        .join(" · "),
    ),
    ...(node.error ? [element("pre", {}, node.error)] : []),
    ...(node.id === "uvm" ? [element("a", {
      href: location.hash.split("/")[0] + "/uvm",
    }, "IP coverage")] : []),
    ...Object.entries(node.suites ?? {}).map(([name, s]) => suite(name, s)),
    ...(node.estimates ?? []).map(estimate),
    ...(node.models
      ? [
          element(
            "table",
            {},
            element(
              "thead",
              {},
              element(
                "tr",
                {},
                element("th", {}, "Model"),
                element("th", {}, "Status"),
                element("th", { class: "number" }, "Inference cycles"),
                element("th", {}, "Error"),
              ),
            ),
            element(
              "tbody",
              {},
              ...node.models.map((m) =>
                element(
                  "tr",
                  {},
                  element("td", {}, m.os ? `${m.model} · ${m.os}` : m.model),
                  element(
                    "td",
                    { class: m.status === "pass" ? "" : "fail" },
                    m.status,
                  ),
                  element(
                    "td",
                    { class: "number" },
                    m.cycles === undefined
                      ? "—"
                      : m.cycles.toLocaleString("en-US"),
                  ),
                  element(
                    "td",
                    { class: "muted" },
                    (m.error ?? "").slice(0, 160),
                  ),
                ),
              ),
            ),
          ),
        ]
      : []),
  ];
}

export function overview(
  d: MapDesign,
  snapshot: DesignSnapshot | undefined,
  available: number,
  rerun?: (node: Node) => Promise<void>,
): HTMLElement[] {
  const shown = element("div", { class: "node-detail" });
  const { harts, threads } = d.overview;
  return [
    ...(d.models.length
      ? [
          element("h2", {}, "Target models"),
          element(
            "div",
            { class: "models" },
            ...d.models.map((m) => element("span", {}, m)),
          ),
        ]
      : []),
    element("h2", {}, "Evaluation timeline"),
    ...(snapshot
      ? [
          timeline(
            snapshot.nodes,
            available,
            (node) => shown.replaceChildren(...detail(node, snapshot.nodes)),
            rerun,
          ),
          shown,
        ]
      : [element("p", { class: "muted" }, "Not evaluated yet.")]),
    element("h2", {}, "Config"),
    element(
      "table",
      { class: "kv" },
      element(
        "tbody",
        {},
        element(
          "tr",
          {},
          element("th", {}, "Default"),
          element("td", {}, d.config),
        ),
      ),
    ),
    element("h2", {}, "Composition"),
    element(
      "table",
      { class: "kv" },
      element(
        "tbody",
        {},
        ...harts.map((h) =>
          element(
            "tr",
            {},
            element("th", {}, `Hart ${h.id}`),
            element(
              "td",
              {},
              [
                h.component,
                h.threads ? `${h.threads} threads` : "",
                h.balls?.length ? h.balls.join(", ") : "",
              ]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
        ),
        ...threads.map((t, i) =>
          element(
            "tr",
            {},
            element("th", {}, `Thread ${i}`),
            element("td", {}, `${t.cpu} · ${t.balls.join(", ")}`),
          ),
        ),
      ),
    ),
  ];
}
