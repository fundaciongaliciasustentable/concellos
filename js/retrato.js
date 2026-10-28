// Retrato dos concellos. The 313 concellos are dots: on a map at their representative point,
// or along a strip ordered by the active indicator. Scrolling through the indicator cards
// moves the dots between layouts, so the map and the distribution are one picture.
//
// Data: the snapshot in datos/ (scripts/actualizar.py copies it from Galicia Agora's
// published per-concello layers). Dot positions come from perfil-concellos. Nothing is
// requested from another origin. Colours follow a diverging scale centred on Galicia
// (distance from the Galicia value, not better or worse).
import { breaksFor, classIndex, DIVERGING, deviation } from './escala.js';
import { beeswarm, easeInOutCubic, fitGeo, position, valueScale } from './layout.js';
import { TEXTOS } from './textos.js';
const PROFILE = 'perfil-concellos';
/** Reading order of the groups; any other joined layer follows. */
const ORDER = ['indicadores-concellos', PROFILE, 'vut-concello', 'cobertura-banda-larga'];
const DURATION = 800;
/** Reference concellos shown next to the selected one. */
const MAX_REFS = 3;
const STAGGER = 380;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function num(v) {
    if (v === null || v === undefined || v === '')
        return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}
function el(tag, attrs = {}, text) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
        e.setAttribute(k, v);
    if (text !== undefined)
        e.textContent = text;
    return e;
}
function fill(s, vars) {
    return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);
}
/** "#rrggbb" or "rgb(…)" → [r, g, b]; anything else → null (then colours switch, not blend). */
function rgb(c) {
    const h = /^#([0-9a-f]{6})$/i.exec(c);
    if (h?.[1]) {
        const n = Number.parseInt(h[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function mix(a, b, t) {
    const ca = rgb(a);
    const cb = rgb(b);
    if (!ca || !cb)
        return t < 0.5 ? a : b;
    const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export async function start() {
    const found = document.querySelector('.rt-app');
    if (!found)
        return;
    const app = found;
    const lang = (app.dataset.lang ?? 'gl');
    const dict = TEXTOS[lang];
    // Root of the site relative to this page ('./' or '../' for /es/).
    const base = app.dataset.base ?? './';
    const nf = new Intl.NumberFormat(lang === 'gl' ? 'gl-ES' : 'es-ES', {
        maximumFractionDigits: 1,
    });
    const fmt = (v) => v === null
        ? '—'
        : Math.abs(v) < 1 && v !== 0
            ? v.toLocaleString(lang, { maximumFractionDigits: 2 })
            : nf.format(v);
    const stage = app.querySelector('.rt-stage');
    const canvas = app.querySelector('.rt-canvas');
    const tip = app.querySelector('.rt-tip');
    const list = app.querySelector('.rt-list');
    const status = app.querySelector('.rt-status');
    const search = app.querySelector('.rt-search input');
    const refInput = app.querySelector('#rt-ref');
    const refList = app.querySelector('.rt-refs');
    const datalist = app.querySelector('#rt-concellos');
    const foot = app.querySelector('.rt-stage-foot');
    const modeButtons = [...app.querySelectorAll('[data-mode]')];
    const ctx = canvas.getContext('2d');
    // ---- Data -------------------------------------------------------------------------------
    let indice;
    let files;
    try {
        indice = await (await fetch(`${base}datos/indice.json`)).json();
        files = await Promise.all(indice.capas.map(async (id) => {
            try {
                const r = await fetch(`${base}datos/${id}.json`);
                return r.ok ? await r.json() : null;
            }
            catch {
                return null;
            }
        }));
    }
    catch {
        status.textContent = dict.load_error ?? '';
        return;
    }
    // One file per source layer (their licences must not be mixed in one file).
    const joined = files
        .filter((f) => f && f.indicadores.length > 0)
        .map((f) => ({ ...f.capa, indicators: f.indicadores, rows: f.filas }))
        .sort((a, b) => rank(a.id) - rank(b.id));
    function rank(id) {
        const i = ORDER.indexOf(id);
        return i < 0 ? ORDER.length : i;
    }
    if (!joined.some((l) => l.id === PROFILE)) {
        status.textContent = dict.portrait_missing ?? '';
        return;
    }
    const tables = joined.map((l) => l.rows);
    const updated = app.querySelector('.rt-updated');
    if (updated && indice.xerado) {
        updated.textContent = fill(dict.updated ?? '', {
            data: new Date(indice.xerado).toLocaleDateString(lang === 'gl' ? 'gl-ES' : 'es-ES'),
        });
    }
    const concellos = [];
    const items = [];
    joined.forEach((layer, li) => {
        const rows = tables[li];
        if (!rows)
            return;
        const key = 'codigo_ine';
        const byCode = new Map(rows.map((r) => [String(r[key]), r]));
        if (layer.id === PROFILE) {
            for (const r of rows) {
                const lon = num(r.lon);
                const lat = num(r.lat);
                if (lon === null || lat === null)
                    continue;
                concellos.push({
                    code: String(r.codigo_ine),
                    nome: String(r.nome ?? ''),
                    provincia: String(r.provincia ?? ''),
                    lon,
                    lat,
                    superficie: num(r.superficie_km2),
                    lugares: num(r.lugares),
                });
            }
        }
        for (const ind of layer.indicators ?? []) {
            const values = rows.map((r) => num(r[ind.id])).filter((v) => v !== null);
            if (values.length < 2)
                continue;
            items.push({
                key: `${layer.id}.${ind.id}`,
                layer,
                ind,
                rows: byCode,
                values,
                breaks: breaksFor(rows, ind),
            });
        }
    });
    if (concellos.length === 0) {
        status.textContent = dict.portrait_missing ?? '';
        return;
    }
    concellos.sort((a, b) => a.nome.localeCompare(b.nome, lang));
    const byCode = new Map(concellos.map((c) => [c.code, c]));
    const byName = new Map(concellos.map((c) => [c.nome.toLocaleLowerCase(lang), c]));
    for (const c of concellos)
        datalist.append(el('option', { value: c.nome }));
    // ---- State ------------------------------------------------------------------------------
    const params = new URLSearchParams(window.location.hash.slice(1));
    let selected = byCode.get(params.get('c') ?? '') ?? byCode.get('15078') ?? concellos[0];
    let active = items.find((i) => i.key === params.get('i')) ?? null;
    let mode = params.get('v') === 'map' ? 'map' : 'strip';
    let refs = readRefs(params);
    let hover = null;
    function readRefs(p) {
        const codes = (p.get('r') ?? '').split(',');
        const out = [];
        for (const code of codes) {
            const c = byCode.get(code);
            if (c && c !== selected && !out.includes(c) && out.length < MAX_REFS)
                out.push(c);
        }
        return out;
    }
    const writeHash = () => {
        const p = new URLSearchParams();
        if (selected)
            p.set('c', selected.code);
        if (refs.length)
            p.set('r', refs.map((c) => c.code).join(','));
        if (active)
            p.set('i', active.key);
        if (mode === 'map')
            p.set('v', 'map');
        history.replaceState(null, '', `#${p.toString()}`);
    };
    // ---- Geometry ---------------------------------------------------------------------------
    let width = 0;
    let height = 0;
    const dots = concellos.map(() => ({
        x: 0,
        y: 0,
        r: 0,
        color: '#888',
        from: { x: 0, y: 0, r: 0, color: '#888' },
        to: { x: 0, y: 0, r: 0, color: '#888' },
        delay: 0,
    }));
    let axis = null;
    const palette = () => (darkQuery.matches ? DIVERGING.dark : DIVERGING.light);
    function colorOf(c) {
        if (!active)
            return cssVar('--text-muted');
        const row = active.rows.get(c.code);
        const d = row ? deviation(row, active.ind) : null;
        return d === null ? cssVar('--border') : (palette()[classIndex(d, active.breaks)] ?? '#888');
    }
    function valueFor(c, item = active) {
        return item ? num(item.rows.get(c.code)?.[item.ind.id]) : null;
    }
    /** Target layout for the current mode and indicator. */
    function targets() {
        const pad = Math.max(16, width * 0.05);
        const narrow = width < 520;
        if (mode === 'map' || !active) {
            axis = null;
            const project = fitGeo(concellos.map((c) => [c.lon, c.lat]), { x: pad, y: pad, width: width - 2 * pad, height: height - 2 * pad });
            const r = Math.max(2.5, Math.min(width, height) / (narrow ? 90 : 110));
            return concellos.map((c) => ({ ...project(c.lon, c.lat), r, color: colorOf(c) }));
        }
        const item = active;
        const x0 = pad + 8;
        const x1 = width - pad - 8;
        const scale = valueScale(item.values, x0, x1);
        const cy = height * 0.5 + 4;
        const xs = concellos.map((c) => {
            const v = valueFor(c, item);
            return v === null ? Number.NaN : scale(v);
        });
        const withData = xs.map((x, i) => ({ x, i })).filter((p) => !Number.isNaN(p.x));
        let r = Math.min(7, Math.max(2.5, (x1 - x0) / 70));
        let ys = [];
        for (let tries = 0; tries < 8; tries++) {
            ys = beeswarm(withData.map((p) => p.x), r + 0.6);
            if (Math.max(0, ...ys.map(Math.abs)) <= height * 0.5 - 44)
                break;
            r *= 0.86;
        }
        // Still too tall for a very peaked distribution: squeeze the offsets (dots may touch).
        const limit = height * 0.5 - 44;
        const tallest = Math.max(0, ...ys.map(Math.abs));
        if (tallest > limit)
            ys = ys.map((y) => (y * limit) / tallest);
        const out = concellos.map(() => ({ x: 0, y: 0, r, color: '' }));
        withData.forEach((p, k) => {
            out[p.i] = { x: p.x, y: cy + (ys[k] ?? 0), r, color: colorOf(concellos[p.i]) };
        });
        // Concellos without data line up quietly in the top-left corner.
        let n = 0;
        concellos.forEach((c, i) => {
            if (!Number.isNaN(xs[i]))
                return;
            out[i] = { x: x0 + n * (r * 2.4), y: 10, r: r * 0.8, color: colorOf(c) };
            n++;
        });
        const g = num([...item.rows.values()].find((row) => num(row[`${item.ind.id}_galicia`]) !== null)?.[`${item.ind.id}_galicia`]);
        axis = {
            y: cy,
            x0,
            x1,
            galicia: g === null ? null : scale(g),
            galiciaValue: g,
            min: scale.domain[0],
            max: scale.domain[1],
            kind: scale.kind,
        };
        return out;
    }
    // ---- Animation and drawing --------------------------------------------------------------
    let animStart = 0;
    let animating = false;
    function layout(animate) {
        const t = targets();
        const xs = t.map((p) => p.x);
        const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
        dots.forEach((d, i) => {
            const to = t[i];
            d.from = { x: d.x, y: d.y, r: d.r, color: d.color };
            d.to = to;
            // A wave across the stage: the left side moves first.
            d.delay = maxX > minX ? ((to.x - minX) / (maxX - minX)) * STAGGER : 0;
        });
        if (!animate || reducedMotion.matches) {
            for (const d of dots)
                Object.assign(d, d.to);
            animating = false;
            draw();
            return;
        }
        animStart = performance.now();
        if (!animating) {
            animating = true;
            requestAnimationFrame(frame);
        }
    }
    function frame(now) {
        let done = true;
        for (const d of dots) {
            const t = Math.min(1, Math.max(0, (now - animStart - d.delay) / DURATION));
            if (t < 1)
                done = false;
            const e = easeInOutCubic(t);
            d.x = d.from.x + (d.to.x - d.from.x) * e;
            d.y = d.from.y + (d.to.y - d.from.y) * e;
            d.r = d.from.r + (d.to.r - d.from.r) * e;
            d.color = mix(d.from.color, d.to.color, e);
        }
        draw();
        if (done)
            animating = false;
        else
            requestAnimationFrame(frame);
    }
    function draw() {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, canvas.height);
        const text = cssVar('--text');
        const muted = cssVar('--text-muted');
        const surface = cssVar('--surface');
        ctx.font = `600 13px ${cssVar('--gs-font-corpo')}`;
        if (axis && active && mode === 'strip') {
            ctx.strokeStyle = cssVar('--border');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(axis.x0, axis.y);
            ctx.lineTo(axis.x1, axis.y);
            ctx.stroke();
            ctx.fillStyle = muted;
            ctx.textBaseline = 'top';
            const bottom = height - 18;
            ctx.textAlign = 'left';
            ctx.fillText(fmt(axis.min), axis.x0, bottom);
            ctx.textAlign = 'right';
            ctx.fillText(`${fmt(axis.max)} ${active.ind.unit}`, axis.x1, bottom);
            if (axis.kind !== 'linear' && width > 560) {
                ctx.textAlign = 'center';
                const note = axis.kind === 'log' ? dict.portrait_log : dict.portrait_sqrt;
                ctx.fillText(note ?? '', (axis.x0 + axis.x1) / 2, bottom);
            }
            if (axis.galicia !== null) {
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = muted;
                ctx.beginPath();
                ctx.moveTo(axis.galicia, 30);
                ctx.lineTo(axis.galicia, height - 26);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = muted;
                const gLabel = `Galicia · ${fmt(axis.galiciaValue)}`;
                const gw = ctx.measureText(gLabel).width;
                ctx.fillText(gLabel, Math.min(width - gw / 2 - 4, Math.max(gw / 2 + 4, axis.galicia)), 26);
            }
        }
        const sel = selected ? concellos.indexOf(selected) : -1;
        const hov = hover ? concellos.indexOf(hover) : -1;
        const refIdx = refs.map((c) => concellos.indexOf(c));
        dots.forEach((d, i) => {
            if (i === sel || refIdx.includes(i))
                return;
            ctx.beginPath();
            ctx.arc(d.x, d.y, Math.max(0.5, d.r), 0, Math.PI * 2);
            ctx.fillStyle = d.color;
            ctx.fill();
            // A faint outline in the text colour keeps the pale middle class visible on any background.
            ctx.lineWidth = 0.75;
            ctx.globalAlpha = 0.28;
            ctx.strokeStyle = text;
            ctx.stroke();
            ctx.globalAlpha = 1;
        });
        if (hov >= 0 && hov !== sel) {
            const d = dots[hov];
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r + 2, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = text;
            ctx.stroke();
        }
        drawRefs(refIdx, text, surface);
        if (sel >= 0 && selected) {
            const d = dots[sel];
            const R = Math.max(d.r * 1.9, 7);
            ctx.beginPath();
            ctx.arc(d.x, d.y, R + 5, 0, Math.PI * 2);
            ctx.fillStyle = `${surface}`;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(d.x, d.y, R, 0, Math.PI * 2);
            ctx.fillStyle = d.color;
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = text;
            ctx.stroke();
            // Label above the dot, kept inside the stage.
            const v = valueFor(selected);
            const label = active && v !== null ? `${selected.nome} · ${fmt(v)}` : selected.nome;
            ctx.font = `700 15px ${cssVar('--gs-font-corpo')}`;
            const w = ctx.measureText(label).width;
            const lx = Math.min(width - w / 2 - 8, Math.max(w / 2 + 8, d.x));
            const ly = d.y - R - 10;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.lineWidth = 4;
            ctx.strokeStyle = surface;
            ctx.strokeText(label, lx, ly);
            ctx.fillStyle = text;
            ctx.fillText(label, lx, ly);
        }
    }
    /**
     * Reference concellos: the dot in its colour inside a numbered ring, with the name and value
     * below it (the selected concello's label goes above). Labels that would overlap stack down.
     */
    function drawRefs(refIdx, text, surface) {
        // Boxes the labels must not cover: earlier labels and the marked dots themselves.
        const placed = [];
        const sel = selected ? concellos.indexOf(selected) : -1;
        const marks = [...refIdx, sel].filter((i) => i >= 0).map((i) => {
            const d = dots[i];
            const R = Math.max(d.r * 1.9, 7) + 4;
            return { i, x: d.x, y: d.y - R, w: 2 * R, h: 2 * R };
        });
        const order = refIdx.map((i, n) => ({ i, n })).filter((r) => r.i >= 0);
        order.sort((a, b) => dots[a.i].x - dots[b.i].x);
        for (const { i, n } of order) {
            const d = dots[i];
            const R = Math.max(d.r * 1.5, 5.5);
            ctx.beginPath();
            ctx.arc(d.x, d.y, R + 4, 0, Math.PI * 2);
            ctx.fillStyle = surface;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(d.x, d.y, R, 0, Math.PI * 2);
            ctx.fillStyle = d.color;
            ctx.fill();
            ctx.setLineDash([3, 2]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = text;
            ctx.stroke();
            ctx.setLineDash([]);
            const c = concellos[i];
            const v = valueFor(c);
            const label = active && v !== null ? `${n + 1} ${c.nome} · ${fmt(v)}` : `${n + 1} ${c.nome}`;
            ctx.font = `600 13px ${cssVar('--gs-font-corpo')}`;
            const w = ctx.measureText(label).width;
            const lx = Math.min(width - w / 2 - 8, Math.max(w / 2 + 8, d.x));
            let ly = d.y + R + 6;
            for (let moved = true, tries = 0; moved && tries < 12; tries++) {
                moved = false;
                for (const b of [...placed, ...marks]) {
                    if (b.i === i)
                        continue;
                    if (Math.abs(b.x - lx) < (b.w + w) / 2 + 4 && ly < b.y + b.h && ly + 15 > b.y) {
                        ly = b.y + b.h + 2;
                        moved = true;
                    }
                }
            }
            ly = Math.min(ly, height - 34);
            placed.push({ x: lx, y: ly, w, h: 15 });
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.lineWidth = 4;
            ctx.strokeStyle = surface;
            ctx.strokeText(label, lx, ly);
            ctx.fillStyle = text;
            ctx.fillText(label, lx, ly);
        }
    }
    function resize() {
        const rect = stage.getBoundingClientRect();
        width = rect.width;
        // Plot height: the footer bar (legend and view switch) sits over the bottom of the canvas.
        height = rect.height - (foot?.offsetHeight ?? 0);
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        layout(false);
    }
    // ---- Cards ------------------------------------------------------------------------------
    const cards = new Map();
    const intro = el('section', { class: 'rt-card rt-intro', 'data-key': '' });
    list.append(intro);
    let currentGroup = '';
    for (const item of items) {
        if (item.layer.id !== currentGroup) {
            currentGroup = item.layer.id;
            const head = el('header', { class: 'rt-group' });
            head.append(el('h2', {}, item.layer.title[lang]));
            if (item.layer.meta && item.layer.meta.status !== 'fresh') {
                head.append(el('span', { class: 'rt-badge', 'data-status': item.layer.meta.status }, dict[`status_${item.layer.meta.status}`] ?? ''));
            }
            const src = el('details', { class: 'rt-source' });
            const body = el('p');
            body.append(el('a', { href: item.layer.source_url, rel: 'noopener' }, dict.source ?? ''), document.createTextNode(` · ${item.layer.attribution}`));
            src.append(el('summary', {}, dict.portrait_sources ?? ''), body);
            head.append(src);
            list.append(head);
        }
        const card = el('section', {
            class: 'rt-card',
            'data-key': item.key,
            tabindex: '0',
            'aria-label': item.ind.label[lang],
        });
        cards.set(item.key, card);
        list.append(card);
    }
    function renderIntro() {
        if (!selected)
            return;
        const c = selected;
        intro.replaceChildren(el('p', { class: 'rt-kicker' }, c.provincia), el('h1', { class: 'rt-name' }, c.nome), el('p', { class: 'rt-facts' }, [
            c.superficie !== null ? `${fmt(c.superficie)} km²` : '',
            c.lugares ? `${nf.format(c.lugares)} ${dict.portrait_places}` : '',
        ]
            .filter(Boolean)
            .join(' · ')), el('p', { class: 'rt-lede' }, fill(dict.portrait_lede ?? '', { n: concellos.length })));
    }
    function miniStrip(item, value, refValues = []) {
        const W = 300;
        const H = 30;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('class', 'rt-mini');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('preserveAspectRatio', 'none');
        const s = valueScale(item.values, 2, W - 2);
        const ticks = document.createElementNS(ns, 'path');
        ticks.setAttribute('d', item.values.map((v) => `M${s(v).toFixed(1)} 8V22`).join(''));
        ticks.setAttribute('class', 'rt-mini-ticks');
        svg.append(ticks);
        const g = num([...item.rows.values()][0]?.[`${item.ind.id}_galicia`]);
        if (g !== null) {
            const gl = document.createElementNS(ns, 'path');
            gl.setAttribute('d', `M${s(g).toFixed(1)} 2V28`);
            gl.setAttribute('class', 'rt-mini-galicia');
            svg.append(gl);
        }
        for (const rv of refValues) {
            if (rv === null)
                continue;
            const ref = document.createElementNS(ns, 'path');
            ref.setAttribute('d', `M${s(rv).toFixed(1)} 4V26`);
            ref.setAttribute('class', 'rt-mini-ref');
            svg.append(ref);
        }
        if (value !== null) {
            const me = document.createElementNS(ns, 'path');
            me.setAttribute('d', `M${s(value).toFixed(1)} 0V30`);
            me.setAttribute('class', 'rt-mini-me');
            svg.append(me);
        }
        return svg;
    }
    function renderCard(item) {
        const card = cards.get(item.key);
        if (!card || !selected)
            return;
        const row = item.rows.get(selected.code);
        const v = valueFor(selected, item);
        const g = num(row?.[`${item.ind.id}_galicia`]);
        const periodo = row?.[`${item.ind.id}_periodo`];
        const parts = [el('h3', {}, item.ind.label[lang])];
        const big = el('p', { class: 'rt-value' });
        big.append(el('strong', {}, fmt(v)), document.createTextNode(v === null ? ` ${dict.portrait_no_data}` : ` ${item.ind.unit}`));
        parts.push(big);
        parts.push(el('p', { class: 'rt-galicia' }, `Galicia: ${fmt(g)} ${item.ind.unit}`));
        if (v !== null) {
            const pos = position(v, item.values);
            const key = pos.side === 'middle'
                ? 'portrait_middle'
                : pos.side === 'above'
                    ? 'portrait_above'
                    : 'portrait_below';
            parts.push(el('p', { class: 'rt-pos' }, fill(dict[key] ?? '', { pct: pos.pct })));
        }
        const refValues = refs.map((c) => valueFor(c, item));
        if (refs.length) {
            const ul = el('ol', { class: 'rt-card-refs' });
            refs.forEach((c, n) => {
                const li = el('li');
                li.append(el('span', { class: 'rt-ref-n', 'aria-hidden': 'true' }, String(n + 1)), el('span', { class: 'rt-ref-name' }, c.nome), el('span', { class: 'rt-ref-v' }, refValues[n] === null ? dict.portrait_no_data ?? '' : `${fmt(refValues[n])} ${item.ind.unit}`));
                ul.append(li);
            });
            parts.push(ul);
        }
        parts.push(miniStrip(item, v, refValues));
        const meta = [];
        if (periodo)
            meta.push(`${dict.period}: ${periodo}`);
        meta.push(item.ind.source);
        parts.push(el('p', { class: 'rt-meta' }, meta.join(' · ')));
        if (item.ind.note) {
            const det = el('details', { class: 'rt-note' });
            det.append(el('summary', {}, dict.portrait_how ?? ''), el('p', {}, item.ind.note[lang]));
            parts.push(det);
        }
        card.replaceChildren(...parts);
    }
    function renderRefs() {
        refList.replaceChildren(...refs.map((c, n) => {
            const li = el('li');
            const remove = el('button', { type: 'button', 'aria-label': fill(dict.portrait_remove ?? '', { nome: c.nome }) }, '×');
            remove.addEventListener('click', () => toggleRef(c));
            li.append(el('span', { class: 'rt-ref-n', 'aria-hidden': 'true' }, String(n + 1)), el('span', {}, c.nome), remove);
            return li;
        }));
        refInput.disabled = refs.length >= MAX_REFS;
        refInput.placeholder = refs.length >= MAX_REFS ? (dict.portrait_compare_full ?? '') : '';
    }
    function renderAll() {
        renderIntro();
        renderRefs();
        for (const item of items)
            renderCard(item);
        for (const [k, c] of cards)
            c.classList.toggle('is-active', active?.key === k);
        search.value = selected?.nome ?? '';
        const v = selected ? valueFor(selected) : null;
        canvas.setAttribute('aria-label', active && selected
            ? `${active.ind.label[lang]}. ${selected.nome}: ${fmt(v)} ${active.ind.unit}.`
            : (dict.portrait_canvas ?? ''));
        for (const b of modeButtons) {
            b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
            // The intro always shows the map: the switch only applies to an indicator.
            b.disabled = !active;
        }
    }
    // ---- Interaction ------------------------------------------------------------------------
    function select(c) {
        if (!c || c === selected)
            return;
        selected = c;
        refs = refs.filter((r) => r !== c);
        renderAll();
        writeHash();
        draw();
    }
    function activate(key) {
        const next = items.find((i) => i.key === key) ?? null;
        if (next === active)
            return;
        active = next;
        for (const [k, c] of cards)
            c.classList.toggle('is-active', active?.key === k);
        renderAll();
        writeHash();
        layout(true);
    }
    function toggleRef(c) {
        if (c === selected) {
            status.textContent = dict.portrait_compare_same ?? '';
            return;
        }
        if (refs.includes(c))
            refs = refs.filter((r) => r !== c);
        else if (refs.length < MAX_REFS)
            refs = [...refs, c];
        else {
            status.textContent = dict.portrait_compare_full ?? '';
            return;
        }
        status.textContent = '';
        renderAll();
        writeHash();
        draw();
    }
    refInput.addEventListener('change', () => {
        const value = refInput.value.trim();
        if (!value)
            return;
        const c = byName.get(value.toLocaleLowerCase(lang));
        if (!c) {
            status.textContent = dict.portrait_not_found ?? '';
            return;
        }
        refInput.value = '';
        if (!refs.includes(c))
            toggleRef(c);
    });
    // The compare field stays folded under a small link; opening it puts the cursor there.
    refInput.closest('details')?.addEventListener('toggle', (e) => {
        if (e.target.open)
            refInput.focus();
    });
    refInput.addEventListener('input', () => {
        status.textContent = '';
    });
    search.addEventListener('change', () => {
        const c = byName.get(search.value.trim().toLocaleLowerCase(lang));
        if (c)
            select(c);
        else
            status.textContent = dict.portrait_not_found ?? '';
    });
    search.addEventListener('input', () => {
        status.textContent = '';
    });
    for (const b of modeButtons) {
        b.addEventListener('click', () => {
            mode = b.dataset.mode === 'map' ? 'map' : 'strip';
            renderAll();
            writeHash();
            layout(true);
        });
    }
    function hit(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let best = -1;
        let bestD = Number.POSITIVE_INFINITY;
        dots.forEach((d, i) => {
            const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
            if (dd < bestD && dd <= (d.r + 6) ** 2) {
                bestD = dd;
                best = i;
            }
        });
        return best >= 0 ? concellos[best] : null;
    }
    canvas.addEventListener('pointermove', (e) => {
        const c = hit(e);
        if (c !== hover) {
            hover = c;
            if (!animating)
                draw();
        }
        if (c) {
            const v = valueFor(c);
            tip.textContent = active && v !== null ? `${c.nome} · ${fmt(v)} ${active.ind.unit}` : c.nome;
            const rect = stage.getBoundingClientRect();
            tip.style.left = `${Math.min(rect.width - 8, e.clientX - rect.left + 12)}px`;
            tip.style.top = `${e.clientY - rect.top + 12}px`;
            tip.hidden = false;
            canvas.style.cursor = 'pointer';
        }
        else {
            tip.hidden = true;
            canvas.style.cursor = '';
        }
    });
    canvas.addEventListener('pointerleave', () => {
        hover = null;
        tip.hidden = true;
        if (!animating)
            draw();
    });
    canvas.addEventListener('click', (e) => {
        const c = hit(e);
        if (!c)
            return;
        if (e.shiftKey)
            toggleRef(c);
        else
            select(c);
    });
    // Scrollytelling: the card crossing the middle of the viewport drives the stage.
    const observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting)
                continue;
            activate(e.target.dataset.key ?? '');
        }
    }, { rootMargin: '-50% 0px -45% 0px' });
    observer.observe(intro);
    for (const c of cards.values()) {
        observer.observe(c);
        c.addEventListener('click', () => activate(c.dataset.key ?? ''));
        c.addEventListener('focus', () => activate(c.dataset.key ?? ''));
    }
    // Links to another concello or indicator on the same page arrive as a hash change.
    window.addEventListener('hashchange', () => {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const c = byCode.get(p.get('c') ?? '');
        const m = p.get('v') === 'map' ? 'map' : 'strip';
        if (m !== mode) {
            mode = m;
            layout(true);
        }
        if (c)
            select(c);
        const next = readRefs(p);
        if (next.map((r) => r.code).join() !== refs.map((r) => r.code).join()) {
            refs = next;
            renderAll();
            draw();
        }
        const key = p.get('i');
        if (key && key !== active?.key) {
            activate(key);
            cards
                .get(key)
                ?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
        }
    });
    new ResizeObserver(() => resize()).observe(stage);
    darkQuery.addEventListener('change', () => layout(false));
    status.textContent = '';
    renderAll();
    resize();
    // Opening: the dots gather from the selected concello into the map of Galicia.
    if (!reducedMotion.matches && selected) {
        const s = dots[concellos.indexOf(selected)];
        const target = targets();
        dots.forEach((d, i) => {
            Object.assign(d, { x: s.to.x, y: s.to.y, r: 0, color: target[i].color });
        });
        layout(true);
    }
    if (active)
        cards.get(active.key)?.scrollIntoView({ block: 'start' });
}
