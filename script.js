// ========== STATE ==========
const state = {
  elements: [], connections: [], nextId: 1,
  tool: 'select', selected: null, dragging: null,
  dragOffX: 0, dragOffY: 0, panX: 0, panY: 0,
  zoom: 1, isPanning: false, panStartX: 0, panStartY: 0,
  connectFrom: null, snap: true, history: [], historyIdx: -1
};

const svg = document.getElementById('diagramCanvas');
const elLayer = document.getElementById('elements-layer');
const connLayer = document.getElementById('connections-layer');
const emptyState = document.getElementById('empty-state');
const entityList = document.getElementById('entity-list');
const toastC = document.getElementById('toast-container');

// ========== TOAST ==========
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  toastC.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ========== SAVE/RESTORE HISTORY ==========
function saveHistory() {
  state.history = state.history.slice(0, state.historyIdx + 1);
  state.history.push(JSON.stringify({ elements: state.elements, connections: state.connections, nextId: state.nextId }));
  state.historyIdx = state.history.length - 1;
}

function restoreHistory(idx) {
  const snap = JSON.parse(state.history[idx]);
  state.elements = snap.elements;
  state.connections = snap.connections;
  state.nextId = snap.nextId;
  state.historyIdx = idx;
  state.selected = null;
  renderAll();
}

// ========== SVG HELPERS ==========
function ns(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function setA(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function snapV(v) { return state.snap ? Math.round(v / 30) * 30 : v; }

function screenToSvg(cx, cy) {
  const r = svg.parentElement.getBoundingClientRect();
  return { x: (cx - r.left - state.panX) / state.zoom, y: (cy - r.top - state.panY) / state.zoom };
}

// ========== RENDER ALL ==========
function renderAll() {
  elLayer.innerHTML = '';
  connLayer.innerHTML = '';
  state.connections.forEach(drawConnection);
  state.elements.forEach(drawElement);
  updateSidebar();
  updateStatus();
  if (state.elements.length > 0) emptyState.style.display = 'none';
  else emptyState.style.display = '';
  svg.setAttribute('transform', `translate(${state.panX},${state.panY}) scale(${state.zoom})`);
}

// ========== DRAW ELEMENT ==========
function drawElement(el) {
  const g = ns('g');
  g.id = 'el-' + el.id;
  g.dataset.id = el.id;
  g.classList.add('er-' + el.type + '-group');
  if (state.selected === el.id) g.classList.add('selected');

  if (el.type === 'entity' || el.type === 'weak-entity') {
    const w = el.w || 160, headerH = 32;
    const attrs = el.attributes || [];
    const h = headerH + Math.max(attrs.length, 1) * 24 + 8;
    el.h = h;

    if (el.type === 'weak-entity') {
      const outer = setA(ns('rect'), { x: el.x - 4, y: el.y - 4, width: w + 8, height: h + 8, rx: 8, fill: 'none', stroke: '#4d7cfe', 'stroke-width': 1, 'stroke-dasharray': '5,3' });
      g.appendChild(outer);
    }

    g.appendChild(setA(ns('rect'), { x: el.x, y: el.y, width: w, height: h, rx: 8, class: 'entity-rect' }));
    g.appendChild(setA(ns('rect'), { x: el.x, y: el.y, width: w, height: headerH, rx: 8, class: 'entity-header-rect' }));
    g.appendChild(setA(ns('rect'), { x: el.x, y: el.y + headerH - 8, width: w, height: 8, class: 'entity-header-mask' }));

    const title = setA(ns('text'), { x: el.x + w / 2, y: el.y + 21, class: 'entity-name-text' });
    title.textContent = el.name;
    g.appendChild(title);

    attrs.forEach((a, i) => {
      const ay = el.y + headerH + 8 + i * 24;
      if (i > 0) g.appendChild(setA(ns('line'), { x1: el.x + 8, y1: ay - 4, x2: el.x + w - 8, y2: ay - 4, class: 'entity-attr-line' }));
      const isPK = el.primaryKey === a;
      if (isPK) {
        const keyIcon = setA(ns('text'), { x: el.x + 14, y: ay + 12, class: 'entity-pk-icon' });
        keyIcon.textContent = '🔑';
        g.appendChild(keyIcon);
      }
      const txt = setA(ns('text'), { x: el.x + (isPK ? 30 : 14), y: ay + 12, class: 'entity-attr-text' + (isPK ? ' entity-attr-pk' : '') });
      txt.textContent = a;
      if (isPK) {
        const dec = setA(ns('line'), { x1: el.x + 30, y1: ay + 14, x2: el.x + 30 + a.length * 6.5, y2: ay + 14, stroke: '#4d7cfe', 'stroke-width': 1 });
        g.appendChild(dec);
      }
      g.appendChild(txt);
    });
  } else if (el.type === 'relationship') {
    const hw = (el.w || 120) / 2, hh = (el.rh || 50) / 2;
    const cx = el.x + hw, cy = el.y + hh;
    const pts = `${cx},${el.y} ${el.x + el.w},${cy} ${cx},${el.y + el.rh} ${el.x},${cy}`;
    g.appendChild(setA(ns('polygon'), { points: pts, class: 'relationship-diamond' }));
    const txt = setA(ns('text'), { x: cx, y: cy + 4, class: 'relationship-text' });
    txt.textContent = el.name;
    g.appendChild(txt);
  } else if (el.type === 'attribute') {
    const rx = (el.w || 70) / 2, ry = 20;
    el.rh = ry * 2;
    const cx = el.x + rx, cy = el.y + ry;
    g.appendChild(setA(ns('ellipse'), { cx, cy, rx, ry, fill: '#f5f0ff', stroke: '#8b5cf6', 'stroke-width': 1.5 }));
    const txt = setA(ns('text'), { x: cx, y: cy + 4, fill: '#1a1d23', 'font-family': 'Inter,sans-serif', 'font-size': 11, 'text-anchor': 'middle' });
    txt.textContent = el.name;
    g.appendChild(txt);
  }

  g.addEventListener('mousedown', e => onElementMouseDown(e, el));
  g.addEventListener('dblclick', () => openEditModal(el));
  g.addEventListener('contextmenu', e => onContextMenu(e, el));
  elLayer.appendChild(g);
}

// ========== DRAW CONNECTION ==========
function drawConnection(conn) {
  const from = state.elements.find(e => e.id === conn.from);
  const to = state.elements.find(e => e.id === conn.to);
  if (!from || !to) return;
  const p1 = getCenter(from), p2 = getCenter(to);
  const line = setA(ns('line'), { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'er-connection', 'data-conn-id': conn.id, stroke: '#9ba1ad' });

  // Cardinality labels
  const g = ns('g');
  g.appendChild(line);
  if (conn.cardFrom) {
    const t = setA(ns('text'), { x: p1.x + (p2.x - p1.x) * 0.2, y: p1.y + (p2.y - p1.y) * 0.2 - 8, class: 'cardinality-text' });
    t.textContent = conn.cardFrom;
    g.appendChild(t);
  }
  if (conn.cardTo) {
    const t = setA(ns('text'), { x: p1.x + (p2.x - p1.x) * 0.8, y: p1.y + (p2.y - p1.y) * 0.8 - 8, class: 'cardinality-text' });
    t.textContent = conn.cardTo;
    g.appendChild(t);
  }
  line.addEventListener('dblclick', () => editConnection(conn));
  line.addEventListener('contextmenu', e => { e.preventDefault(); if (confirm('Delete this connection?')) { state.connections = state.connections.filter(c => c.id !== conn.id); saveHistory(); renderAll(); } });
  connLayer.appendChild(g);
}

function getCenter(el) {
  const w = el.w || 160, h = el.h || el.rh || 50;
  if (el.type === 'attribute') return { x: el.x + (el.w || 70) / 2, y: el.y + 20 };
  return { x: el.x + w / 2, y: el.y + h / 2 };
}

// ========== SIDEBAR ==========
function updateSidebar() {
  entityList.innerHTML = '';
  state.elements.forEach(el => {
    const div = document.createElement('div');
    div.className = 'entity-list-item';
    div.innerHTML = `<span class="name">${el.name}</span><span class="badge">${el.type}</span><button class="delete-btn" title="Delete">✕</button>`;
    div.querySelector('.delete-btn').onclick = e => { e.stopPropagation(); deleteElement(el.id); };
    div.onclick = () => { state.selected = el.id; renderAll(); };
    entityList.appendChild(div);
  });
}

function updateStatus() {
  document.getElementById('element-count').textContent = state.elements.length + ' elements';
  document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
}

// ========== ADD ELEMENTS ==========
function addEntity(x, y, name) {
  const el = { id: state.nextId++, type: 'entity', x: snapV(x), y: snapV(y), w: 160, h: 80, name: name || 'Entity', attributes: ['id', 'name'], primaryKey: 'id' };
  state.elements.push(el);
  saveHistory(); renderAll();
  toast('Entity added', 'success');
  return el;
}

function addWeakEntity(x, y) {
  const el = { id: state.nextId++, type: 'weak-entity', x: snapV(x), y: snapV(y), w: 160, h: 80, name: 'WeakEntity', attributes: ['id'], primaryKey: 'id' };
  state.elements.push(el);
  saveHistory(); renderAll();
  toast('Weak Entity added', 'success');
}

function addRelationship(x, y, name) {
  const el = { id: state.nextId++, type: 'relationship', x: snapV(x), y: snapV(y), w: 120, rh: 60, name: name || 'relates' };
  state.elements.push(el);
  saveHistory(); renderAll();
  toast('Relationship added', 'success');
}

function addAttribute(x, y, name) {
  const el = { id: state.nextId++, type: 'attribute', x: snapV(x), y: snapV(y), w: 80, rh: 40, name: name || 'attr' };
  state.elements.push(el);
  saveHistory(); renderAll();
  toast('Attribute added', 'success');
}

function deleteElement(id) {
  state.elements = state.elements.filter(e => e.id !== id);
  state.connections = state.connections.filter(c => c.from !== id && c.to !== id);
  if (state.selected === id) state.selected = null;
  saveHistory(); renderAll();
  toast('Deleted', 'error');
}

// ========== DRAG & DROP FROM SIDEBAR ==========
document.querySelectorAll('.shape-item').forEach(item => {
  item.addEventListener('dragstart', e => { e.dataTransfer.setData('shape', item.dataset.shape); });
});

const canvasContainer = document.getElementById('canvas-container');
canvasContainer.addEventListener('dragover', e => e.preventDefault());
canvasContainer.addEventListener('drop', e => {
  e.preventDefault();
  const shape = e.dataTransfer.getData('shape');
  const pos = screenToSvg(e.clientX, e.clientY);
  if (shape === 'entity') addEntity(pos.x - 80, pos.y - 40);
  else if (shape === 'weak-entity') addWeakEntity(pos.x - 80, pos.y - 40);
  else if (shape === 'relationship') addRelationship(pos.x - 60, pos.y - 30);
  else if (shape === 'attribute') addAttribute(pos.x - 40, pos.y - 20);
});

// ========== ELEMENT MOUSE HANDLERS ==========
function onElementMouseDown(e, el) {
  e.stopPropagation();
  if (state.tool === 'connect') {
    if (!state.connectFrom) {
      state.connectFrom = el.id;
      toast('Click another element to connect', 'info');
    } else if (state.connectFrom !== el.id) {
      state.connections.push({ id: state.nextId++, from: state.connectFrom, to: el.id, cardFrom: '1', cardTo: 'N' });
      state.connectFrom = null;
      saveHistory(); renderAll();
      toast('Connected!', 'success');
    }
    return;
  }
  state.selected = el.id;
  state.dragging = el;
  const pos = screenToSvg(e.clientX, e.clientY);
  state.dragOffX = pos.x - el.x;
  state.dragOffY = pos.y - el.y;
  renderAll();
}

// ========== CANVAS MOUSE ==========
canvasContainer.addEventListener('mousedown', e => {
  // Check if click is on an ER element (entity, relationship, etc.) - if so, skip
  const clickedEl = e.target.closest('.er-entity-group, .er-weak-entity-group, .er-relationship-group, .er-attribute-group');
  if (clickedEl) return;

  if (state.tool === 'entity') {
    const p = screenToSvg(e.clientX, e.clientY);
    addEntity(p.x - 80, p.y - 40);
    return;
  } else if (state.tool === 'relationship') {
    const p = screenToSvg(e.clientX, e.clientY);
    addRelationship(p.x - 60, p.y - 30);
    return;
  }

  state.selected = null;
  state.isPanning = true;
  state.panStartX = e.clientX - state.panX;
  state.panStartY = e.clientY - state.panY;
  svg.classList.add('grabbing');
  renderAll();
});

window.addEventListener('mousemove', e => {
  const pos = screenToSvg(e.clientX, e.clientY);
  document.getElementById('cursor-pos').textContent = `X: ${Math.round(pos.x)}  Y: ${Math.round(pos.y)}`;

  if (state.dragging) {
    state.dragging.x = snapV(pos.x - state.dragOffX);
    state.dragging.y = snapV(pos.y - state.dragOffY);
    renderAll();
  } else if (state.isPanning) {
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    svg.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  }
});

window.addEventListener('mouseup', () => {
  if (state.dragging) { saveHistory(); }
  state.dragging = null;
  state.isPanning = false;
  svg.classList.remove('grabbing');
});

// ========== ZOOM ==========
canvasContainer.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.08 : 0.08;
  state.zoom = Math.max(0.2, Math.min(3, state.zoom + delta));
  svg.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  updateStatus();
}, { passive: false });

document.getElementById('zoom-in').onclick = () => { state.zoom = Math.min(3, state.zoom + 0.15); svg.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`; updateStatus(); };
document.getElementById('zoom-out').onclick = () => { state.zoom = Math.max(0.2, state.zoom - 0.15); svg.style.transform = `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`; updateStatus(); };
document.getElementById('zoom-fit').onclick = () => { state.zoom = 1; state.panX = 0; state.panY = 0; svg.style.transform = ''; updateStatus(); };

// ========== MODALS ==========
function openEditModal(el) {
  closeAnyModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const isEntity = el.type === 'entity' || el.type === 'weak-entity';

  let attrsHTML = '';
  if (isEntity) {
    attrsHTML = `
      <label>Attributes</label>
      <div class="attr-tags" id="modal-attrs">${(el.attributes || []).map(a =>
        `<span class="attr-tag ${a === el.primaryKey ? 'pk' : ''}">${a}${a === el.primaryKey ? ' 🔑' : ''}<button class="remove-attr" data-a="${a}">×</button></span>`
      ).join('')}</div>
      <div class="add-attr-row">
        <input type="text" id="new-attr-input" placeholder="New attribute...">
        <label class="pk-checkbox"><input type="checkbox" id="new-attr-pk"> PK</label>
        <button id="add-attr-btn">Add</button>
      </div>`;
  }

  let cardHTML = '';
  if (el.type === 'relationship') {
    cardHTML = '';
  }

  overlay.innerHTML = `<div class="modal">
    <h2>${el.type === 'relationship' ? '◆' : '▢'} Edit ${el.type}</h2>
    <label>Name</label>
    <input type="text" id="modal-name" value="${el.name}">
    ${attrsHTML}
    ${cardHTML}
    <div class="btn-row">
      <button class="btn-danger" id="modal-delete">Delete</button>
      <button class="btn-cancel" id="modal-cancel">Cancel</button>
      <button class="btn-save" id="modal-save">Save</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Attach events
  overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#modal-delete').onclick = () => { deleteElement(el.id); overlay.remove(); };
  overlay.querySelector('#modal-save').onclick = () => {
    el.name = overlay.querySelector('#modal-name').value || el.name;
    saveHistory(); renderAll(); overlay.remove();
    toast('Updated!', 'success');
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  if (isEntity) {
    overlay.querySelectorAll('.remove-attr').forEach(btn => {
      btn.onclick = () => {
        el.attributes = el.attributes.filter(a => a !== btn.dataset.a);
        if (el.primaryKey === btn.dataset.a) el.primaryKey = el.attributes[0] || '';
        saveHistory(); renderAll(); overlay.remove(); openEditModal(el);
      };
    });
    const addBtn = overlay.querySelector('#add-attr-btn');
    if (addBtn) addBtn.onclick = () => {
      const val = overlay.querySelector('#new-attr-input').value.trim();
      if (!val) return;
      el.attributes.push(val);
      if (overlay.querySelector('#new-attr-pk').checked) el.primaryKey = val;
      saveHistory(); renderAll(); overlay.remove(); openEditModal(el);
    };
  }
}

function editConnection(conn) {
  closeAnyModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <h2>⟷ Edit Connection</h2>
    <label>From Cardinality</label>
    <select id="card-from"><option ${conn.cardFrom === '1' ? 'selected' : ''}>1</option><option ${conn.cardFrom === 'N' ? 'selected' : ''}>N</option><option ${conn.cardFrom === 'M' ? 'selected' : ''}>M</option><option ${conn.cardFrom === '0..1' ? 'selected' : ''}>0..1</option><option ${conn.cardFrom === '0..N' ? 'selected' : ''}>0..N</option></select>
    <label>To Cardinality</label>
    <select id="card-to"><option ${conn.cardTo === '1' ? 'selected' : ''}>1</option><option ${conn.cardTo === 'N' ? 'selected' : ''}>N</option><option ${conn.cardTo === 'M' ? 'selected' : ''}>M</option><option ${conn.cardTo === '0..1' ? 'selected' : ''}>0..1</option><option ${conn.cardTo === '0..N' ? 'selected' : ''}>0..N</option></select>
    <div class="btn-row">
      <button class="btn-danger" id="modal-delete">Delete</button>
      <button class="btn-cancel" id="modal-cancel">Cancel</button>
      <button class="btn-save" id="modal-save">Save</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
  overlay.querySelector('#modal-delete').onclick = () => { state.connections = state.connections.filter(c => c.id !== conn.id); saveHistory(); renderAll(); overlay.remove(); };
  overlay.querySelector('#modal-save').onclick = () => {
    conn.cardFrom = overlay.querySelector('#card-from').value;
    conn.cardTo = overlay.querySelector('#card-to').value;
    saveHistory(); renderAll(); overlay.remove();
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function closeAnyModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
}

// ========== CONTEXT MENU ==========
function onContextMenu(e, el) {
  e.preventDefault();
  closeAnyModal();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';
  menu.innerHTML = `
    <button id="ctx-edit">✏️ Edit</button>
    <button id="ctx-dup">📋 Duplicate</button>
    <div class="separator"></div>
    <button id="ctx-del" class="danger">🗑 Delete</button>`;
  document.body.appendChild(menu);
  menu.querySelector('#ctx-edit').onclick = () => { closeAnyModal(); openEditModal(el); };
  menu.querySelector('#ctx-dup').onclick = () => {
    const dup = JSON.parse(JSON.stringify(el));
    dup.id = state.nextId++; dup.x += 30; dup.y += 30;
    state.elements.push(dup);
    saveHistory(); renderAll(); closeAnyModal();
    toast('Duplicated', 'success');
  };
  menu.querySelector('#ctx-del').onclick = () => { deleteElement(el.id); closeAnyModal(); };
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 50);
}

// ========== TOOLBAR BUTTONS ==========
const toolBtns = { 'tool-select': 'select', 'tool-entity': 'entity', 'tool-relation': 'relationship', 'tool-connect': 'connect' };
Object.entries(toolBtns).forEach(([id, tool]) => {
  document.getElementById(id).onclick = () => {
    state.tool = tool;
    state.connectFrom = null;
    document.querySelectorAll('.toolbar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('status-text').textContent = tool === 'connect' ? 'Click two elements to connect' : tool === 'select' ? 'Ready' : `Click canvas to place ${tool}`;
    if (tool === 'connect') canvasContainer.classList.add('connecting-mode');
    else canvasContainer.classList.remove('connecting-mode');
  };
});

document.getElementById('tool-snap').onclick = function () {
  state.snap = !state.snap;
  if (state.snap) this.classList.add('active');
  else this.classList.remove('active');
  toast(state.snap ? 'Snap ON' : 'Snap OFF', 'info');
};

// ========== HEADER BUTTONS ==========
document.getElementById('btn-undo').onclick = () => { if (state.historyIdx > 0) restoreHistory(state.historyIdx - 1); };
document.getElementById('btn-redo').onclick = () => { if (state.historyIdx < state.history.length - 1) restoreHistory(state.historyIdx + 1); };
document.getElementById('btn-clear').onclick = () => {
  if (state.elements.length === 0) return;
  if (!confirm('Clear the entire canvas?')) return;
  state.elements = []; state.connections = []; state.selected = null;
  saveHistory(); renderAll();
  toast('Canvas cleared', 'error');
};

document.getElementById('btn-export').onclick = () => {
  const clone = svg.cloneNode(true);
  clone.style.transform = '';
  clone.setAttribute('width', 2000);
  clone.setAttribute('height', 1500);
  // Add dark background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);
  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2000; canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 2000, 1500);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = 'er-diagram.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported as PNG!', 'success');
  };
  img.src = url;
};

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Delete' && state.selected) { deleteElement(state.selected); }
  if (e.key === 'v') document.getElementById('tool-select').click();
  if (e.key === 'e') document.getElementById('tool-entity').click();
  if (e.key === 'r') document.getElementById('tool-relation').click();
  if (e.key === 'c') document.getElementById('tool-connect').click();
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('btn-undo').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('btn-redo').click(); }
});

// ========== AI GENERATE ==========
const N8N_WEBHOOK_URL = 'https://allnighter.app.n8n.cloud/webhook/er-generate';
const aiModal = document.getElementById('ai-modal');
const aiTopicInput = document.getElementById('ai-topic-input');
const aiGenerateBtn = document.getElementById('ai-generate-btn');
const aiCancelBtn = document.getElementById('ai-cancel-btn');

// Open modal
document.getElementById('btn-ai-generate').onclick = () => {
  aiModal.style.display = 'flex';
  aiTopicInput.value = '';
  aiTopicInput.focus();
  setAILoading(false);
};

// Close modal
aiCancelBtn.onclick = () => { aiModal.style.display = 'none'; };
aiModal.addEventListener('click', e => { if (e.target === aiModal) aiModal.style.display = 'none'; });

// Example chips
document.querySelectorAll('.ai-example-chip').forEach(chip => {
  chip.onclick = () => {
    aiTopicInput.value = chip.dataset.topic;
    aiTopicInput.focus();
  };
});

// Loading state
function setAILoading(loading) {
  const textSpan = aiGenerateBtn.querySelector('.btn-text');
  const loadSpan = aiGenerateBtn.querySelector('.btn-loading');
  if (loading) {
    textSpan.style.display = 'none';
    loadSpan.style.display = 'inline-flex';
    aiGenerateBtn.disabled = true;
    aiTopicInput.disabled = true;
  } else {
    textSpan.style.display = '';
    loadSpan.style.display = 'none';
    aiGenerateBtn.disabled = false;
    aiTopicInput.disabled = false;
  }
}

// Generate button click
aiGenerateBtn.onclick = async () => {
  const topic = aiTopicInput.value.trim();
  if (!topic) { toast('Please enter a topic', 'error'); return; }

  setAILoading(true);
  toast('Sending to AI... this may take 10-20 seconds', 'info');

  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}?topic=${encodeURIComponent(topic)}`, {
      method: 'GET'
    });

    if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

    const rawText = await response.text();
    if (!rawText || rawText.trim() === '') {
      throw new Error('n8n returned an empty response. Check the Executions tab in n8n to see if the AI node failed.');
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error('n8n returned invalid JSON. Make sure the AI prompt is correct.');
    }

    // Handle different response shapes from n8n
    if (Array.isArray(data)) data = data[0];
    if (data.text && typeof data.text === 'string') {
      const cleaned = data.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      data = JSON.parse(cleaned);
    }
    if (data.output && typeof data.output === 'string') {
      const cleaned = data.output.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      data = JSON.parse(cleaned);
    }

    if (!data.entities || !Array.isArray(data.entities)) {
      console.log('Unrecognized AI payload:', data);
      throw new Error('AI response missing entities array');
    }

    renderAISchema(data);
    aiModal.style.display = 'none';
    toast(`Generated ${data.entities.length} entities for "${topic}"!`, 'success');

  } catch (err) {
    console.error('AI Generate error:', err);
    toast('AI generation failed: ' + err.message, 'error');
  } finally {
    setAILoading(false);
  }
};

// Keyboard shortcut: Enter to generate
aiTopicInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    aiGenerateBtn.click();
  }
});

// Render AI schema onto canvas
function renderAISchema(schema) {
  // Clear existing elements
  state.elements = [];
  state.connections = [];
  state.nextId = 1;

  // Auto-layout: place entities in a grid
  const cols = Math.ceil(Math.sqrt(schema.entities.length));
  const spacingX = 300;
  const spacingY = 250;

  schema.entities.forEach((entity, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const el = {
      id: state.nextId++,
      type: 'entity',
      x: 80 + col * spacingX,
      y: 80 + row * spacingY,
      w: 160,
      h: 80,
      name: entity.name,
      attributes: entity.attributes || ['id'],
      primaryKey: entity.primaryKey || entity.attributes[0] || 'id'
    };
    state.elements.push(el);
  });

  // Create relationships with diamonds
  if (schema.relationships && Array.isArray(schema.relationships)) {
    schema.relationships.forEach(rel => {
      const fromEl = state.elements.find(e => e.name === rel.from);
      const toEl = state.elements.find(e => e.name === rel.to);
      if (!fromEl || !toEl) return;

      // Place relationship diamond between the two entities
      const midX = (fromEl.x + toEl.x) / 2;
      const midY = (fromEl.y + toEl.y) / 2;
      const relEl = {
        id: state.nextId++,
        type: 'relationship',
        x: midX,
        y: midY,
        w: 120,
        rh: 60,
        name: rel.name || 'relates'
      };
      state.elements.push(relEl);

      // Connect: entity → relationship
      state.connections.push({
        id: state.nextId++,
        from: fromEl.id,
        to: relEl.id,
        cardFrom: rel.cardFrom || '1',
        cardTo: ''
      });

      // Connect: relationship → entity
      state.connections.push({
        id: state.nextId++,
        from: relEl.id,
        to: toEl.id,
        cardFrom: '',
        cardTo: rel.cardTo || 'N'
      });
    });
  }

  saveHistory();
  renderAll();

  // Reset zoom/pan to see everything
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  svg.style.transform = '';
  updateStatus();
}

// ========== INIT ==========
saveHistory();
renderAll();
document.getElementById('tool-select').click();
document.getElementById('tool-snap').classList.add('active');