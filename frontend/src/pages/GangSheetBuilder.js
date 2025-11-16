import React, { useEffect, useRef, useState } from "react";

/*
  GangsheetBuilder.js
  Plain JavaScript React component (no TypeScript).
  - Upload & manage multiple images
  - Auto-layout modes (Grid, Compact, Smart)
  - Drag to move items (pointer events)
  - Numeric inspector for precise control
  - Export to PNG (html2canvas) or SVG fallback
  - Save/load via localStorage, shareable encoded state
  - Uses Tailwind classes for styling (replace if not using Tailwind)
*/

// --- Helpers
const PRESETS = [
  { id: "22x24", label: "22 x 24 in", w: 22, h: 24, unit: "in" },
  { id: "22x60", label: "22 x 60 in", w: 22, h: 60, unit: "in" },
  { id: "22x120", label: "22 x 120 in", w: 22, h: 120, unit: "in" },
  { id: "A3", label: "A3 (420 x 297 mm)", w: 29.7, h: 42, unit: "cm" },
  { id: "A4", label: "A4 (210 x 297 mm)", w: 21, h: 29.7, unit: "cm" },
];

function toPx(value, unit, dpi = 96) {
  if (unit === "px") return value;
  if (unit === "in") return Math.round(value * dpi);
  return Math.round((value / 2.54) * dpi);
}
function fromPx(px, unit, dpi = 96) {
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
  // sheet settings
  const [sheetPreset, setSheetPreset] = useState(PRESETS[0]);
  const [unit, setUnit] = useState(PRESETS[0].unit);
  const [dpi, setDpi] = useState(300);
  const [scale, setScale] = useState(0.8); // view zoom
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [transparent, setTransparent] = useState(false);
  const [autoLayoutMode, setAutoLayoutMode] = useState("smart");

  // items
  const [items, setItems] = useState([]); // each: {id,name,src,w,h,x,y,rot,scale,visible}
  const [selectedId, setSelectedId] = useState(null);

  const sheetRef = useRef(null);

  // on-screen sheet pixel size uses 96dpi
  const sheetPxW = toPx(sheetPreset.w, sheetPreset.unit, 96);
  const sheetPxH = toPx(sheetPreset.h, sheetPreset.unit, 96);

  // --- Upload handler ---
  async function handleUpload(e) {
    const files = e.target.files;
    if (!files) return;
    const arr = Array.from(files);
    for (const f of arr) {
      const data = await readFileAsDataURL(f);
      const img = await loadImage(data);
      const id = uid();
      const baseScale = Math.min(0.5, sheetPxW / (img.width * 4));
      const item = {
        id,
        name: f.name,
        src: data,
        w: img.width,
        h: img.height,
        x: 20,
        y: 20,
        rot: 0,
        scale: baseScale,
        visible: true,
      };
      setItems((s) => [...s, item]);
    }
    e.currentTarget.value = "";
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

  // --- Item ops ---
  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateItem(id, copies = 1) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const dupes = [];
    for (let i = 0; i < copies; i++) {
      dupes.push({ ...deepClone(it), id: uid(), x: it.x + 10 * (i + 1), y: it.y + 10 * (i + 1) });
    }
    setItems((s) => [...s, ...dupes]);
  }
  function autofillItem(id) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    const cellW = it.w * it.scale;
    const cellH = it.h * it.scale;
    const cols = Math.floor(sheetPxW / cellW) || 1;
    const rows = Math.floor(sheetPxH / cellH) || 1;
    const newItems = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        newItems.push({ ...deepClone(it), id: uid(), x: c * cellW + 2, y: r * cellH + 2 });
      }
    }
    setItems((s) => [...s, ...newItems]);
  }

  // --- Auto-layout ---
  function applyAutoLayout(mode) {
    if (mode === "free") return;
    if (mode === "grid") {
      const margin = 10;
      const cols = Math.ceil(Math.sqrt(items.length || 1));
      const cellW = Math.max(50, Math.floor((sheetPxW - margin * 2) / cols));
      const cellH = Math.max(50, cellW);
      setItems((prev) => prev.map((it, idx) => ({ ...it, x: margin + (idx % cols) * cellW, y: margin + Math.floor(idx / cols) * cellH, scale: Math.min(1, cellW / it.w) })));
      return;
    }
    if (mode === "compact") {
      let x = 8;
      let y = 8;
      let rowH = 0;
      const placed = items.map((it) => {
        const scaleVal = Math.min(1, (sheetPxW - 16) / (it.w * 4));
        const w = it.w * scaleVal;
        const h = it.h * scaleVal;
        if (x + w > sheetPxW - 8) {
          x = 8;
          y += rowH + 8;
          rowH = 0;
        }
        const out = { ...it, x, y, scale: scaleVal };
        x += w + 8;
        rowH = Math.max(rowH, h);
        return out;
      });
      setItems(placed);
      return;
    }
    if (mode === "smart") {
      const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
      let x = 8,
        y = 8,
        rowH = 0;
      const placed = [];
      for (const it of sorted) {
        let s = Math.min(1, (sheetPxW - 16) / it.w);
        let w = it.w * s;
        let h = it.h * s;
        if (x + w > sheetPxW - 8) {
          x = 8;
          y += rowH + 8;
          rowH = 0;
        }
        if (y + h > sheetPxH - 8) {
          s = Math.min(s, (sheetPxH - y - 8) / it.h);
          w = it.w * s;
          h = it.h * s;
        }
        placed.push({ ...it, x, y, scale: s });
        x += w + 8;
        rowH = Math.max(rowH, h);
      }
      const placedById = new Map(placed.map((p) => [p.id, p]));
      setItems((prev) => prev.map((it) => placedById.get(it.id) ?? it));
    }
  }

  // --- Dragging with Pointer Events ---
  useEffect(() => {
    let dragId = null;
    let offset = { x: 0, y: 0 };
    function onPointerDown(e) {
      const target = e.target;
      if (!target) return;
      const itemEl = target.closest && target.closest("[data-item-id]");
      if (!itemEl) return;
      dragId = itemEl.dataset.itemId;
      if (!dragId) return;
      const rect = itemEl.getBoundingClientRect();
      offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      document.body.style.userSelect = "none";
    }
    function onPointerMove(e) {
      if (!dragId) return;
      const sheetRect = sheetRef.current && sheetRef.current.getBoundingClientRect();
      if (!sheetRect) return;
      let nx = e.clientX - sheetRect.left - offset.x;
      let ny = e.clientY - sheetRect.top - offset.y;
      if (snapToGrid) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }
      updateItem(dragId, { x: Math.max(0, nx), y: Math.max(0, ny) });
    }
    function onPointerUp() {
      dragId = null;
      document.body.style.userSelect = "auto";
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [snapToGrid, gridSize, items]);

  // --- Export PNG / SVG ---
  async function exportAsPNG() {
    if (!sheetRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = sheetRef.current;
      const scaleFactor = dpi / 96;
      const canvas = await html2canvas(el, { scale: scaleFactor, backgroundColor: transparent ? null : bgColor });
      const dataUrl = canvas.toDataURL("image/png");
      downloadDataUrl(dataUrl, `gangsheet-${Date.now()}.png`);
    } catch (err) {
      console.error(err);
      const svg = serializeToSVG();
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      downloadUrl(url, `gangsheet-${Date.now()}.svg`);
    }
  }

  function serializeToSVG() {
    const w = toPx(sheetPreset.w, sheetPreset.unit, dpi);
    const h = toPx(sheetPreset.h, sheetPreset.unit, dpi);
    const bg = transparent ? "none" : bgColor;
    const parts = [`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`];
    if (!transparent) parts.push(`<rect width='100%' height='100%' fill='${bg}' />`);
    for (const it of items) {
      const x = Math.round((it.x / sheetPxW) * w);
      const y = Math.round((it.y / sheetPxH) * h);
      const iw = Math.round((it.w * it.scale / sheetPxW) * w);
      const ih = Math.round((it.h * it.scale / sheetPxH) * h);
      const transform = `translate(${x + iw / 2} ${y + ih / 2}) rotate(${it.rot}) translate(${-iw / 2} ${-ih / 2})`;
      parts.push(`<image transform='${transform}' width='${iw}' height='${ih}' href='${it.src}' preserveAspectRatio='xMidYMid meet' />`);
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

  // --- Save / Load / Share ---
  function saveProject(name = "project") {
    const state = { items, sheetPreset, dpi, unit };
    localStorage.setItem(`gangsheet-${name}`, JSON.stringify(state));
    alert("Saved");
  }
  function loadProject(name = "project") {
    const raw = localStorage.getItem(`gangsheet-${name}`);
    if (!raw) return alert("No saved project found");
    const parsed = JSON.parse(raw);
    setItems(parsed.items || []);
    setSheetPreset(parsed.sheetPreset || PRESETS[0]);
    setDpi(parsed.dpi || 300);
  }
  function shareableLink() {
    const state = { items, sheetPreset, dpi };
    const enc = encodeURIComponent(btoa(JSON.stringify(state)));
    const link = `${location.origin}${location.pathname}?gang=${enc}`;
    navigator.clipboard?.writeText(link);
    alert("Shareable link copied to clipboard");
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const enc = params.get("gang");
    if (!enc) return;
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(enc)));
      if (decoded.items) setItems(decoded.items);
      if (decoded.sheetPreset) setSheetPreset(decoded.sheetPreset);
      if (decoded.dpi) setDpi(decoded.dpi);
    } catch (err) {
      console.warn("Invalid share payload");
    }
  }, []);

  // UI helpers
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const usedArea = items.reduce((acc, it) => acc + (it.w * it.h * it.scale * it.scale), 0);
  const sheetArea = sheetPxW * sheetPxH;

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-6">
        {/* Left: Controls */}
        <aside className="col-span-1 bg-white p-4 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-2">Gangsheet Builder</h2>
          <p className="text-sm text-gray-600 mb-4">Upload designs, auto-layout, adjust precisely, then export print-ready gangsheets.</p>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600">Upload</label>
            <input type="file" accept="image/*,.pdf" multiple onChange={handleUpload} className="mt-2" />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600">Sheet Preset</label>
            <select className="w-full mt-2 p-2 border rounded" value={sheetPreset.id} onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) { setSheetPreset(p); setUnit(p.unit); } }}>
              {PRESETS.map((p) => (
                <option value={p.id} key={p.id}>{p.label}</option>
              ))}
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
              <button className="flex-1 btn p-2 bg-indigo-600 text-white rounded" onClick={() => applyAutoLayout(autoLayoutMode)}>Apply</button>
              <button className="flex-1 p-2 border rounded" onClick={() => setItems([])}>Clear</button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600">Canvas</label>
            <div className="flex gap-2 mt-2">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-12 h-10 p-0 border rounded" />
              <label className="flex items-center gap-2"><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent</label>
            </div>
            <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} /> Snap to grid</label>
            <div className="mt-2">
              <label className="text-xs">Grid size (px)</label>
              <input type="range" min={2} max={64} value={gridSize} onChange={(e) => setGridSize(+e.target.value)} className="w-full" />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600">Export</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button className="p-2 bg-green-600 text-white rounded" onClick={exportAsPNG}>PNG</button>
              <button className="p-2 bg-rose-600 text-white rounded" onClick={() => { const svg = serializeToSVG(); downloadDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, `gangsheet-${Date.now()}.svg`); }}>SVG</button>
              <button className="p-2 border rounded" onClick={() => exportAsPNG()}>Export (PNG)</button>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600">Project</label>
            <div className="flex gap-2 mt-2">
              <button className="p-2 border rounded" onClick={() => saveProject("autosave")}>Save</button>
              <button className="p-2 border rounded" onClick={() => loadProject("autosave")}>Load</button>
              <button className="p-2 border rounded" onClick={shareableLink}>Share</button>
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
              <input type="range" min={0.2} max={1.6} step={0.05} value={scale} onChange={(e) => setScale(+e.target.value)} />
              <div className="text-xs w-12 text-right">{Math.round(scale * 100)}%</div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto">
            <div
              ref={sheetRef}
              style={{ width: sheetPxW * scale, height: sheetPxH * scale, background: transparent ? "transparent" : bgColor }}
              className="relative border rounded shadow-sm"
            >
              {/* grid overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: Math.floor(sheetPxW / gridSize) }).map((_, i) => (
                  <div key={i} style={{ position: "absolute", left: i * gridSize * scale, top: 0, bottom: 0, width: 1, background: i % 5 === 0 ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.02)" }} />
                ))}
                {Array.from({ length: Math.floor(sheetPxH / gridSize) }).map((_, i) => (
                  <div key={"r" + i} style={{ position: "absolute", top: i * gridSize * scale, left: 0, right: 0, height: 1, background: i % 5 === 0 ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.02)" }} />
                ))}
              </div>

              {/* items */}
              {items.map((it) => {
                const w = it.w * it.scale * scale;
                const h = it.h * it.scale * scale;
                const left = it.x * scale;
                const top = it.y * scale;
                const transform = `rotate(${it.rot}deg)`;
                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className="absolute"
                    style={{ left, top, width: w, height: h, transform, transformOrigin: "center center", cursor: "grab" }}
                  >
                    <img src={it.src} alt={it.name} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                    {selectedId === it.id && (
                      <div className="absolute -right-2 -top-2 bg-white p-1 rounded shadow text-xs">
                        <button className="text-xs" onClick={() => duplicateItem(it.id, 1)}>Dup</button>
                        <button className="ml-2 text-xs" onClick={() => autofillItem(it.id)}>Autofill</button>
                        <button className="ml-2 text-xs text-red-600" onClick={() => removeItem(it.id)}>Del</button>
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
                  <input type="number" value={fromPx(selected.x, unit, 96)} onChange={(e) => updateItem(selected.id, { x: toPx(+e.target.value, unit, 96) })} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Y ({unit})</label>
                  <input type="number" value={fromPx(selected.y, unit, 96)} onChange={(e) => updateItem(selected.id, { y: toPx(+e.target.value, unit, 96) })} className="w-full p-2 border rounded" />
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
                  <input type="range" min={0.1} max={1} step={0.05} defaultValue={1} className="w-full" />
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 p-2 bg-indigo-600 text-white rounded" onClick={() => duplicateItem(selected.id)}>Duplicate</button>
                <button className="flex-1 p-2 border rounded" onClick={() => autofillItem(selected.id)}>Autofill</button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="max-w-7xl mx-auto mt-6 text-sm text-gray-500">Tip: For best export results install <code>html2canvas</code> and <code>jspdf</code> to enable high-quality PNG/PDF exports.</div>
    </div>
  );
}
