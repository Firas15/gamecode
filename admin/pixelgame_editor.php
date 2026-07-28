<?php
require_once __DIR__ . '/config.php';
requireAdmin();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PIXELGAME // MAP EDITOR — Admin</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&display=swap');

  :root {
    --px-bg:       #0a0a0f;
    --px-surface:  #12121a;
    --px-panel:    #1a1a2e;
    --px-border:   #2a2a4a;
    --px-accent:   #7c3aed;
    --px-accent2:  #a855f7;
    --px-green:    #22c55e;
    --px-red:      #ef4444;
    --px-yellow:   #facc15;
    --px-cyan:     #06b6d4;
    --px-text:     #e2e8f0;
    --px-muted:    #64748b;
    --px-wall:     #4a4a6a;
    --px-floor:    #1e1e30;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; image-rendering: pixelated; }

  body {
    background: var(--px-bg);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 18px;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── AUTH SCREEN ── */
  #auth-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 0;
  }

  .auth-box {
    background: var(--px-surface);
    border: 3px solid var(--px-accent);
    padding: 40px 48px;
    width: 420px;
    position: relative;
  }

  .auth-box::before {
    content: '';
    position: absolute;
    top: -6px; left: -6px; right: -6px; bottom: -6px;
    border: 1px solid var(--px-accent);
    opacity: 0.3;
    pointer-events: none;
  }

  .pixel-logo {
    font-family: 'Press Start 2P', monospace;
    font-size: 14px;
    color: var(--px-accent2);
    text-align: center;
    margin-bottom: 8px;
    letter-spacing: 2px;
    text-shadow: 0 0 20px var(--px-accent);
  }

  .pixel-sub {
    font-family: 'VT323', monospace;
    font-size: 20px;
    color: var(--px-muted);
    text-align: center;
    margin-bottom: 32px;
    letter-spacing: 4px;
  }

  .field-label {
    font-size: 14px;
    color: var(--px-muted);
    margin-bottom: 6px;
    letter-spacing: 2px;
  }

  .px-input {
    width: 100%;
    background: var(--px-panel);
    border: 2px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 22px;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.15s;
    margin-bottom: 20px;
  }

  .px-input:focus { border-color: var(--px-accent2); }

  .px-btn {
    width: 100%;
    background: var(--px-accent);
    border: none;
    color: #fff;
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    padding: 14px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: background 0.1s, transform 0.1s;
    margin-top: 8px;
  }

  .px-btn:hover { background: var(--px-accent2); transform: scale(1.01); }
  .px-btn:active { transform: scale(0.98); }

  #auth-error {
    color: var(--px-red);
    font-size: 16px;
    margin-top: 14px;
    text-align: center;
    min-height: 22px;
    letter-spacing: 1px;
  }

  .scanlines-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.08) 2px,
      rgba(0,0,0,0.08) 4px
    );
    z-index: 9999;
  }

  /* ── ADMIN PANEL ── */
  #admin-panel { display: flex; flex-direction: column; height: 100vh; }

  .topbar {
    background: var(--px-surface);
    border-bottom: 2px solid var(--px-border);
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-shrink: 0;
  }

  .topbar-logo {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: var(--px-accent2);
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .topbar-sep { color: var(--px-border); font-size: 22px; }

  .topbar-title {
    font-size: 20px;
    color: var(--px-muted);
    letter-spacing: 2px;
  }

  .topbar-right {
    margin-left: auto;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .btn-sm {
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 16px;
    padding: 6px 14px;
    cursor: pointer;
    letter-spacing: 1px;
    transition: border-color 0.1s;
  }

  .btn-sm:hover { border-color: var(--px-accent2); color: var(--px-accent2); }

  .btn-sm.danger:hover { border-color: var(--px-red); color: var(--px-red); }

  .btn-sm.success {
    background: var(--px-green);
    border-color: var(--px-green);
    color: #000;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 8px 16px;
  }

  .btn-sm.success:hover { background: #16a34a; border-color: #16a34a; }

  .level-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
  }

  .level-meta-input {
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 14px;
    padding: 6px 10px;
    min-width: 140px;
    outline: none;
  }

  .level-meta-input:focus {
    border-color: var(--px-accent2);
  }

  .main-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 230px;
    background: var(--px-surface);
    border-right: 2px solid var(--px-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow-y: auto;
  }

  .sidebar-section {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--px-border);
  }

  .sidebar-heading {
    font-size: 13px;
    color: var(--px-muted);
    letter-spacing: 3px;
    margin-bottom: 10px;
  }

  .level-btn {
    width: 100%;
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 18px;
    padding: 8px 12px;
    text-align: left;
    cursor: pointer;
    margin-bottom: 4px;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.1s;
  }

  .level-btn:hover { border-color: var(--px-accent2); }

  .level-btn.active {
    border-color: var(--px-accent);
    background: rgba(124,58,237,0.15);
    color: var(--px-accent2);
  }

  .level-modified {
    width: 8px; height: 8px;
    background: var(--px-yellow);
    border-radius: 0;
    flex-shrink: 0;
    margin-left: auto;
    display: none;
  }

  .level-btn.modified .level-modified { display: block; }

  /* ── TOOL PALETTE ── */
  .tool-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .tool-btn {
    background: var(--px-panel);
    border: 2px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 14px;
    padding: 8px 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: border-color 0.1s;
    letter-spacing: 0.5px;
    line-height: 1.2;
  }

  .tool-btn:hover { border-color: var(--px-accent2); }

  .tool-btn.active {
    border-color: var(--px-accent);
    background: rgba(124,58,237,0.2);
  }

  .tool-icon {
    font-size: 22px;
    line-height: 1;
  }

  .tool-name {
    font-size: 12px;
    color: var(--px-muted);
  }

  .tool-btn.active .tool-name { color: var(--px-accent2); }

  /* ── MAP EDITOR ── */
  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--px-bg);
  }

  .editor-toolbar {
    background: var(--px-surface);
    border-bottom: 1px solid var(--px-border);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .editor-info {
    font-size: 15px;
    color: var(--px-muted);
    letter-spacing: 1px;
    margin-left: auto;
  }

  .canvas-wrapper {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 20px;
    background:
      repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.02) 31px, rgba(255,255,255,0.02) 32px),
      repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,0.02) 31px, rgba(255,255,255,0.02) 32px);
  }

  #map-canvas {
    cursor: crosshair;
    display: block;
    image-rendering: pixelated;
  }

  /* ── STATUS BAR ── */
  .statusbar {
    background: var(--px-surface);
    border-top: 1px solid var(--px-border);
    padding: 4px 16px;
    display: flex;
    gap: 24px;
    align-items: center;
    flex-shrink: 0;
    font-size: 14px;
  }

  .status-item { color: var(--px-muted); }
  .status-val  { color: var(--px-cyan); }

  .question-panel {
    background: var(--px-surface);
    border-top: 2px solid var(--px-border);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 360px;
    overflow: auto;
  }
  .question-panel h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--px-muted);
    letter-spacing: 2px;
  }
  .question-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .question-toolbar .btn-sm { min-width: 120px; }
  .question-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .question-item {
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    padding: 8px 10px;
    font-size: 14px;
    cursor: pointer;
    transition: border-color 0.1s, background 0.1s;
    text-align: left;
    min-height: 48px;
  }
  .question-item.active {
    border-color: var(--px-accent);
    background: rgba(124,58,237,0.12);
  }
  .question-editor {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .question-editor-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .question-editor-group label {
    font-size: 12px;
    color: var(--px-muted);
  }
  .question-editor-group input,
  .question-editor-group textarea,
  .question-editor-group select {
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 14px;
    padding: 8px;
    outline: none;
  }
  .question-editor-group textarea { resize: vertical; min-height: 80px; }

  .question-editor-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .question-editor-error {
    color: var(--px-red);
    font-size: 13px;
    min-height: 18px;
  }

  /* ── MAP SIZE CONTROLS ── */
  .size-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 15px;
  }

  .size-input {
    width: 52px;
    background: var(--px-panel);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: 'VT323', monospace;
    font-size: 18px;
    padding: 4px 8px;
    text-align: center;
    outline: none;
  }

  .size-input:focus { border-color: var(--px-accent2); }

  /* ── NOTIFICATION ── */
  #notify {
    position: fixed;
    bottom: 50px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--px-green);
    color: #000;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 12px 24px;
    border: 2px solid #000;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;
    pointer-events: none;
    letter-spacing: 1px;
  }

  #notify.show { opacity: 1; }
  #notify.error { background: var(--px-red); color: #fff; }

  /* cursor blink */
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  .cursor { animation: blink 1s infinite; }

  /* legend */
  .legend-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--px-muted);
  }

  .legend-swatch {
    width: 16px;
    height: 16px;
    border: 1px solid rgba(255,255,255,0.1);
    flex-shrink: 0;
  }

  /* scroll style */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--px-bg); }
  ::-webkit-scrollbar-thumb { background: var(--px-border); }
  ::-webkit-scrollbar-thumb:hover { background: var(--px-accent); }

  .resize-hint {
    font-size: 13px;
    color: var(--px-muted);
    letter-spacing: 1px;
    padding: 0 16px 10px;
  }
</style>
</head>
<body>
<div class="scanlines-overlay"></div>

<!-- ── ADMIN PANEL ── -->
<div id="admin-panel">

  <div class="topbar">
    <div class="topbar-logo">◈ GAMECODE</div>
    <div class="topbar-sep">|</div>
    <div class="topbar-title">MAP EDITOR v1.0</div>
    <div class="topbar-right">
      <button class="btn-sm success" onclick="gotoGame()">▶ В ИГРУ</button>
      <button class="btn-sm success" onclick="saveLevel()">▶ SAVE LEVEL</button>
      <button class="btn-sm" onclick="resetLevel()">↺ RESET</button>
      <button class="btn-sm" onclick="exportJSON()">⬇ EXPORT</button>
      <button class="btn-sm danger" onclick="location.href='dashboard.php'">◀ АДМИНКА</button>
    </div>
  </div>

  <div class="main-layout">

    <!-- SIDEBAR -->
    <div class="sidebar">

      <!-- Level select -->
      <div class="sidebar-section">
        <div class="sidebar-heading">▸ LEVELS</div>
        <div id="level-list"></div>
        <button class="btn-sm" style="width:100%;margin-top:6px;font-size:14px" onclick="addLevel()">+ NEW LEVEL</button>
      </div>

      <!-- Tools -->
      <div class="sidebar-section">
        <div class="sidebar-heading">▸ TOOLS</div>
        <div class="tool-grid" id="tool-grid"></div>
      </div>

      <!-- Legend -->
      <div class="sidebar-section">
        <div class="sidebar-heading">▸ LEGEND</div>
        <div class="legend-grid" id="legend-grid"></div>
      </div>

      <!-- Map size -->
      <div class="sidebar-section">
        <div class="sidebar-heading">▸ MAP SIZE</div>
        <div style="display:flex;gap:6px;align-items:center;font-size:15px;margin-bottom:6px">
          <span style="color:var(--px-muted)">W:</span>
          <input class="size-input" id="sz-w" type="number" min="5" max="60" value="20">
          <span style="color:var(--px-muted)">H:</span>
          <input class="size-input" id="sz-h" type="number" min="5" max="40" value="15">
        </div>
        <button class="btn-sm" style="width:100%;font-size:14px" onclick="resizeMap()">RESIZE MAP</button>
        <div class="resize-hint" style="padding:6px 0 0;font-size:12px">⚠ resize clears map</div>
      </div>

    </div>

    <!-- EDITOR AREA -->
    <div class="editor-area">
      <div class="editor-toolbar">
        <span style="font-size:15px;color:var(--px-muted);letter-spacing:2px">EDITING:</span>
        <span id="cur-level-name" style="color:var(--px-accent2);font-size:18px">—</span>
        <div class="level-meta-row">
          <input id="level-name-field" class="level-meta-input" type="text" placeholder="Level name" />
          <input id="level-title-field" class="level-meta-input" type="text" placeholder="Level theme" />
          <button class="btn-sm danger" style="font-size:12px;padding:8px 10px" onclick="deleteLevel()">DELETE</button>
        </div>
        <span style="font-size:15px;color:var(--px-muted);margin-left:16px">TOOL:</span>
        <span id="cur-tool-name" style="color:var(--px-yellow);font-size:18px">WALL</span>
        <div class="editor-info" id="cur-pos">X:— Y:—</div>
      </div>

      <div class="canvas-wrapper" id="canvas-wrapper">
        <canvas id="map-canvas"></canvas>
      </div>

      <div class="statusbar">
        <span class="status-item">SIZE: <span class="status-val" id="stat-size">—</span></span>
        <span class="status-item">CELLS: <span class="status-val" id="stat-cells">—</span></span>
        <span class="status-item">WALLS: <span class="status-val" id="stat-walls">0</span></span>
        <span class="status-item">PLAYER: <span class="status-val" id="stat-player">none</span></span>
        <span class="status-item">EXIT: <span class="status-val" id="stat-exit">none</span></span>
        <span class="status-item">MONSTERS: <span class="status-val" id="stat-monsters">0</span></span>
        <span class="status-item">CHESTS: <span class="status-val" id="stat-chests">0</span></span>
        <span class="status-item">QUESTIONS: <span class="status-val" id="stat-questions">0</span></span>
      </div>
      <div class="question-panel">
        <div class="question-toolbar">
          <h3>▸ LEVEL QUESTIONS</h3>
          <button class="btn-sm success" onclick="addQuestion()">+ NEW QUESTION</button>
          <button class="btn-sm" onclick="duplicateQuestion()">DUPLICATE</button>
          <button class="btn-sm" onclick="deleteQuestion()">DELETE</button>
          <button class="btn-sm" onclick="saveQuestion()">SAVE</button>
          <button class="btn-sm" onclick="resetQuestion()">RESET</button>
          <button class="btn-sm" onclick="triggerImportQuestions()">IMPORT JSON</button>
          <input id="question-import-file" type="file" accept="application/json" style="display:none" onchange="importQuestions(event)">
        </div>
        <div class="question-list" id="question-list"></div>
        <div class="question-editor" id="question-editor"></div>
      </div>
    </div>

  </div>
</div>

<div id="notify">SAVED!</div>

<script>

//  TILE DEFINITIONS
const TILES = {
  0: { name: 'FLOOR',   color: '#1e1e30', icon: '░', label: 'Floor (walkable)' },
  1: { name: 'WALL',    color: '#3d3d5c', icon: '█', label: 'Wall (solid)' },
  2: { name: 'PLAYER',  color: '#22c55e', icon: '◉', label: 'Player start', unique: true },
  3: { name: 'EXIT',    color: '#06b6d4', icon: '▣', label: 'Exit portal', unique: true },
  4: { name: 'MONSTER', color: '#ef4444', icon: '☠', label: 'Monster spawn' },
  5: { name: 'CHEST',   color: '#facc15', icon: '◆', label: 'Chest / loot' },
  6: { name: 'ERASE',   color: '#1e1e30', icon: '✕', label: 'Eraser → Floor', erase: true },
  7: { name: 'TRAP',    color: '#ff6b6b', icon: '⚠', label: 'Trap (trigger)', note: 'function triggerTrap()' },
};

const TOOLS = [
  { id: 1, name: 'WALL',    tile: 1 },
  { id: 0, name: 'FLOOR',   tile: 0 },
  { id: 2, name: 'PLAYER',  tile: 2 },
  { id: 3, name: 'EXIT',    tile: 3 },
  { id: 4, name: 'MONSTER', tile: 4 },
  { id: 5, name: 'CHEST',   tile: 5 },
  { id: 7, name: 'TRAP',    tile: 7 },
  { id: 6, name: 'ERASE',   tile: 6 },
];

//  DEFAULT MAPS (LEVELS)
// Карта 21×21 совпадает с MAP_DEFAULT в games/pixelgame/js/game.js
// Формат: 0=пол, 1=стена, 2=игрок, 3=финиш, 4=враг, 5=сундук, 7=ловушка
const GAME_MAP_21x21 = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1],
  [1,0,1,0,1,0,1,0,4,0,1,0,5,0,1,0,1,0,0,0,1],
  [1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,1,1,1,1,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1],
  [1,0,0,0,0,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,0,0,1,0,1,0,1,0,4,0,1],
  [1,0,1,0,5,0,1,0,1,0,4,0,1,0,1,0,1,1,1,1,1],
  [1,0,1,0,1,1,1,0,1,0,0,0,1,0,1,0,0,0,0,0,1],
  [1,0,1,0,0,0,0,0,1,1,1,1,1,0,1,1,1,1,1,0,1],
  [1,0,1,1,1,1,1,1,1,0,0,0,1,0,4,0,0,0,1,0,1],
  [1,0,0,0,0,0,0,0,1,0,1,0,1,0,1,1,1,0,5,0,1],
  [1,0,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
  [1,0,4,0,1,0,5,0,1,0,1,0,1,0,0,0,1,0,1,0,1],
  [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,1],
  [1,0,1,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,5,0,1],
  [1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,0,0,1,0,4,0,1,0,0,0,1],
  [1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,3,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const DEFAULT_LEVELS = [
  { name: 'Level 1', map: GAME_MAP_21x21 },
  { name: 'Level 2', map: GAME_MAP_21x21 },
  { name: 'Level 3', map: GAME_MAP_21x21 },
  { name: 'Level 4', map: GAME_MAP_21x21 },
];

//  STATE
const CELL = 32;
let levels = [];
let currentLevelIdx = 0;
let currentQuestionIndex = 0;
let currentTile = 1;
let isPainting = false;
let mouseButton = 0;
let modifiedLevels = new Set();

// Авторизация — через общую сессию админки (requireAdmin() в PHP).

//  INIT
async function initAdmin() {
  await loadLevels();
  buildToolGrid();
  buildLegend();
  setupCanvas();
  selectLevel(0);
  document.getElementById('level-name-field').addEventListener('input', syncLevelMetaFromForm);
  document.getElementById('level-title-field').addEventListener('input', syncLevelMetaFromForm);
}

async function loadLevels() {
  const defaultLevels = await Promise.all([1,2,3,4].map(async (levelNumber, index) => {
    const levelName = `Level ${levelNumber}`;
    const base = {
      level: levelNumber,
      name: levelName,
      title: levelName,
      map: DEFAULT_LEVELS[index]?.map ? deepClone(DEFAULT_LEVELS[index].map) : [],
      chests: [],
      final: null,
    };
    try {
      let data = null;
      try {
        const apiRes = await fetch(`../api/pixelgame-level.php?level=${levelNumber}`, { cache: 'no-store' });
        if (apiRes.ok) data = await apiRes.json();
      } catch (e) { /* API недоступен — фолбэк на статический JSON */ }
      if (!data || !Array.isArray(data.chests)) {
        const response = await fetch(`../games/pixelgame/data/levels/level${levelNumber}.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return base;
        data = await response.json();
      }
      return {
        level: data.level || levelNumber,
        name: data.name || data.title || levelName,
        title: data.title || levelName,
        map: (Array.isArray(data.map) && data.map.length) ? deepClone(data.map) : base.map,
        chests: Array.isArray(data.chests) ? data.chests : [],
        final: data.final || null,
      };
    } catch (e) {
      return base;
    }
  }));

  levels = defaultLevels;

  rebuildLevelList();
}

function rebuildLevelList() {
  const el = document.getElementById('level-list');
  el.innerHTML = '';
  levels.forEach((lv, i) => {
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (i === currentLevelIdx ? ' active' : '') + (modifiedLevels.has(i) ? ' modified' : '');
    btn.innerHTML = `<span style="color:var(--px-muted);font-size:14px">${String(i+1).padStart(2,'0')}</span> ${lv.name} <span class="level-modified"></span>`;
    btn.onclick = () => selectLevel(i);
    el.appendChild(btn);
  });
}

function buildToolGrid() {
  const grid = document.getElementById('tool-grid');
  grid.innerHTML = '';
  TOOLS.forEach(t => {
    const tile = TILES[t.tile];
    const btn = document.createElement('button');
    btn.className = 'tool-btn' + (t.tile === currentTile ? ' active' : '');
    btn.id = 'tool-' + t.id;
    btn.innerHTML = `<span class="tool-icon" style="color:${tile.color};filter:brightness(2)">${tile.icon}</span><span class="tool-name">${t.name}</span>`;
    btn.onclick = () => selectTool(t.tile, t.name);
    grid.appendChild(btn);
  });
}

function buildLegend() {
  const lg = document.getElementById('legend-grid');
  lg.innerHTML = '';
  Object.entries(TILES).filter(([k]) => k != 6).forEach(([k, v]) => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    row.innerHTML = `<div class="legend-swatch" style="background:${v.color};filter:brightness(1.5)"></div><span>${v.icon} ${v.label}</span>`;
    lg.appendChild(row);
  });

  const note = document.createElement('div');
  note.style.marginTop = '10px';
  note.style.padding = '8px';
  note.style.borderTop = '1px solid rgba(255,255,255,0.04)';
  lg.appendChild(note);
}

function selectTool(tileId, name) {
  currentTile = tileId;
  document.getElementById('cur-tool-name').textContent = name || TILES[tileId].name;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const found = TOOLS.find(t => t.tile === tileId);
  if (found) {
    const btn = document.getElementById('tool-' + found.id);
    if (btn) btn.classList.add('active');
  }
}

//  CANVAS & DRAWING
function setupCanvas() {
  const canvas = document.getElementById('map-canvas');

  canvas.addEventListener('mousedown', e => {
    e.preventDefault();
    isPainting = true;
    mouseButton = e.button;
    paintAt(e);
  });

  canvas.addEventListener('mousemove', e => {
    updatePos(e);
    if (isPainting) paintAt(e);
  });

  canvas.addEventListener('mouseup', () => { isPainting = false; });
  canvas.addEventListener('mouseleave', () => {
    isPainting = false;
    document.getElementById('cur-pos').textContent = 'X:— Y:—';
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('mouseup', () => { isPainting = false; });
}

function canvasXY(e) {
  const canvas = document.getElementById('map-canvas');
  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor((e.clientX - rect.left) / CELL);
  const cy = Math.floor((e.clientY - rect.top) / CELL);
  return [cx, cy];
}

function updatePos(e) {
  const [cx, cy] = canvasXY(e);
  const lv = levels[currentLevelIdx];
  if (!lv) return;
  const h = lv.map.length, w = lv.map[0]?.length || 0;
  if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
    document.getElementById('cur-pos').textContent = `X:${cx} Y:${cy}`;
  }
}

function paintAt(e) {
  const [cx, cy] = canvasXY(e);
  const lv = levels[currentLevelIdx];
  if (!lv) return;
  const h = lv.map.length, w = lv.map[0]?.length || 0;
  if (cx < 0 || cx >= w || cy < 0 || cy >= h) return;

  let tile = currentTile;
  if (e.button === 2 || mouseButton === 2) tile = 0; // right click = erase

  const actualTile = (tile === 6) ? 0 : tile;

  // unique tiles: remove previous placement
  if (TILES[actualTile]?.unique && actualTile !== 0) {
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (lv.map[r][c] === actualTile) lv.map[r][c] = 0;
      }
    }
  }

  if (lv.map[cy][cx] !== actualTile) {
    lv.map[cy][cx] = actualTile;
    modifiedLevels.add(currentLevelIdx);
    rebuildLevelList();
    renderMap();
    updateStats();
  }
}

// GAME-ACCURATE RENDERER (textures removed, restored to original)
const TS = 48;
let edTexWall = null, edTexFloor = null, edTexFloorB = null;

function buildEdTextures() {
  // Стена — точная копия buildWallTex() из игры
  const wc = document.createElement('canvas'); wc.width=TS; wc.height=TS;
  const wx = wc.getContext('2d');
  wx.fillStyle='#0e1928'; wx.fillRect(0,0,TS,TS);
  const bH=11, bW=TS/2+1;
  for(let row=0;row<Math.ceil(TS/bH)+1;row++){
    const off=(row%2)*bW/2;
    for(let col=-1;col<3;col++){
      const bx=col*bW+off, by=row*bH, lum=13+(row*3+col*2)%6;
      wx.fillStyle=`hsl(220,42%,${lum}%)`; wx.fillRect(bx+1,by+1,bW-2,bH-2);
      wx.fillStyle='#050c18'; wx.fillRect(bx,by,bW,1); wx.fillRect(bx,by,1,bH);
      wx.fillStyle='rgba(255,255,255,0.04)'; wx.fillRect(bx+2,by+2,4,2);
    }
  }
  const gw=wx.createLinearGradient(0,0,0,9);
  gw.addColorStop(0,'rgba(0,229,255,0.2)'); gw.addColorStop(1,'rgba(0,229,255,0)');
  wx.fillStyle=gw; wx.fillRect(0,0,TS,9);
  wx.strokeStyle='rgba(0,229,255,0.08)'; wx.lineWidth=1; wx.strokeRect(0,0,TS,TS);
  edTexWall = wc;

  function mkFloor(alt){
    const fc=document.createElement('canvas'); fc.width=TS; fc.height=TS;
    const fx=fc.getContext('2d');
    fx.fillStyle=alt?'#080f1a':'#0a1422'; fx.fillRect(0,0,TS,TS);
    fx.strokeStyle='rgba(0,229,255,0.08)'; fx.lineWidth=1; fx.strokeRect(2,2,TS-4,TS-4);
    const corner=(bx,by)=>{ fx.fillStyle='rgba(0,229,255,0.14)'; fx.fillRect(bx,by,3,3); };
    corner(3,3); corner(TS-6,3); corner(3,TS-6); corner(TS-6,TS-6);
    if(!alt){
      fx.strokeStyle='rgba(0,229,255,0.04)'; fx.lineWidth=1;
      fx.beginPath(); fx.moveTo(0,TS); fx.lineTo(TS,0); fx.stroke();
      fx.beginPath(); fx.moveTo(TS/2,0); fx.lineTo(TS,TS/2); fx.stroke();
    }
    fx.fillStyle=alt?'rgba(178,75,255,0.07)':'rgba(0,229,255,0.06)';
    fx.beginPath(); fx.arc(TS/2,TS/2,2,0,Math.PI*2); fx.fill();
    return fc;
  }
  edTexFloor = mkFloor(false);
  edTexFloorB = mkFloor(true);
}

function drawEdChest(ctx, x, y) {
  const S=CELL/TS;
  ctx.save(); ctx.translate(x,y); ctx.scale(S,S);
  ctx.fillStyle='rgba(255,214,0,0.14)'; ctx.beginPath(); ctx.arc(TS/2,TS/2,26,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#5c3d11'; ctx.fillRect(5,16,TS-10,TS-20);
  ctx.fillStyle='#c89a30'; ctx.fillRect(5,TS-8,TS-10,3);
  ctx.fillStyle='#7a5219'; ctx.fillRect(5,10,TS-10,9);
  ctx.fillStyle='#c89a30'; ctx.fillRect(5,10,TS-10,2); ctx.fillRect(5,17,TS-10,2);
  ctx.fillStyle='#ffd600'; ctx.fillRect(TS/2-5,14,10,10);
  ctx.fillStyle='#fff176'; ctx.fillRect(TS/2-3,15,4,4);
  ctx.fillStyle='#ffd600'; ctx.font='bold 11px "Press Start 2P"'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  ctx.fillText('?',TS/2,-2);
  ctx.restore();
}

function drawEdTrap(ctx, x, y) {
  const S=CELL/TS;
  ctx.save(); ctx.translate(x,y); ctx.scale(S,S);
  ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(4,4,TS-8,TS-8);
  ctx.fillStyle='rgba(255,77,109,0.25)'; ctx.fillRect(4,4,TS-8,TS-8);
  ctx.strokeStyle='rgba(255,77,109,0.75)'; ctx.lineWidth=2; ctx.setLineDash([4,4]);
  ctx.strokeRect(4,4,TS-8,TS-8); ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,77,109,0.95)'; ctx.font='14px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⚠',TS/2,TS/2);
  ctx.restore();
}

function drawEdFinish(ctx, x, y) {
  const S=CELL/TS;
  ctx.save(); ctx.translate(x,y); ctx.scale(S,S);
  ctx.strokeStyle='rgba(57,255,20,0.8)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(TS/2,TS/2,22,0,Math.PI*1.5); ctx.stroke();
  ctx.fillStyle='rgba(57,255,20,0.15)'; ctx.beginPath(); ctx.arc(TS/2,TS/2,16,0,Math.PI*2); ctx.fill();
  ctx.font='20px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🏆',TS/2,TS/2);
  ctx.fillStyle='#39ff14'; ctx.font='6px "Press Start 2P"'; ctx.textBaseline='alphabetic';
  ctx.fillText('ФИНАЛ',TS/2,-6);
  ctx.restore();
}

function drawEdMonster(ctx, x, y, type) {
  const S=CELL/TS;
  ctx.save(); ctx.translate(x,y); ctx.scale(S,S);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(TS/2,TS-3,11,4,0,0,Math.PI*2); ctx.fill();
  const cfg=[
    {d:'rgba(0,255,100,0.15)',  dark:'#003a18', light:'#005530', eyes:'#00ff88'},
    {d:'rgba(255,100,180,0.15)',dark:'#44002a', light:'#660040', eyes:'#ff69b4'},
    {d:'rgba(0,229,255,0.15)',  dark:'#003a44', light:'#005566', eyes:'#00ffff'},
  ][type]||{d:'rgba(0,255,100,0.15)',dark:'#003a18',light:'#005530',eyes:'#00ff88'};
  ctx.fillStyle=cfg.d;
  for(let i=0;i<6;i++) ctx.fillRect(4+(i*13%5)*8,2+(i*7%5)*8,6,6);
  ctx.fillStyle=cfg.dark; ctx.fillRect(8,6,24,26);
  ctx.fillStyle=cfg.light; ctx.fillRect(10,4,20,24);
  ctx.fillStyle=cfg.light;
  ctx.fillRect(8,28,8,6); ctx.fillRect(20,28,8,6); ctx.fillRect(32,28,8,6);
  ctx.fillStyle=cfg.dark; ctx.fillRect(16,28,4,4); ctx.fillRect(28,28,4,4);
  ctx.fillStyle=cfg.eyes;
  [[13,10],[23,10]].forEach(([ex,ey])=>{ ctx.fillRect(ex,ey,2,6); ctx.fillRect(ex-2,ey+2,6,2); });
  ctx.restore();
}

function drawEdPlayer(ctx, x, y) {
  const S=CELL/TS;
  ctx.save(); ctx.translate(x,y); ctx.scale(S,S);
  ctx.fillStyle='rgba(34,197,94,0.15)'; ctx.beginPath(); ctx.arc(TS/2,TS/2,22,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(34,197,94,0.7)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(TS/2,TS/2,18,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#22c55e'; ctx.font='bold 14px "Press Start 2P"';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('P',TS/2,TS/2);
  ctx.restore();
}

function renderMap() {
  const canvas = document.getElementById('map-canvas');
  const lv = levels[currentLevelIdx];
  if (!lv || !lv.map.length) return;

  const rows = lv.map.length;
  const cols = lv.map[0].length;
  canvas.width  = cols * CELL;
  canvas.height = rows * CELL;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = lv.map[r][c];
      const def  = TILES[tile] || TILES[0];
      const x = c * CELL, y = r * CELL;

      // base fill
      ctx.fillStyle = def.color;
      ctx.fillRect(x, y, CELL, CELL);

      // wall: draw bevel
      if (tile === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x, y, CELL, 2);
        ctx.fillRect(x, y, 2, CELL);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y+CELL-2, CELL, 2);
        ctx.fillRect(x+CELL-2, y, 2, CELL);
      }

      // floor: grid lines
      if (tile === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(x+0.5, y+0.5, CELL-1, CELL-1);
      }

      // non-wall non-floor: draw icon
      if (tile !== 0 && tile !== 1) {
        // glow circle
        ctx.fillStyle = def.color + '22';
        ctx.beginPath();
        ctx.arc(x + CELL/2, y + CELL/2, CELL/2 - 2, 0, Math.PI*2);
        ctx.fill();

        // subtle inner ring
        ctx.strokeStyle = def.color + '66';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + CELL/2, y + CELL/2, CELL/2 - 5, 0, Math.PI*2);
        ctx.stroke();

        ctx.fillStyle = brightenHex(def.color, 1.8);
        ctx.font = `bold ${Math.floor(CELL * 0.52)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.icon, x + CELL/2, y + CELL/2 + 1);
      }
    }
  }
}

function brightenHex(hex, factor) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) * factor) | 0;
  const g = Math.min(255, parseInt(hex.slice(3,5),16) * factor) | 0;
  const b = Math.min(255, parseInt(hex.slice(5,7),16) * factor) | 0;
  return `rgb(${r},${g},${b})`;
}

//  STATS
function updateStats() {
  const lv = levels[currentLevelIdx];
  if (!lv) return;
  const rows = lv.map.length, cols = lv.map[0]?.length || 0;
  let walls=0, monsters=0, chests=0, playerSet=false, exitSet=false;
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const t = lv.map[r][c];
    if (t===1) walls++;
    if (t===4) monsters++;
    if (t===5) chests++;
    if (t===2) playerSet=true;
    if (t===3) exitSet=true;
  }
  document.getElementById('stat-size').textContent    = `${cols}×${rows}`;
  document.getElementById('stat-cells').textContent   = rows*cols;
  document.getElementById('stat-walls').textContent   = walls;
  document.getElementById('stat-monsters').textContent= monsters;
  document.getElementById('stat-chests').textContent  = chests;
  document.getElementById('stat-player').textContent  = playerSet ? '✓ SET' : '✗ NONE';
  document.getElementById('stat-exit').textContent    = exitSet ? '✓ SET' : '✗ NONE';
  const questions = Array.isArray(lv.chests) ? lv.chests.length : 0;
  document.getElementById('stat-questions').textContent = questions;
  document.getElementById('stat-player').style.color  = playerSet ? 'var(--px-green)' : 'var(--px-red)';
  document.getElementById('stat-exit').style.color    = exitSet ? 'var(--px-cyan)' : 'var(--px-red)';
}

function getLevelQuestions() {
  const level = levels[currentLevelIdx];
  if (!level) return [];
  if (!Array.isArray(level.chests)) level.chests = [];
  return level.chests;
}

function renderQuestionPanel() {
  const level = levels[currentLevelIdx];
  if (!level) return;
  const questions = getLevelQuestions();
  const list = document.getElementById('question-list');
  list.innerHTML = '';
  if (!questions.length) {
    const empty = document.createElement('div');
    empty.style.color = 'var(--px-muted)';
    empty.style.gridColumn = 'span 3';
    empty.textContent = 'Нет вопросов. Добавь новый вопрос для этого уровня.';
    list.appendChild(empty);
    currentQuestionIndex = 0;
    renderQuestionEditor(null);
    updateStats();
    return;
  }
  questions.forEach((q, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'question-item' + (index === currentQuestionIndex ? ' active' : '');
    btn.textContent = `#${index+1} ${q.question ? q.question.slice(0, 30) : '[без вопроса]'}`;
    btn.onclick = () => {
      syncQuestionFromForm();
      selectQuestion(index);
    };
    list.appendChild(btn);
  });
  if (currentQuestionIndex >= questions.length) currentQuestionIndex = questions.length - 1;
  selectQuestion(currentQuestionIndex);
}

function selectQuestion(index) {
  const questions = getLevelQuestions();
  if (!questions.length) {
    currentQuestionIndex = 0;
    renderQuestionEditor(null);
    return;
  }
  currentQuestionIndex = Math.max(0, Math.min(index, questions.length - 1));
  document.querySelectorAll('.question-item').forEach((button, idx) => {
    button.classList.toggle('active', idx === currentQuestionIndex);
  });
  renderQuestionEditor(questions[currentQuestionIndex]);
}

function renderQuestionEditor(question) {
  const editor = document.getElementById('question-editor');
  editor.innerHTML = '';
  if (!question) {
    const hint = document.createElement('div');
    hint.style.color = 'var(--px-muted)';
    hint.textContent = 'Выбери вопрос, чтобы редактировать данные. Нажми + NEW QUESTION, чтобы создать новый.';
    editor.appendChild(hint);
    return;
  }

  const createGroup = (labelText, elementType, attributes = {}) => {
    const group = document.createElement('div');
    group.className = 'question-editor-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    group.appendChild(label);
    const field = document.createElement(elementType);
    Object.entries(attributes).forEach(([key, value]) => field.setAttribute(key, value));
    if (elementType === 'textarea') field.style.minHeight = '80px';
    group.appendChild(field);
    return { group, field };
  };

  const questionField = createGroup('Вопрос', 'textarea', { id: 'q-field-question' });
  questionField.field.value = question.question || '';
  editor.appendChild(questionField.group);

  const codeField = createGroup('Код / Текст', 'textarea', { id: 'q-field-code', rows: '4' });
  codeField.field.value = question.code || '';
  editor.appendChild(codeField.group);

  const optionsGroup = document.createElement('div');
  optionsGroup.className = 'question-editor-group';
  const optionsLabel = document.createElement('label');
  optionsLabel.textContent = 'Варианты ответов';
  optionsGroup.appendChild(optionsLabel);
  for (let i = 0; i < 4; i++) {
    const option = document.createElement('input');
    option.type = 'text';
    option.id = `q-field-option-${i}`;
    option.placeholder = `Option ${i+1}`;
    option.value = (question.options && question.options[i]) || '';
    optionsGroup.appendChild(option);
  }
  editor.appendChild(optionsGroup);

  const correctField = createGroup('Правильный вариант (1-4)', 'select', { id: 'q-field-correct' });
  for (let i = 0; i < 4; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Option ${i+1}`;
    correctField.field.appendChild(opt);
  }
  correctField.field.value = Number.isInteger(question.correct) ? String(question.correct) : '0';
  editor.appendChild(correctField.group);

  const hintField = createGroup('Подсказка', 'input', { id: 'q-field-hint', type: 'text' });
  hintField.field.value = question.hint || '';
  editor.appendChild(hintField.group);

  const rewardLabelField = createGroup('Надпись награды', 'input', { id: 'q-field-reward-label', type: 'text' });
  rewardLabelField.field.value = question.reward?.label || '';
  editor.appendChild(rewardLabelField.group);

  const rewardCodeField = createGroup('Код награды', 'textarea', { id: 'q-field-reward-code', rows: '4' });
  rewardCodeField.field.value = question.reward?.code || '';
  editor.appendChild(rewardCodeField.group);

  const errorRow = document.createElement('div');
  errorRow.className = 'question-editor-error';
  errorRow.id = 'question-editor-error';
  editor.appendChild(errorRow);

  const inputs = [
    questionField.field,
    codeField.field,
    hintField.field,
    rewardLabelField.field,
    rewardCodeField.field,
    correctField.field,
  ];
  for (let i = 0; i < 4; i++) {
    inputs.push(document.getElementById(`q-field-option-${i}`));
  }
  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      syncQuestionFromForm();
      renderQuestionPanel();
    });
  });
}

function syncQuestionFromForm() {
  const questions = getLevelQuestions();
  if (!questions.length) return;
  const question = questions[currentQuestionIndex];
  if (!question) return;
  const getValue = id => document.getElementById(id)?.value || '';
  question.question = getValue('q-field-question').trim();
  question.code = getValue('q-field-code');
  question.options = [];
  for (let i = 0; i < 4; i++) {
    question.options[i] = getValue(`q-field-option-${i}`).trim();
  }
  question.correct = Math.max(0, Math.min(3, parseInt(getValue('q-field-correct'), 10) || 0));
  question.hint = getValue('q-field-hint');
  question.reward = {
    label: getValue('q-field-reward-label'),
    code: getValue('q-field-reward-code'),
  };
  modifiedLevels.add(currentLevelIdx);
}

function saveQuestion() {
  const questions = getLevelQuestions();
  if (!questions.length) return;
  syncQuestionFromForm();
  modifiedLevels.add(currentLevelIdx);
  showNotify('QUESTION SAVED ✓');
  renderQuestionPanel();
}

function resetQuestion() {
  const questions = getLevelQuestions();
  if (!questions.length) return;
  renderQuestionPanel();
  showNotify('QUESTION RESET');
}

function addQuestion() {
  const level = levels[currentLevelIdx];
  if (!level) return;
  if (!Array.isArray(level.chests)) level.chests = [];
  syncQuestionFromForm();
  const nextId = level.chests.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
  level.chests.push({
    id: nextId,
    question: '',
    code: '',
    options: ['', '', '', ''],
    correct: 0,
    hint: '',
    reward: { label: 'Reward', code: '' },
  });
  currentQuestionIndex = level.chests.length - 1;
  modifiedLevels.add(currentLevelIdx);
  renderQuestionPanel();
  updateStats();
}

function duplicateQuestion() {
  const level = levels[currentLevelIdx];
  const questions = getLevelQuestions();
  if (!questions.length) return;
  syncQuestionFromForm();
  const source = questions[currentQuestionIndex];
  const nextId = level.chests.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
  const duplicate = deepClone(source);
  duplicate.id = nextId;
  questions.splice(currentQuestionIndex + 1, 0, duplicate);
  currentQuestionIndex++;
  modifiedLevels.add(currentLevelIdx);
  renderQuestionPanel();
  updateStats();
}

function triggerImportQuestions() {
  document.getElementById('question-import-file').click();
}

function importQuestions(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = reader.result;
      const json = JSON.parse(raw);
      let imported = [];
      if (Array.isArray(json)) {
        imported = json;
      } else if (Array.isArray(json.chests)) {
        imported = json.chests;
      } else if (Array.isArray(json.questions)) {
        imported = json.questions;
      } else {
        throw new Error('Invalid JSON structure');
      }

      const level = levels[currentLevelIdx];
      if (!level) return;
      syncQuestionFromForm();
      if (!Array.isArray(level.chests)) level.chests = [];

      imported.forEach(item => {
        const nextId = level.chests.reduce((max, q) => Math.max(max, q.id || 0), 0) + 1;
        const options = Array.isArray(item.options) ? item.options.slice(0, 4) : [];
        while (options.length < 4) options.push('');
        level.chests.push({
          id: nextId,
          question: item.question || item.text || item.q?.text || '',
          code: item.code || item.q?.code || '',
          options,
          correct: Number.isInteger(item.correct) ? item.correct : Number(item.correct) || 0,
          hint: item.hint || item.q?.hint || '',
          reward: {
            label: item.reward?.label || item.reward || `Reward ${nextId}`,
            code: item.reward?.code || '',
          },
        });
      });

      modifiedLevels.add(currentLevelIdx);
      currentQuestionIndex = Math.max(0, level.chests.length - imported.length);
      renderQuestionPanel();
      updateStats();
      showNotify(`IMPORTED ${imported.length} QUESTIONS ✓`);
    } catch (err) {
      console.error(err);
      showNotify('INVALID JSON FILE', true);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function deleteQuestion() {
  const questions = getLevelQuestions();
  if (!questions.length) return;
  if (!confirm('Удалить текущий вопрос?')) return;
  questions.splice(currentQuestionIndex, 1);
  if (currentQuestionIndex >= questions.length) currentQuestionIndex = questions.length - 1;
  modifiedLevels.add(currentLevelIdx);
  renderQuestionPanel();
  updateStats();
}

//  LEVEL SELECT / MANAGEMENT
function updateLevelMetaForm() {
  const lv = levels[currentLevelIdx];
  if (!lv) return;
  document.getElementById('level-name-field').value = lv.name || '';
  document.getElementById('level-title-field').value = lv.title || lv.name || '';
}

function syncLevelMetaFromForm() {
  const lv = levels[currentLevelIdx];
  if (!lv) return;
  const name = document.getElementById('level-name-field').value.trim();
  const title = document.getElementById('level-title-field').value.trim();
  if (name) lv.name = name;
  lv.title = title || lv.name;
  document.getElementById('cur-level-name').textContent = lv.name;
  modifiedLevels.add(currentLevelIdx);
  rebuildLevelList();
}

function deleteLevel() {
  if (levels.length <= 1) {
    showNotify('Нельзя удалить последний уровень', true);
    return;
  }
  const lv = levels[currentLevelIdx];
  if (!confirm(`Удалить уровень "${lv.name}"?`)) return;
  const deletedLevelNumber = Number.isInteger(lv.level) ? lv.level : (currentLevelIdx + 1);
  fetch('pixelgame_editor_save.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete_level', level_number: deletedLevelNumber }),
  }).then(r => r.json()).then(data => {
    if (!data || !data.ok) showNotify('✕ Не удалось удалить в БД', true);
  }).catch(() => showNotify('✕ Не удалось удалить в БД', true));
  levels.splice(currentLevelIdx, 1);
  const nextIndex = Math.max(0, currentLevelIdx - 1);
  currentLevelIdx = nextIndex;
  rebuildLevelList();
  selectLevel(currentLevelIdx);
  showNotify('LEVEL DELETED');
}

function selectLevel(idx) {
  currentLevelIdx = idx;
  const lv = levels[idx];
  document.getElementById('cur-level-name').textContent = lv.name;
  document.getElementById('sz-w').value = lv.map[0]?.length || 20;
  document.getElementById('sz-h').value = lv.map.length || 15;
  rebuildLevelList();
  renderMap();
  updateStats();
  renderQuestionPanel();
  updateLevelMetaForm();
}

function addLevel() {
  const name = prompt('Название уровня:', `Level ${levels.length+1}`);
  if (!name) return;
  const w=20, h=15;
  const map = Array.from({length:h}, (_,r) =>
    Array.from({length:w}, (_,c) =>
      (r===0||r===h-1||c===0||c===w-1) ? 1 : 0
    )
  );
  map[1][1] = 2;
  map[h-2][w-2] = 3;
  levels.push({
    level: levels.length + 1,
    name,
    title: name,
    map,
    chests: [],
    final: null,
  });
  selectLevel(levels.length - 1);
  showNotify(`LEVEL "${name}" CREATED`);
}

function resizeMap() {
  const w = Math.max(5, Math.min(60, parseInt(document.getElementById('sz-w').value)||20));
  const h = Math.max(5, Math.min(40, parseInt(document.getElementById('sz-h').value)||15));
  if (!confirm(`Resize to ${w}×${h}? Карта будет очищена.`)) return;
  const map = Array.from({length:h}, (_,r) =>
    Array.from({length:w}, (_,c) =>
      (r===0||r===h-1||c===0||c===w-1) ? 1 : 0
    )
  );
  map[1][1] = 2;
  map[h-2][w-2] = 3;
  levels[currentLevelIdx].map = map;
  modifiedLevels.add(currentLevelIdx);
  rebuildLevelList();
  renderMap();
  updateStats();
}

function resetLevel() {
  if (!confirm('Сбросить уровень к последнему сохранению?')) return;
  loadLevels();
  modifiedLevels.delete(currentLevelIdx);
  selectLevel(Math.min(currentLevelIdx, levels.length-1));
  showNotify('LEVEL RESET');
}

//  SAVE / EXPORT
function saveLevel() {
  syncQuestionFromForm();
  const lv = levels[currentLevelIdx];
  let hasPlayer=false, hasExit=false, chestTiles=0;
  for (const row of lv.map) for (const t of row) {
    if (t===2) hasPlayer=true;
    if (t===3) hasExit=true;
    if (t===5) chestTiles++;
  }
  const questionCount = Array.isArray(lv.chests) ? lv.chests.length : 0;
  if (!hasPlayer || !hasExit) {
    showNotify('✕ NEED PLAYER + EXIT!', true);
    return;
  }
  if (chestTiles !== questionCount) {
    showNotify(`✕ CHEST COUNT (${chestTiles}) ≠ QUESTIONS (${questionCount})`, true);
    return;
  }

  const levelNumber = Number.isInteger(lv.level) ? lv.level : (currentLevelIdx + 1);
  const payload = {
    action: 'save_level',
    level_number: levelNumber,
    level: {
      level: levelNumber,
      title: lv.title || lv.name,
      name: lv.name,
      map: lv.map,
      chests: Array.isArray(lv.chests) ? lv.chests : [],
      final: lv.final || null,
    },
  };

  return fetch('pixelgame_editor_save.php', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(data => {
      if (data && data.ok) {
        modifiedLevels.delete(currentLevelIdx);
        rebuildLevelList();
        showNotify('LEVEL SAVED ✓ (Postgres)');
        return true;
      }
      showNotify('✕ SAVE ERROR: ' + (data && data.error ? data.error : 'unknown'), true);
      return false;
    })
    .catch(() => { showNotify('✕ SAVE ERROR: нет связи с сервером', true); return false; });
}

function exportJSON() {
  const data = JSON.stringify(levels, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gamecode_levels.json';
  a.click();
  URL.revokeObjectURL(url);
  showNotify('EXPORTED ✓');
}

function gotoGame() {
  const result = saveLevel();
  const go = () => { window.location.href = '../games/pixelgame/index.html'; };
  if (result && typeof result.then === 'function') result.then(go); else go();
}

//  NOTIFY
let notifyTimer;
function showNotify(msg, isError=false) {
  const el = document.getElementById('notify');
  el.textContent = msg;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

//  UTILS
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// KEYBOARD SHORTCUTS
document.addEventListener('keydown', e => {
  if (document.getElementById('admin-panel').style.display === 'none') return;
  if (e.target.tagName === 'INPUT') return;
  const map = { '1':1, '2':0, '3':2, '4':3, '5':4, '6':5, 'e':6, 'E':6 };
  if (e.key in map) {
    const tileId = map[e.key];
    selectTool(tileId, TILES[tileId].name);
  }
  if ((e.ctrlKey || e.metaKey) && e.key==='s') {
    e.preventDefault();
    saveLevel();
  }
});
initAdmin();
</script>
</body>
</html>
