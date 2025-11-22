// src/pages/GangsheetBuilder.js
import React, { useEffect, useRef, useState } from "react";
import Navigation from "../components/Navigation";

/*
  GangsheetBuilder.js
  - Tailwind UI
  - Per-item pointer dragging (touch + mouse) with pointer capture
  - Auto-layout: free, grid, compact, smart
  - Export PNG / SVG / PDF (dynamic imports if installed)
  - Save / Load / Share
  - Dup/Del fixes + smooth dragging
*/

const PRESETS = [
  { id: "22x24", label: "22 x 24 in", w: 22, h: 24, unit: "in" },
  { id: "22x60", label: "22 x 60 in", w: 22, h: 60, unit: "in" },
  { id: "22x120", label: "22 x 120 in", w: 22, h: 120, unit: "in" },
  { id: "A3", label: "A3 (29.7 x 42 cm)", w: 29.7, h: 42, unit: "cm" },
  { id: "A4", label: "A4 (21 x 29.7 cm)", w: 21, h: 29.7, unit: "cm" },
];

const DISPLAY_DPI = 96;

function toPx(value, unit, dpi = DISPLAY_DPI) {
  if (unit === "px") return value;
  if (unit === "in") return Math.round(value * dpi);
  return Math.round((value / 2.54) * dpi);
}
function fromPx(px, unit, dpi = DISPLAY_DPI) {
  if (unit === "px") return px;
  if (unit === "in") return +(px / dpi).toFixed(3);
  return +((px / dpi) * 2.54).toFixed(2);
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return Object.assign({}, obj);
  }
}

export default function GangsheetBuilder() {
  const [sheetPreset, setSheetPreset] = useState(PRESETS[0]);
  const [unit, setUnit] = useState(PRESETS[0].unit);
  const [dpi, setDpi] = useState(300);
  const [zoom, setZoom] = useState(0.85);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(8);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [autoLayoutMode, setAutoLayoutMode] = useState("smart");

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const sheetRef = useRef(null);
  const fileInputRef = useRef(null);

  // keep ref to items to prevent stale closures in drag handlers
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // derived
  const sheetPxW = toPx(sheetPreset.w, sheetPreset.unit, DISPLAY_DPI);
  const sheetPxH = toPx(sheetPreset.h, sheetPreset.unit, DISPLAY_DPI);

  /* ---------------- Upload helpers ---------------- */
  async function handleUploadFromInput(e) {
    const files = e?.target?.files || (fileInputRef.current && fileInputRef.current.files);
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    for (const f of arr) {
      try {
        const data = await readFileAsDataURL(f);
        const img = await loadImage(data);
        const id = uid();
        const baseScale =
          Math.min(0.45, Math.min(sheetPxW / (img.width * 1.2), sheetPxH / (img.height * 1.2))) ||
          0.25;
        const item = {
          id,
          name: f.name,
          src: data,
          w: img.width,
          h: img.height,
          x: 20 + (itemsRef.current.length * 8) % Math.max(1, sheetPxW - 200),
          y: 20 + (itemsRef.current.length * 14) % Math.max(1, sheetPxH - 200),
          rot: 0,
          scale: baseScale,
          visible: true,
        };
        setItems((s) => [...s, item]);
      } catch (err) {
        console.warn("Failed to load file", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  function loadImage(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = dataUrl;
    });
  }

  /* ---------------- Item ops (dup/del safe) ---------------- */
  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((prevSel) => (prevSel === id ? null : prevSel));
  }

  function duplicateItem(id, copies = 1) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (!it) return prev;
      const dupes = [];
      for (let i = 0; i < copies; i++) {
        const newId = uid();
        dupes.push({ ...deepClone(it), id: newId, x: it.x + 12 * (i + 1), y: it.y + 12 * (i + 1) });
      }
      const next = [...prev, ...dupes];
      setSelectedId(dupes[dupes.length - 1].id);
      return next;
    });
  }

  function autofillItem(id) {
    const it = itemsRef.current.find((i) => i.id === id);
    if (!it) return;
    const cellW = it.w * it.scale;
    const cellH = it.h * it.scale;
    const cols = Math.max(1, Math.floor(sheetPxW / cellW));
    const rows = Math.max(1, Math.floor(sheetPxH / cellH));
    const newItems = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newItems.push({ ...deepClone(it), id: uid(), x: c * cellW + 2, y: r * cellH + 2 });
      }
    }
    setItems((s) => [...s, ...newItems]);
  }

  /* ---------------- Layout (unchanged) ---------------- */
  function applyGridLayout() {
    const margin = 12;
    const n = itemsRef.current.length || 1;
    const cols = Math.ceil(Math.sqrt(n));
    const cellW = Math.max(60, Math.floor((sheetPxW - margin * 2) / cols));
    const cellH = cellW;
    setItems((prev) =>
      prev.map((it, idx) => ({
        ...it,
        x: margin + (idx % cols) * cellW,
        y: margin + Math.floor(idx / cols) * cellH,
        scale: Math.min(1, cellW / it.w),
      }))
    );
  }
  function applyCompactLayout() {
    let x = 8;
    let y = 8;
    let rowH = 0;
    const placed = [];
    for (const it of itemsRef.current) {
      const s = Math.min(1, (sheetPxW - 16) / (it.w * 3));
      const w = it.w * s;
      const h = it.h * s;
      if (x + w > sheetPxW - 8) {
        x = 8;
        y += rowH + 8;
        rowH = 0;
      }
      placed.push({ ...it, x, y, scale: s });
      x += w + 8;
      rowH = Math.max(rowH, h);
    }
    setItems(placed);
  }
  function applySmartPack() {
    if (itemsRef.current.length === 0) return;
    const nodes = itemsRef.current.map((it) => deepClone(it));
    nodes.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);

    const shelves = [];
    const padding = 6;
    const placed = [];

    for (const node of nodes) {
      let fit = false;
      for (const shelf of shelves) {
        const availableW = sheetPxW - shelf.xUsed - padding;
        const maxItemH = Math.max(8, shelf.height - padding);
        const scaleByShelf = Math.min(1, maxItemH / node.h);
        const itemW = Math.round(node.w * scaleByShelf);
        if (itemW <= availableW) {
          const x = shelf.xUsed + padding;
          const y = shelf.y + padding / 2;
          placed.push({ ...node, x, y, scale: scaleByShelf });
          shelf.xUsed += itemW + padding;
          fit = true;
          break;
        }
      }
      if (fit) continue;

      const usedHeight = shelves.reduce((acc, s) => acc + s.height + padding, 0);
      const remaining = sheetPxH - usedHeight - padding;
      let shelfHeight = Math.min(node.h, Math.max(40, remaining));
      if (shelfHeight < 20) shelfHeight = Math.max(20, remaining);

      const scaleByShelf = Math.min(1, (shelfHeight - padding) / node.h);
      const itemW = Math.round(node.w * scaleByShelf);
      const x = padding;
      const y = usedHeight + padding;
      shelves.push({ y, height: shelfHeight, xUsed: x + itemW + padding });
      placed.push({ ...node, x, y: y + padding / 2, scale: scaleByShelf });
    }

    const placedById = new Map(placed.map((p) => [p.id, p]));
    setItems((prev) => prev.map((it) => placedById.get(it.id) ?? it));
  }
  function applyAutoLayout(mode) {
    if (mode === "free") return;
    if (mode === "grid") return applyGridLayout();
    if (mode === "compact") return applyCompactLayout();
    if (mode === "smart") return applySmartPack();
  }

  /* ---------------- Dragging per-item (solid & smooth) ---------------- */
  // startDrag is called from onPointerDown on each item div
  function startDrag(e, id) {
    // ignore if click came from toolbar or nodrag area
    if (e.target.closest && e.target.closest("[data-nodrag]")) return;

    const el = e.currentTarget; // the item div
    const pointerId = e.pointerId;

    // ensure we have the most recent item data
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;

    // capture pointer to this element (ensures we receive pointermove)
    try {
      el.setPointerCapture && el.setPointerCapture(pointerId);
    } catch (err) {
      // some browsers may throw if pointer capture not supported
    }

    // initial positions
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startItemX = item.x;
    const startItemY = item.y;

    // UX changes while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    function onPointerMove(ev) {
      // only respond to the same pointer
      if (ev.pointerId !== pointerId) return;

      const dx = (ev.clientX - startClientX) / Math.max(0.0001, zoom);
      const dy = (ev.clientY - startClientY) / Math.max(0.0001, zoom);

      let nx = startItemX + dx;
      let ny = startItemY + dy;

      if (snapToGrid) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }

      // clamp to sheet area
      nx = Math.max(0, Math.min(nx, sheetPxW - (item.w * item.scale)));
      ny = Math.max(0, Math.min(ny, sheetPxH - (item.h * item.scale)));

      updateItem(id, { x: nx, y: ny });
    }

    function onPointerUp(ev) {
      if (ev.pointerId !== pointerId) return;
      try {
        el.releasePointerCapture && el.releasePointerCapture(pointerId);
      } catch {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.userSelect = "auto";
      document.body.style.cursor = "auto";
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  /* ---------------- Export helpers (unchanged) ---------------- */
  async function exportPNG() {
    if (!sheetRef.current) return alert("Canvas is not ready");
    try {
      const html2canvasMod = await import("html2canvas").catch(() => null);
      if (!html2canvasMod) throw new Error("html2canvas not installed");
      const html2canvas = html2canvasMod.default || html2canvasMod;
      const el = sheetRef.current;
      const scaleFactor = dpi / DISPLAY_DPI;
      const canvas = await html2canvas(el, {
        scale: scaleFactor,
        backgroundColor: transparent ? null : bgColor,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      downloadDataUrl(dataUrl, `gangsheet-${Date.now()}.png`);
    } catch (err) {
      console.warn("PNG export failed or html2canvas not installed, falling back to SVG", err);
      exportSVG();
    }
  }
  function exportSVG() {
    const svg = serializeToSVG();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    downloadUrl(url, `gangsheet-${Date.now()}.svg`);
  }
  async function exportPDF() {
    try {
      const { jsPDF } = await import("jspdf").catch(() => ({}));
      if (!jsPDF) throw new Error("jspdf not installed");
      await exportPNG();
      alert("PDF export attempted (requires jspdf integration).");
    } catch (err) {
      alert("PDF export requires jspdf. Install with `npm install jspdf`. Falling back to PNG/SVG.");
      exportPNG();
    }
  }
  function exportAs(format = "png") {
    if (format === "png") return exportPNG();
    if (format === "svg") return exportSVG();
    if (format === "pdf") return exportPDF();
    return exportPNG();
  }
  function serializeToSVG() {
    const w = toPx(sheetPreset.w, sheetPreset.unit, dpi);
    const h = toPx(sheetPreset.h, sheetPreset.unit, dpi);
    const bg = transparent ? "none" : bgColor;
    const parts = [
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`,
    ];
    if (!transparent) parts.push(`<rect width='100%' height='100%' fill='${bg}' />`);
    for (const it of itemsRef.current) {
      const x = Math.round((it.x / sheetPxW) * w);
      const y = Math.round((it.y / sheetPxH) * h);
      const iw = Math.round((it.w * it.scale / sheetPxW) * w);
      const ih = Math.round((it.h * it.scale / sheetPxH) * h);
      const transform = `translate(${x + iw / 2} ${y + ih / 2}) rotate(${it.rot}) translate(${-iw / 2} ${-ih / 2})`;
      parts.push(
        `<image transform='${transform}' width='${iw}' height='${ih}' href='${it.src}' preserveAspectRatio='xMidYMid meet' />`
      );
    }
    parts.push(`</svg>`);
    return parts.join("\n");
  }
  function downloadDataUrl(dataUrl, name) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function downloadUrl(url, name) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------------- Save / Load / Share ---------------- */
  function saveProject(key = "gangsheet_autosave") {
    const state = { items, sheetPreset, dpi, unit };
    localStorage.setItem(key, JSON.stringify(state));
    alert("Project saved locally");
  }
  function loadProject(key = "gangsheet_autosave") {
    const raw = localStorage.getItem(key);
    if (!raw) return alert("No saved project found");
    try {
      const parsed = JSON.parse(raw);
      setItems(parsed.items || []);
      setSheetPreset(parsed.sheetPreset || PRESETS[0]);
      setDpi(parsed.dpi || 300);
      setUnit(parsed.unit || PRESETS[0].unit);
      alert("Project loaded");
    } catch {
      alert("Failed to load project");
    }
  }
  function copyShareableLink() {
    const state = { items, sheetPreset, dpi, unit };
    const enc = encodeURIComponent(btoa(JSON.stringify(state)));
    const link = `${location.origin}${location.pathname}?gang=${enc}`;
    navigator.clipboard?.writeText(link);
    alert("Share link copied to clipboard");
  }

  // read share payload on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const enc = params.get("gang");
    if (!enc) return;
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(enc)));
      if (decoded.items) setItems(decoded.items);
      if (decoded.sheetPreset) setSheetPreset(decoded.sheetPreset);
      if (decoded.dpi) setDpi(decoded.dpi);
      if (decoded.unit) setUnit(decoded.unit);
    } catch (err) {
      console.warn("Invalid share payload", err);
    }
    // eslint-disable-next-line
  }, []);

  /* ---------------- UI helpers ---------------- */
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const usedArea = items.reduce((acc, it) => acc + it.w * it.h * it.scale * it.scale, 0);
  const sheetArea = sheetPxW * sheetPxH;

  /* ---------------- Render ---------------- */
  return (
    <>
      <Navigation
        onExport={(fmt) => exportAs(fmt)}
        onSave={() => saveProject()}
        onLoad={() => loadProject()}
        onNewSheet={() => {
          setItems([]);
          setSelectedId(null);
        }}
        onUpload={() => fileInputRef.current && fileInputRef.current.click()}
        onAutoArrange={() => applyAutoLayout(autoLayoutMode)}
        onUndo={() => console.log("Undo - not implemented")}
        onRedo={() => console.log("Redo - not implemented")}
      />

      <div className="p-6 min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-6">
          {/* Left: Controls */}
          <aside className="col-span-1 bg-white p-4 rounded-xl shadow">
            <h2 className="text-xl font-semibold mb-2">Gangsheet Builder</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload designs, auto-layout, adjust precisely, then export print-ready gangsheets.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Upload</label>
              <div className="mt-2">
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleUploadFromInput} className="mt-1" />
                <div className="flex gap-2 mt-2">
                  <button type="button" className="flex-1 p-2 bg-indigo-600 text-white rounded" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                    Pick files
                  </button>
                  <button type="button" className="flex-1 p-2 border rounded" onClick={() => { setItems([]); setSelectedId(null); }}>
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Sheet Preset</label>
              <select className="w-full mt-2 p-2 border rounded" value={sheetPreset.id} onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) { setSheetPreset(p); setUnit(p.unit); } }}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>

              <div className="flex gap-2 mt-2">
                <input type="number" value={sheetPreset.w} onChange={(e) => setSheetPreset({ ...sheetPreset, w: +e.target.value })} className="w-1/2 p-2 border rounded" />
                <input type="number" value={sheetPreset.h} onChange={(e) => setSheetPreset({ ...sheetPreset, h: +e.target.value })} className="w-1/2 p-2 border rounded" />
              </div>

              <div className="flex gap-2 mt-2">
                <select value={sheetPreset.unit} onChange={(e) => setSheetPreset({ ...sheetPreset, unit: e.target.value })} className="p-2 border rounded">
                  <option value="in">in</option>
                  <option value="cm">cm</option>
                  <option value="px">px</option>
                </select>
                <input type="number" value={dpi} onChange={(e) => setDpi(+e.target.value)} className="p-2 border rounded w-full" />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Auto-layout</label>
              <select value={autoLayoutMode} onChange={(e) => setAutoLayoutMode(e.target.value)} className="w-full p-2 border rounded mt-2">
                <option value="free">Freeform</option>
                <option value="grid">Grid</option>
                <option value="compact">Compact Fit</option>
                <option value="smart">Smart Pack</option>
              </select>
              <div className="flex gap-2 mt-2">
                <button type="button" className="flex-1 p-2 bg-indigo-600 text-white rounded" onClick={() => applyAutoLayout(autoLayoutMode)}>Apply</button>
                <button type="button" className="flex-1 p-2 border rounded" onClick={() => { setItems([]); setSelectedId(null); }}>Clear</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Canvas</label>
              <div className="flex gap-2 mt-2 items-center">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-12 h-10 p-0 border rounded" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
                  Transparent
                </label>
              </div>

              <label className="flex items-center gap-2 mt-2 text-sm">
                <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
                Snap to grid
              </label>

              <div className="mt-2">
                <label className="text-xs">Grid size (px)</label>
                <input type="range" min={2} max={64} value={gridSize} onChange={(e) => setGridSize(+e.target.value)} className="w-full" />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Export</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button type="button" className="p-2 bg-green-600 text-white rounded" onClick={() => exportAs("png")}>PNG</button>
                <button type="button" className="p-2 bg-rose-600 text-white rounded" onClick={() => exportAs("svg")}>SVG</button>
                <button type="button" className="p-2 border rounded" onClick={() => exportAs("pdf")}>PDF</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600">Project</label>
              <div className="flex gap-2 mt-2">
                <button type="button" className="p-2 border rounded" onClick={() => saveProject("autosave")}>Save</button>
                <button type="button" className="p-2 border rounded" onClick={() => loadProject("autosave")}>Load</button>
                <button type="button" className="p-2 border rounded" onClick={copyShareableLink}>Share</button>
              </div>
            </div>

            <div className="text-xs text-gray-500">Used: {(usedArea / sheetArea * 100).toFixed(2)}% • Items: {items.length}</div>
          </aside>

          {/* Center: Canvas */}
          <main className="col-span-2 bg-white p-4 rounded-xl shadow flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">Canvas Preview</h3>
                <div className="text-xs text-gray-500">Real-time preview — drag items to reposition. DPI: {dpi}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs">Zoom</label>
                <input type="range" min={0.2} max={1.6} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
                <div className="text-xs w-12 text-right">{Math.round(zoom * 100)}%</div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto">
              <div
                ref={sheetRef}
                style={{
                  width: sheetPxW * zoom,
                  height: sheetPxH * zoom,
                  background: transparent ? "transparent" : bgColor,
                }}
                className="relative border rounded shadow-sm"
              >
                {/* grid overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: Math.max(1, Math.floor(sheetPxW / gridSize)) }).map((_, i) => (
                    <div key={`v${i}`} style={{ position: "absolute", left: i * gridSize * zoom, top: 0, bottom: 0, width: i % 5 === 0 ? 1.2 : 0.6, background: i % 5 === 0 ? "rgba(2,6,23,0.04)" : "rgba(2,6,23,0.02)" }} />
                  ))}
                  {Array.from({ length: Math.max(1, Math.floor(sheetPxH / gridSize)) }).map((_, i) => (
                    <div key={`h${i}`} style={{ position: "absolute", top: i * gridSize * zoom, left: 0, right: 0, height: i % 5 === 0 ? 1.2 : 0.6, background: i % 5 === 0 ? "rgba(2,6,23,0.04)" : "rgba(2,6,23,0.02)" }} />
                  ))}
                </div>

                {/* items */}
                {items.map((it) => {
                  const w = Math.max(12, it.w * it.scale * zoom);
                  const h = Math.max(12, it.h * it.scale * zoom);
                  const left = it.x * zoom;
                  const top = it.y * zoom;
                  const transform = `rotate(${it.rot}deg)`;
                  return (
                    <div
                      key={it.id}
                      data-item-id={it.id}
                      onClick={() => setSelectedId(it.id)}
                      onPointerDown={(e) => startDrag(e, it.id)}
                      className={`absolute ${selectedId === it.id ? "ring-2 ring-blue-300" : ""}`}
                      style={{
                        left,
                        top,
                        width: w,
                        height: h,
                        transform,
                        transformOrigin: "center center",
                        cursor: "grab",
                        transition: "box-shadow 120ms, transform 120ms",
                        touchAction: "none" // important for touch dragging
                      }}
                    >
                      <img src={it.src} alt={it.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 6 }} />

                      {/* action toolbar (data-nodrag prevents pointerdown from starting drag) */}
                      {selectedId === it.id && (
                        <div data-nodrag style={{ position: "absolute", right: -10, top: -10 }} className="bg-white rounded p-1 shadow flex gap-1">
                          <button type="button" className="text-xs px-2 hover:bg-gray-100 rounded" onClick={(e) => { e.stopPropagation(); duplicateItem(it.id); }}>
                            Dup
                          </button>
                          <button type="button" className="text-xs px-2 hover:bg-gray-100 rounded" onClick={(e) => { e.stopPropagation(); autofillItem(it.id); }}>
                            Autofill
                          </button>
                          <button type="button" className="text-xs px-2 text-red-600 hover:bg-gray-100 rounded" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}>
                            Del
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </main>

          {/* Right: Inspector */}
          <aside className="col-span-1 bg-white p-4 rounded-xl shadow">
            <h4 className="font-semibold">Inspector</h4>
            {!selected && <div className="text-sm text-gray-500 mt-2">Select an item to edit its properties</div>}
            {selected && (
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <label className="text-xs text-gray-600">Name</label>
                  <input value={selected.name} onChange={(e) => updateItem(selected.id, { name: e.target.value })} className="w-full p-2 border rounded" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">X ({unit})</label>
                    <input type="number" value={fromPx(selected.x, unit)} onChange={(e) => updateItem(selected.id, { x: toPx(+e.target.value, unit) })} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Y ({unit})</label>
                    <input type="number" value={fromPx(selected.y, unit)} onChange={(e) => updateItem(selected.id, { y: toPx(+e.target.value, unit) })} className="w-full p-2 border rounded" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">Angle</label>
                    <input type="number" value={selected.rot} onChange={(e) => updateItem(selected.id, { rot: +e.target.value })} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Scale</label>
                    <input type="range" min={0.05} max={2} step={0.01} value={selected.scale} onChange={(e) => updateItem(selected.id, { scale: +e.target.value })} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Opacity</label>
                    <input type="range" min={0.1} max={1} step={0.05} defaultValue={1} className="w-full" onChange={() => {}} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" className="flex-1 p-2 bg-indigo-600 text-white rounded" onClick={() => duplicateItem(selected.id)}>Duplicate</button>
                  <button type="button" className="flex-1 p-2 border rounded" onClick={() => autofillItem(selected.id)}>Autofill</button>
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="max-w-7xl mx-auto mt-6 text-sm text-gray-500">
          Tip: For best export results install <code>html2canvas</code> and <code>jspdf</code> to enable high-quality PNG/PDF exports.
        </div>
      </div>
    </>
  );
}
