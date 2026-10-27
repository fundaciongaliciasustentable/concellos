// Colour classes for the portrait, the same as Galicia Agora's choropleths
// (site/src/map/choropleth.ts there). Indicators are compared with Galicia:
// index (Galicia = 100) or difference in points. The scale is diverging and
// centred on Galicia; it describes distance from the average, not good or bad.
/** Five classes from "well below Galicia" to "well above Galicia". */
export const DIVERGING = {
    light: ['#8b5e3c', '#cfae8f', '#eeece4', '#8db4c9', '#2e6b8a'],
    dark: ['#c2946e', '#7d5d41', '#45463f', '#41687d', '#6fa8c7'],
};
function num(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
/**
 * Distance from Galicia: 0 means equal to the Galicia value. Indices are
 * compared as ratios (log2), so "half of Galicia" and "double Galicia" sit at
 * the same distance from the centre; points are plain differences.
 */
export function deviation(row, ind) {
    const rel = num(row[`${ind.id}_rel`]);
    if (rel === null)
        return null;
    if (ind.comparison === 'points')
        return rel;
    return rel > 0 ? Math.log2(rel / 100) : null;
}
function quantile(sorted, q) {
    if (!sorted.length)
        return 0;
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    return sorted[i] ?? 0;
}
/** Round to a readable step for legend labels. */
function nice(n) {
    const a = Math.abs(n);
    const step = a >= 50 ? 5 : a >= 10 ? 1 : a >= 1 ? 0.5 : a >= 0.2 ? 0.05 : 0.01;
    return Math.round(n / step) * step;
}
export function breaksFor(rows, ind) {
    const devs = rows
        .map((r) => deviation(r, ind))
        .filter((d) => d !== null)
        .map(Math.abs)
        .sort((a, b) => a - b);
    const t = quantile(devs, 0.9) || 1;
    const minNear = ind.comparison === 'index' ? 0.05 : 0.1;
    return { near: nice(Math.max(t * 0.15, minNear)), strong: nice(Math.max(t * 0.6, minNear * 2)) };
}
export function classIndex(d, b) {
    if (d <= -b.strong)
        return 0;
    if (d < -b.near)
        return 1;
    if (d <= b.near)
        return 2;
    if (d < b.strong)
        return 3;
    return 4;
}
