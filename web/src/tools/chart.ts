// A grouped bar chart: each group a set of bars, one per series, on a log
// axis (the measures here span decades). A bar's value shows on hovering, or
// above every bar with the page's Values switch.
import { element, valuesSwitch } from "../dom";

export interface Series {
  name: string;
  // Its color: s1 … s6.
  tone: string;
}

export interface Group {
  label: string;
  // Groups in a row with the same section share a caption below their labels.
  section?: string;
  // One value per series; undefined where it was not measured.
  values: (number | undefined)[];
}

// Gridded at whole decades, one decade of room below the smallest value.
function axis(values: number[]): { y: (v: number) => number; ticks: number[] } {
  const lo = Math.floor(Math.log10(Math.min(...values))) - 1;
  const hi = Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...values))));
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i));
  return { y: (v) => (100 * (Math.log10(v) - lo)) / (hi - lo), ticks };
}

export function legend(series: Series[]): HTMLElement {
  return element(
    "p",
    { class: "legend" },
    ...series.map((s) => element("span", { class: "key" }, element("span", { class: `swatch ${s.tone}` }), s.name)),
    valuesSwitch(),
  );
}

export function chart(title: string, series: Series[], groups: Group[], format: (v: number) => string): HTMLElement {
  const values = groups.flatMap((g) => g.values.flatMap((v) => v ?? []));
  if (!values.length)
    return element("div", { class: "chart-block" }, element("h3", {}, title), element("p", { class: "muted" }, "Not measured yet."));
  const { y, ticks } = axis(values);
  const name = (g: Group) => (g.section ? `${g.section} · ${g.label}` : g.label);
  const columns = groups.map((g) =>
    element(
      "div",
      { class: "column" },
      ...series.map((s, i) => {
        const v = g.values[i];
        return v === undefined
          ? element("span", { class: "vbar none", title: `${name(g)} · ${s.name}: not measured` })
          : element("span", {
              class: `vbar ${s.tone}`,
              style: `height: ${Math.max(y(v), 0.8)}%`,
              title: `${name(g)} · ${s.name}: ${format(v)}`,
              "data-value": format(v),
            });
      }),
    ),
  );
  // The captions of the sections, each as wide as its groups.
  const sections: { name: string; count: number }[] = [];
  for (const g of groups) {
    const last = sections[sections.length - 1];
    if (last && last.name === g.section) last.count += 1;
    else sections.push({ name: g.section ?? "", count: 1 });
  }
  return element(
    "div",
    { class: "chart-block" },
    element("h3", {}, title),
    element(
      "div",
      { class: "plot" },
      ...ticks.map((t) => element("div", { class: "grid", style: `bottom: ${y(t)}%` }, element("span", {}, format(t)))),
      element("div", { class: "columns" }, ...columns),
    ),
    element("div", { class: "xlabels" }, ...groups.map((g) => element("span", { title: name(g) }, g.label))),
    ...(groups.some((g) => g.section)
      ? [
          element(
            "div",
            { class: "xlabels sections" },
            ...sections.map((s) => element("span", { style: `flex: ${s.count}`, title: s.name }, s.name)),
          ),
        ]
      : []),
  );
}
