// The prefab page: every Ball, thread or hart (prefab.html?kind=thread|hart)
// with its latest results; each opens its own analysis and, for a Ball with
// the local bbdev server, runs again from its card.
import { unitFigures, unitScales, type UnitScales } from "./analysis";
import * as bbdev from "./bbdev";
import { byId, element, figures, owner, scales, type Scales } from "./dom";
import { prefab, units, type Ball, type Kind, type Unit } from "./snapshot";

const ballArea = (ball: Ball) => (ball.area?.status === "pass" ? ball.area.ball_um2 : 0);

// What `bench-prefab --<evaluation> --ball` takes: a prefab Ball's name, a design's <design>/balls/<ball>.
const benchName = (path: string) =>
  path.startsWith("examples/prefab/balls/") ? path.split("/").pop()! : path.replace(/^examples\/designs\//, "");

// What a card runs again: each is one `bench-prefab` evaluation.
const evaluations = [
  { label: "Area", evaluation: "area" },
  { label: "UVM", evaluation: "uvm" },
  { label: "Power", evaluation: "power" },
];

// Runs in flight, by Ball path: their status survives a redraw, and the
// latest drawn card of a Ball shows it.
const running = new Map<string, string>();
const statusOf = new Map<string, HTMLElement>();
const show = (path: string) => (statusOf.get(path)!.textContent = running.get(path) ?? "");

function rerun(ball: Ball, redraw: () => Promise<void>): HTMLElement {
  const menu = element("div", { class: "menu", hidden: "" });
  const button = element("button", { type: "button", class: "rerun", title: "Rerun", "aria-haspopup": "menu" }, "↻");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    for (const other of document.querySelectorAll(".menu")) if (other !== menu) other.setAttribute("hidden", "");
    menu.toggleAttribute("hidden");
  });
  for (const { label, evaluation } of evaluations) {
    const item = element("button", { type: "button" }, label);
    item.addEventListener("click", async () => {
      menu.setAttribute("hidden", "");
      const say = (text: string) => {
        running.set(ball.path, `${label}: ${text}`);
        show(ball.path);
      };
      say("submitted");
      try {
        await bbdev.benchPrefab(evaluation, { ball: benchName(ball.path) }, (seconds) => say(`running ${seconds} s`));
        running.delete(ball.path);
        await redraw();
      } catch (error) {
        say((error as Error).message);
      }
    });
    menu.append(item);
  }
  return element("div", { class: "actions" }, button, menu);
}

function card(ball: Ball, scale: Scales, runnable: boolean, redraw: () => Promise<void>): HTMLElement {
  const status = element("span", { class: "muted status" });
  statusOf.set(ball.path, status);
  const page = `./ball.html?${new URLSearchParams({ path: ball.path })}`;
  const node = element(
    "div",
    { class: "card" },
    element("a", { class: "title", href: `${page}#overview` }, ball.config.name),
    figures(ball, scale, page),
    status,
  );
  if (runnable) node.append(rerun(ball, redraw));
  show(ball.path);
  return node;
}

// The Balls grouped by owner, the prefab first, each group largest first.
function groups(found: Ball[], runnable: boolean, redraw: () => Promise<void>): HTMLElement[] {
  const scale = scales(found);
  const owners = [...new Set(found.map((b) => owner(b.path)))].sort((x, y) =>
    x === "prefab" ? -1 : y === "prefab" ? 1 : x.localeCompare(y),
  );
  return owners.map((o) => {
    const members = found.filter((b) => owner(b.path) === o).sort((x, y) => ballArea(y) - ballArea(x));
    return element(
      "section",
      { class: "group" },
      element("h2", {}, o === "prefab" ? "Prefab" : `Design ${o}`, element("span", { class: "count" }, String(members.length))),
      element("div", { class: "cards" }, ...members.map((b) => card(b, scale, runnable, redraw))),
    );
  });
}

// How every Ball is measured: one flow, one process, one clock for all.
function setup(): HTMLElement {
  const item = (name: string, value: string) => element("span", {}, element("b", {}, `${name}: `), value);
  return element(
    "p",
    { class: "legend muted" },
    item("Synthesis", "Synopsys Design Compiler"),
    item("Process", "180 nm"),
    item("Clock constraint", "100 MHz"),
    item("Power", "PrimeTime PX"),
  );
}

// What the bar colors mean, said once for every card.
function legend(): HTMLElement {
  const key = (tone: string, text: string) =>
    element("span", { class: "key" }, element("span", { class: `swatch ${tone}` }), text);
  return element(
    "p",
    { class: "legend muted" },
    key("met", "constraints met at 100 MHz, UVM passed"),
    key("violated", "constraints violated, UVM failed"),
  );
}

const unitArea = (unit: Unit) => (unit.area?.status === "pass" ? unit.area.um2 : 0);

function unitCard(kind: Kind, unit: Unit, scale: UnitScales): HTMLElement {
  const page = `./unit.html?${new URLSearchParams({ kind, path: unit.path })}`;
  return element(
    "div",
    { class: "card" },
    element("a", { class: "title", href: `${page}#overview` }, unit.path.split("/").pop()!),
    unitFigures(unit, scale, page),
  );
}

// The threads or harts grouped by owner, the prefab first, by name.
function unitGroups(kind: Kind, found: Unit[]): HTMLElement[] {
  const scale = unitScales(found);
  const owners = [...new Set(found.map((u) => owner(u.path)))].sort((x, y) =>
    x === "prefab" ? -1 : y === "prefab" ? 1 : x.localeCompare(y),
  );
  return owners.map((o) => {
    const members = found.filter((u) => owner(u.path) === o).sort((x, y) => unitArea(y) - unitArea(x) || x.path.localeCompare(y.path));
    return element(
      "section",
      { class: "group" },
      element("h2", {}, o === "prefab" ? "Prefab" : `Design ${o}`, element("span", { class: "count" }, String(members.length))),
      element("div", { class: "cards" }, ...members.map((u) => unitCard(kind, u, scale))),
    );
  });
}

// What a thread's or a hart's bars mean.
function unitLegend(): HTMLElement {
  const key = (tone: string, text: string) =>
    element("span", { class: "key" }, element("span", { class: `swatch ${tone}` }), text);
  return element(
    "p",
    { class: "legend muted" },
    key("met", "bare-tests passed on BEMU and Verilator, constraints met at 100 MHz"),
    key("violated", "a test failed, constraints violated"),
  );
}

async function main(): Promise<void> {
  const content = byId("content");
  const kind = new URLSearchParams(location.search).get("kind");
  byId("tab-" + (kind ?? "ball")).setAttribute("aria-current", "page");
  if (kind === "thread" || kind === "hart") {
    const found = [...(await units(kind)).values()];
    content.replaceChildren(
      ...(found.length ? [setup(), unitLegend(), ...unitGroups(kind, found)] : [element("p", { class: "muted" }, "No run yet.")]),
    );
    return;
  }
  document.addEventListener("click", () => document.querySelectorAll(".menu").forEach((m) => m.setAttribute("hidden", "")));
  // Running needs the local bbdev server; the published site only reads.
  const runnable = await bbdev.available();
  const redraw = async () => {
    const found = [...(await prefab()).values()];
    content.replaceChildren(
      ...(found.length ? [setup(), legend(), ...groups(found, runnable, redraw)] : [element("p", { class: "muted" }, "No snapshot yet.")]),
    );
  };
  await redraw();
}

void main();
