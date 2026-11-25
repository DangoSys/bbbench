// The analysis of one Ball across the snapshots: ball.html?path=<path>.
import { areaRun, chart, failure, history, keyValues, powerRun, section } from "./analysis";
import { byId, element, figures, label, mm2, owner, scales, watts } from "./dom";
import { prefab, type Ball, type Scores, type SnapshotEntry, type Uvm } from "./snapshot";

// Nested config tables as dotted keys: bank.entries = 1024.
function flatten(value: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(value).flatMap(([key, v]) => {
    if (key === "_file") return [];
    const name = prefix + key;
    return v !== null && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Record<string, unknown>, `${name}.`)
      : [[name, JSON.stringify(v)] as [string, string]];
  });
}

// The runs of one evaluation, oldest first.
function runs<T>(ball: Ball, pick: (r: Ball["history"][number]["result"]) => T | undefined) {
  const found = ball.history.flatMap(({ entry, result }) => {
    const value = pick(result);
    return value === undefined ? [] : [{ entry, value }];
  });
  return found;
}

function areaPart(ball: Ball): HTMLElement[] {
  const found = runs(ball, (r) => r.area);
  if (!found.length) return [element("p", { class: "muted" }, "No area evaluation of this Ball yet.")];
  return [
    section(
      "Ball area by run",
      history(
        found.map(({ entry, value }) => ({
          label: label(entry),
          axis: label(entry).slice(5, 16),
          dirty: entry.dirty,
          value: value.status === "pass" ? value.ball_um2 / 1e6 : undefined,
          text: value.status === "pass" ? mm2(value.ball_um2) : value.status,
          detail: () => (value.status === "pass" ? areaRun(value, ["Ball", value.ball_um2]) : [failure(value)]),
        })),
        "Ball area (mm²)",
      ),
    ),
  ];
}

function powerPart(ball: Ball): HTMLElement[] {
  const found = runs(ball, (r) => r.power);
  if (!found.length) return [element("p", { class: "muted" }, "No power evaluation of this Ball yet.")];
  return [
    section(
      "Ball power by run",
      history(
        found.map(({ entry, value }) => ({
          label: label(entry),
          axis: label(entry).slice(5, 16),
          dirty: entry.dirty,
          value: value.status === "pass" ? value.total_w * 1e3 : undefined,
          text: value.status === "pass" ? watts(value.total_w) : value.status,
          detail: () =>
            value.status === "pass"
              ? powerRun(value, "the Ball's UVM test, averaged over the whole run")
              : [failure(value)],
        })),
        "Ball power (mW)",
      ),
    ),
  ];
}

const metrics = ["LINE", "COND", "TOGGLE", "ASSERT", "GROUP"];

// The kinds urg measured: a score, not "--".
const measured = (scores: Scores) => metrics.filter((m) => m in scores && !Number.isNaN(Number(scores[m])));
const score = (u: Uvm | undefined) => (u?.status === "pass" ? Number(u.coverage.SCORE) : undefined);

function uvmRun(entry: SnapshotEntry, u: Uvm): HTMLElement[] {
  if (u.status !== "pass") return [element("p", { class: "fail" }, `${label(entry)}: ${u.status}: ${u.error}`)];
  const kinds = (scores: Scores) =>
    chart(
      measured(scores).map((m) => ({
        label: m,
        value: Number(scores[m]),
        text: `${scores[m]} %`,
        detail: () => [],
      })),
    );
  return [
    keyValues([
      ["Result", "pass"],
      ["Total score", `${u.coverage.SCORE} %`],
    ]),
    element("h3", {}, "Coverage by kind"),
    kinds(u.coverage),
    element("h3", {}, "Coverage by module"),
    chart(
      u.modules
        .filter((m) => !Number.isNaN(Number(m.coverage.SCORE)))
        .map((m) => ({
          label: m.module,
          value: Number(m.coverage.SCORE),
          text: `${m.coverage.SCORE} %`,
          detail: () => [kinds(m.coverage)],
        })),
    ),
    element("h3", {}, "Covergroups"),
    chart(
      u.groups.map((g) => ({
        label: g.group,
        value: Number(g.score),
        text: `${g.score} %`,
        detail: () => [],
      })),
    ),
  ];
}

function coveragePart(ball: Ball): HTMLElement[] {
  const found = runs(ball, (r) => r.uvm);
  if (!found.length) return [element("p", { class: "muted" }, "No UVM run of this Ball yet.")];
  return [
    section(
      "Coverage score by run",
      history(
        found.map(({ entry, value }) => ({
          label: label(entry),
          axis: label(entry).slice(5, 16),
          dirty: entry.dirty,
          value: score(value),
          text: value.status === "pass" ? `${value.coverage.SCORE} %` : value.status,
          detail: () => uvmRun(entry, value),
        })),
        "Coverage score (%)",
        100,
      ),
    ),
  ];
}

// Throughput and latency of the latest run that measured them: every
// instruction already matched the Ball's BEMU cycle model, or the run failed.
function performancePart(ball: Ball): HTMLElement[] {
  const last = runs(ball, (r) => r.performance).at(-1);
  if (!last) return [element("p", { class: "muted" }, "No performance run of this Ball yet.")];
  const { entry, value } = last;
  if (value.status !== "pass") return [element("p", { class: "fail" }, `${label(entry)}: ${value.status}: ${value.error}`)];
  const table = (head: string[], rows: string[][]) =>
    element(
      "table",
      {},
      element("thead", {}, element("tr", {}, ...head.map((h) => element("th", {}, h)))),
      element("tbody", {}, ...rows.map((r) => element("tr", {}, ...r.map((c) => element("td", {}, c))))),
    );
  return [
    element("p", { class: "muted" }, "Cycles from command handshake to first response, outside world ideal."),
    section(
      "Throughput",
      table(
        ["Instruction", "iter", "Cycles", "Cycles / iter"],
        value.throughput.map((c) => [c.instruction, String(c.iter), String(c.cycles), (c.cycles / c.iter).toFixed(2)]),
      ),
    ),
    section(
      "Latency",
      table(
        ["Instruction", "iter", "Cycles"],
        value.latency.map((c) => [c.instruction, String(c.iter), String(c.cycles)]),
      ),
    ),
  ];
}

function overview(ball: Ball): HTMLElement[] {
  const mapping = ball.config;
  // funct7 is not the Ball's: each design assigns its own, so it is not shown.
  const port = keyValues([
    ["Instructions", mapping.instructions.join(", ")],
    ["Bank reads (inBW)", String(mapping.port.inBW)],
    ["Bank writes (outBW)", String(mapping.port.outBW)],
    ["MMIO reads", String(mapping.port.mmioReadBW)],
    ["MMIO writes", String(mapping.port.mmioWriteBW)],
  ]);
  return [
    section("Interface", port),
    element(
      "div",
      { class: "columns" },
      section("Parameters", keyValues(flatten(mapping.param))),
      section("Host", keyValues(flatten(mapping.host))),
    ),
  ];
}

async function main(): Promise<void> {
  const path = new URLSearchParams(location.search).get("path");
  const content = byId("content");
  if (!path) {
    content.replaceChildren(element("p", { class: "fail" }, "ball.html needs ?path=<path>."));
    return;
  }
  const found = await prefab();
  const ball = found.get(path);
  if (!ball) {
    content.replaceChildren(element("p", { class: "fail" }, `No Ball ${path} in any snapshot.`));
    return;
  }
  const mapping = ball.config;
  document.title = `${mapping.name} · 3BBench`;
  const where = owner(path) === "prefab" ? "Prefab Ball" : `Ball of design ${owner(path)}`;
  const pages: [string, string, () => HTMLElement[]][] = [
    ["overview", "Overview", () => overview(ball)],
    ["area", "Area", () => areaPart(ball)],
    ["power", "Power", () => powerPart(ball)],
    ["uvm", "UVM", () => coveragePart(ball)],
    ["performance", "Performance", () => performancePart(ball)],
  ];
  const nav = element("nav", { class: "pages", "aria-label": "Analysis" });
  const body = element("div");
  const open = () => {
    const id = location.hash.slice(1) || "overview";
    const page = pages.find(([key]) => key === id);
    if (!page) throw new Error(`ball.html: no page #${id}`);
    nav.replaceChildren(
      ...pages.map(([key, title]) => element("a", key === id ? { href: `#${key}`, "aria-current": "page" } : { href: `#${key}` }, title)),
    );
    body.replaceChildren(...page[2]());
  };
  window.addEventListener("hashchange", open);
  content.replaceChildren(
    element(
      "header",
      { class: "ball-head" },
      element("h1", {}, mapping.name),
      element("p", { class: "muted" }, `${where} · `, element("code", {}, path)),
      figures(ball, scales([...found.values()]), ""),
    ),
    nav,
    body,
  );
  open();
}

void main();
