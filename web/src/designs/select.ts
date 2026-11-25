// Choosing a design: every design of the map, whether evaluated or not. The
// selected one large on the left (what it is for, its target models, cover,
// metrics, timeline), every design a slanted row on the right with what it
// is for under its name. A click on a row chooses it; a click on the chosen
// row or the cover opens it.
import { byId, element } from "../dom";
import { cover } from "./cover";
import { correctness, designs, map, type Design, type MapDesign } from "./data";
import { hue } from "./hue";

const two = (k: number) => String(k).padStart(2, "0");

function metric(name: string, value: string): HTMLElement {
  return element(
    "div",
    { class: "metric" },
    element("span", { class: "name" }, name),
    element("span", { class: value === "—" ? "value none" : "value" }, value),
  );
}

// The evaluation timeline as a band, one segment per node; a design never
// evaluated has one empty band.
function band(evaluated: Design | undefined): HTMLElement {
  return element(
    "span",
    { class: "progress", title: evaluated ? "Evaluation timeline" : "Not evaluated yet" },
    ...(evaluated
      ? evaluated.latest.nodes.map((x) =>
          element("span", {
            class: x.status,
            title: `${x.name}: ${x.status === "skipped" ? "not applicable" : x.status}`,
          }),
        )
      : [element("span", { class: "pending" })]),
  );
}

function feature(d: MapDesign, evaluated: Design | undefined, i: number, n: number): HTMLElement {
  const passed = evaluated && correctness(evaluated.latest);
  return element(
    "div",
    { class: "feature", style: `--hue: ${hue(d.design)}` },
    element("span", { class: "ghost", "aria-hidden": "true" }, d.design),
    element(
      "div",
      { class: "info" },
      element("span", { class: "pack" }, `DESIGN ${two(i + 1)} / ${two(n)}`),
      element("h2", {}, d.design),
      element("p", { class: "description" }, d.description),
      element(
        "div",
        { class: "metrics" },
        metric("Performance", "—"),
        metric("Correctness", passed ? `${passed.passed} / ${passed.total}` : "—"),
        metric("Accuracy", "—"),
        metric("Area", "—"),
        metric("Power", "—"),
      ),
      element("span", { class: "stage-count" }, "Evaluation timeline"),
      band(evaluated),
    ),
    element(
      "div",
      { class: "side" },
      element("a", { class: "art", href: `./design.html#${d.design}`, title: `Open ${d.design}` }, cover(d.design, d.overview, true)),
      ...(d.models.length
        ? [
            element("span", { class: "stage-count" }, "Target models"),
            element("div", { class: "models" }, ...d.models.map((m) => element("span", {}, m))),
          ]
        : []),
    ),
  );
}

function row(d: MapDesign, evaluated: Design | undefined, i: number): HTMLElement {
  return element(
    "button",
    { class: "row", style: `--hue: ${hue(d.design)}` },
    element("span", { class: "index" }, two(i + 1)),
    element("span", { class: "thumb" }, cover(d.design, d.overview, false)),
    element(
      "span",
      { class: "body" },
      element("span", { class: "name" }, d.design),
      element("span", { class: "about" }, d.description),
      band(evaluated),
    ),
  );
}

function remembered(names: string[]): number {
  try {
    return Math.max(0, names.indexOf(localStorage.getItem("bbbench.design") ?? ""));
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const content = byId("content");
  const all = await map();
  const evaluated = await designs(all);
  const names = all.map((d) => d.design);
  const rows = all.map((d, i) => row(d, evaluated.get(d.design), i));
  const stage = element("div", { class: "feature-slot" });
  const list = element("div", { class: "rows" }, ...rows);
  content.replaceChildren(element("div", { class: "select" }, stage, list));

  let selected = remembered(names);
  const open = (i: number) => (location.href = `./design.html#${names[i]}`);
  const choose = (to: number) => {
    selected = to;
    try {
      localStorage.setItem("bbbench.design", names[selected]);
    } catch {
      // Remembering the choice is a convenience only.
    }
    stage.replaceChildren(feature(all[selected], evaluated.get(names[selected]), selected, names.length));
    rows.forEach((r, i) => r.classList.toggle("on", i === selected));
    rows[selected].scrollIntoView({ block: "nearest" });
  };

  rows.forEach((r, i) => r.addEventListener("click", () => (i === selected ? open(i) : choose(i))));
  choose(selected);
}

void main();
