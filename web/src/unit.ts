// The analysis of one thread or hart across the snapshots:
// unit.html?kind=(thread|hart)&path=<path>.
import {
  areaRun,
  backendName,
  failure,
  history,
  keyValues,
  powerRun,
  section,
  tally,
  unitFigures,
  unitScales,
} from "./analysis";
import { byId, element, label, mm2, owner, watts } from "./dom";
import { units, type Kind, type SnapshotEntry, type Unit, type UnitResult } from "./snapshot";

const title = { thread: "Thread", hart: "Hart" };

// The runs of one evaluation, oldest first.
function runs<T>(unit: Unit, pick: (r: UnitResult) => T | undefined): { entry: SnapshotEntry; value: T }[] {
  return unit.history.flatMap(({ entry, result }) => {
    const value = pick(result);
    return value === undefined ? [] : [{ entry, value }];
  });
}

function table(head: string[], rows: (string | HTMLElement)[][]): HTMLElement {
  return element(
    "table",
    {},
    element("thead", {}, element("tr", {}, ...head.map((h) => element("th", {}, h)))),
    element("tbody", {}, ...rows.map((r) => element("tr", {}, ...r.map((c) => (typeof c === "string" ? element("td", {}, c) : c))))),
  );
}

const cell = (text: string, pass: boolean, number = false) =>
  element("td", { class: [number ? "number" : "", pass ? "" : "fail"].join(" ").trim() }, text);

// Every listed test against each backend of the latest test run; a
// backend whose batch never ran says why above the table.
function testPart(unit: Unit): HTMLElement[] {
  const found = runs(unit, (r) => r.test);
  const last = found.at(-1);
  if (!last) return [element("p", { class: "muted" }, "No run yet.")];
  const { value } = last;
  if (!("backends" in value)) return [failure(value)];
  const backends = Object.entries(value.backends);
  const tests = [...new Set(backends.flatMap(([, b]) => ("tests" in b ? b.tests.map((t) => t.test) : [])))];
  const notes = backends.flatMap(([name, b]) =>
    "tests" in b
      ? []
      : [element("p", { class: "fail" }, `${backendName[name]}: ${b.status}: ${b.error}`)],
  );
  const status = (name: string, test: string) => {
    const b = value.backends[name];
    if (!("tests" in b)) return cell("—", false);
    const s = b.tests.find((t) => t.test === test)?.status ?? "not listed";
    return cell(s, s === "pass");
  };
  return [
    element("p", { class: "muted" }, "The bare-tests regression on each backend."),
    ...notes,
    section(
      "Passed share by run",
      history(
        found.map(({ entry, value }) => {
          const [passed, total] = tally(value);
          return {
            label: label(entry),
            axis: label(entry).slice(5, 16),
            dirty: entry.dirty,
            value: "backends" in value && total ? (100 * passed) / total : undefined,
            text: "backends" in value ? `${passed}/${total}` : value.status,
            detail: () => [],
          };
        }),
        "Passed (%)",
        100,
      ),
    ),
    section(
      "Tests",
      table(
        ["Test", ...backends.map(([name]) => backendName[name])],
        tests.map((test) => [test, ...backends.map(([name]) => status(name, test))]),
      ),
    ),
  ];
}

function areaPart(unit: Unit, kind: Kind): HTMLElement[] {
  const found = runs(unit, (r) => r.area);
  if (!found.length) return [element("p", { class: "muted" }, "No run yet.")];
  return [
    section(
      `${title[kind]} area by run`,
      history(
        found.map(({ entry, value }) => ({
          label: label(entry),
          axis: label(entry).slice(5, 16),
          dirty: entry.dirty,
          value: value.status === "pass" ? value.um2 / 1e6 : undefined,
          text: value.status === "pass" ? mm2(value.um2) : value.status,
          detail: () => (value.status === "pass" ? areaRun(value, [title[kind], value.um2]) : [failure(value)]),
        })),
        `${title[kind]} area (mm²)`,
      ),
    ),
  ];
}

function powerPart(unit: Unit, kind: Kind): HTMLElement[] {
  const found = runs(unit, (r) => r.power);
  if (!found.length) return [element("p", { class: "muted" }, "No run yet.")];
  return [
    section(
      `${title[kind]} power by run`,
      history(
        found.map(({ entry, value }) => ({
          label: label(entry),
          axis: label(entry).slice(5, 16),
          dirty: entry.dirty,
          value: value.status === "pass" ? value.total_w * 1e3 : undefined,
          text: value.status === "pass" ? watts(value.total_w) : value.status,
          detail: () =>
            value.status === "pass"
              ? powerRun(value, `the RTL simulation of the workload the ${kind} declares in power.toml`)
              : [failure(value)],
        })),
        `${title[kind]} power (mW)`,
      ),
    ),
  ];
}

// Each evaluation's latest result.
function overview(unit: Unit): HTMLElement[] {
  const latest = <T extends { status: string }>(pick: (r: UnitResult) => T | undefined, text: (v: T) => string): string => {
    const last = runs(unit, pick).at(-1);
    return last ? text(last.value) : "No run yet";
  };
  return [
    section(
      "Latest results",
      keyValues([
        [
          "Tests",
          latest(
            (r) => r.test,
            (v) => {
              const [passed, total] = tally(v);
              return "backends" in v ? `${v.status}, ${passed}/${total} tests passed` : `${v.status}: ${v.error}`;
            },
          ),
        ],
        ["Area", latest((r) => r.area, (v) => (v.status === "pass" ? mm2(v.um2) : `${v.status}: ${v.error}`))],
        ["Power", latest((r) => r.power, (v) => (v.status === "pass" ? watts(v.total_w) : `${v.status}: ${v.error}`))],
      ]),
    ),
  ];
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const kind = params.get("kind");
  const path = params.get("path");
  const content = byId("content");
  if ((kind !== "thread" && kind !== "hart") || !path) {
    content.replaceChildren(element("p", { class: "fail" }, "unit.html needs ?kind=(thread|hart)&path=<path>."));
    return;
  }
  byId<HTMLAnchorElement>("back").href = `./prefab.html?kind=${kind}`;
  byId("back").textContent = `← All ${title[kind]}s`;
  const found = await units(kind);
  const unit = found.get(path);
  if (!unit) {
    content.replaceChildren(element("p", { class: "fail" }, `No ${kind} ${path} in any snapshot.`));
    return;
  }
  const name = path.split("/").pop()!;
  document.title = `${name} · 3BBench`;
  const where = owner(path) === "prefab" ? `Prefab ${kind}` : `${title[kind]} of design ${owner(path)}`;
  const pages: [string, string, () => HTMLElement[]][] = [
    ["overview", "Overview", () => overview(unit)],
    ["tests", "Tests", () => testPart(unit)],
    ["area", "Area", () => areaPart(unit, kind)],
    ["power", "Power", () => powerPart(unit, kind)],
  ];
  const nav = element("nav", { class: "pages", "aria-label": "Analysis" });
  const body = element("div");
  const open = () => {
    const id = location.hash.slice(1) || "overview";
    const page = pages.find(([key]) => key === id);
    if (!page) throw new Error(`unit.html: no page #${id}`);
    nav.replaceChildren(
      ...pages.map(([key, text]) => element("a", key === id ? { href: `#${key}`, "aria-current": "page" } : { href: `#${key}` }, text)),
    );
    body.replaceChildren(...page[2]());
  };
  window.addEventListener("hashchange", open);
  content.replaceChildren(
    element(
      "header",
      { class: "ball-head" },
      element("h1", {}, name),
      element("p", { class: "muted" }, `${where} · `, element("code", {}, path)),
      unitFigures(unit, unitScales([...found.values()]), ""),
    ),
    nav,
    body,
  );
  open();
}

void main();
