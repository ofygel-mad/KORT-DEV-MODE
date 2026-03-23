import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  WorkspaceEuler3D, WorkspaceModalSize, WorkspaceSceneMode,
  WorkspaceSceneTerrainMode, WorkspaceSceneTheme, WorkspaceTile,
  WorkspaceTileStatus, WorkspaceViewport, WorkspaceWidgetKind,
} from './types';

export const WORLD_FACTOR = 3;
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.08;
export const WORKSPACE_TILE_IDLE_MS = 15_000;

const VALID_WIDGET_KINDS = new Set<WorkspaceWidgetKind>(['leads','deals','tasks','customers','warehouse','chapan']);
const VALID_MODAL_SIZES = new Set<WorkspaceModalSize>(['compact','default','wide']);
const VALID_SCENE_THEMES = new Set<WorkspaceSceneTheme>(['default','morning','overcast','dusk','night']);
const VALID_SCENE_TERRAIN_MODES = new Set<WorkspaceSceneTerrainMode>(['full','calm','void']);
const VALID_TILE_STATUSES = new Set<WorkspaceTileStatus>(['floating','drifting','idle']);

const DEFAULT_TILE_SIZE: Record<WorkspaceWidgetKind, { width: number; height: number }> = {
  leads: { width: 280, height: 175 }, deals: { width: 260, height: 170 },
  tasks: { width: 260, height: 170 }, customers: { width: 260, height: 170 },
  warehouse: { width: 240, height: 155 }, chapan: { width: 270, height: 170 },
};
const TITLES: Record<WorkspaceWidgetKind, string> = {
  leads: 'Лиды', deals: 'Сделки', tasks: 'Задачи',
  customers: 'Клиенты', warehouse: 'Склад', chapan: 'Производство',
};
export const TILE_NAV: Record<WorkspaceWidgetKind, string> = {
  leads: '/crm/leads', deals: '/crm/deals', tasks: '/crm/tasks',
  customers: '/crm/customers', warehouse: '/warehouse', chapan: '/workzone/chapan',
};

interface ContextMenuState { tileId: string; x: number; y: number; }
interface PersistedWorkspaceState {
  tiles?: unknown; viewport?: unknown; viewportReady?: unknown;
  zoom?: unknown; topZIndex?: unknown; sceneTheme?: unknown; sceneTerrainMode?: unknown;
}
interface WorkspaceStore {
  tiles: WorkspaceTile[]; viewport: WorkspaceViewport; viewportSize: { width: number; height: number };
  viewportReady: boolean; hoveredTileId: string | null; zoom: number; contextMenu: ContextMenuState | null;
  topZIndex: number; sceneTheme: WorkspaceSceneTheme; sceneThemeAuto: boolean; sceneMode: WorkspaceSceneMode;
  sceneTerrainMode: WorkspaceSceneTerrainMode;
  addTile: (kind: WorkspaceWidgetKind) => string;
  alignTilesToGrid: () => void;
  setTilePosition: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;
  removeTile: (id: string) => void;
  renameTile: (id: string, title: string) => void;
  setViewport: (x: number, y: number) => void;
  initializeViewport: (width: number, height: number) => void;
  setZoom: (zoom: number) => void; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void;
  setHoveredTile: (id: string | null) => void;
  markTileActive: (id: string, opts?: { rotation3D?: Partial<WorkspaceEuler3D>; status?: WorkspaceTileStatus }) => void;
  updateIdleTiles: () => void;
  openContextMenu: (tileId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  setSceneTheme: (theme: WorkspaceSceneTheme) => void;
  setSceneThemeAuto: (auto: boolean) => void;
  setSceneMode: (mode: WorkspaceSceneMode) => void;
  setSceneTerrainMode: (mode: WorkspaceSceneTerrainMode) => void;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(Math.max(v, lo), hi); }
function isWorkspaceWidgetKind(v: unknown): v is WorkspaceWidgetKind { return typeof v === 'string' && VALID_WIDGET_KINDS.has(v as WorkspaceWidgetKind); }
function isWorkspaceModalSize(v: unknown): v is WorkspaceModalSize { return typeof v === 'string' && VALID_MODAL_SIZES.has(v as WorkspaceModalSize); }
function isWorkspaceSceneTheme(v: unknown): v is WorkspaceSceneTheme { return typeof v === 'string' && VALID_SCENE_THEMES.has(v as WorkspaceSceneTheme); }
function isWorkspaceSceneTerrainMode(v: unknown): v is WorkspaceSceneTerrainMode { return typeof v === 'string' && VALID_SCENE_TERRAIN_MODES.has(v as WorkspaceSceneTerrainMode); }
function isWorkspaceTileStatus(v: unknown): v is WorkspaceTileStatus { return typeof v === 'string' && VALID_TILE_STATUSES.has(v as WorkspaceTileStatus); }
function toFiniteNumber(v: unknown, fb: number) { return typeof v === 'number' && Number.isFinite(v) ? v : fb; }
function toPositiveNumber(v: unknown, fb: number) { return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fb; }
function toIsoString(v: unknown, fb: string) { return typeof v === 'string' && !Number.isNaN(new Date(v).getTime()) ? v : fb; }
function nowIsoString() { return new Date().toISOString(); }
function deriveTile3DRotation(s: WorkspaceTileStatus): WorkspaceEuler3D {
  if (s === 'drifting') return { x: -0.14, y: 0.12, z: -0.04 };
  if (s === 'idle') return { x: -0.08, y: 0.02, z: 0 };
  return { x: -0.03, y: 0, z: 0 };
}
function sanitizeEuler3D(v: unknown, fb: WorkspaceEuler3D): WorkspaceEuler3D {
  if (!v || typeof v !== 'object') return fb;
  const n = v as Partial<WorkspaceEuler3D>;
  return { x: toFiniteNumber(n.x, fb.x), y: toFiniteNumber(n.y, fb.y), z: toFiniteNumber(n.z, fb.z) };
}
function getWorldBounds(w: number, h: number) { return { width: Math.max(0, w * WORLD_FACTOR), height: Math.max(0, h * WORLD_FACTOR) }; }
function clampAxisWithinWorld(v: number, s: number, ws: number) { return clamp(v, 0, Math.max(0, ws - s)); }
export function getVisibleWorldRect(vp: WorkspaceViewport, vs: { width: number; height: number }, zoom: number) {
  const world = getWorldBounds(vs.width, vs.height); const sz = Math.max(zoom, 0.001);
  const left = clamp(-vp.x / sz, 0, world.width); const top = clamp(-vp.y / sz, 0, world.height);
  const right = clamp((vs.width - vp.x) / sz, 0, world.width); const bottom = clamp((vs.height - vp.y) / sz, 0, world.height);
  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
export function getTileViewportBounds(vp: WorkspaceViewport, vs: { width: number; height: number }, zoom: number, ts: { width: number; height: number }) {
  const world = getWorldBounds(vs.width, vs.height); const visible = getVisibleWorldRect(vp, vs, zoom);
  const maxX = Math.max(0, world.width - ts.width); const maxY = Math.max(0, world.height - ts.height);
  const minX = clamp(visible.left, 0, maxX); const minY = clamp(visible.top, 0, maxY);
  const vmX = clamp(visible.right - ts.width, 0, maxX); const vmY = clamp(visible.bottom - ts.height, 0, maxY);
  return { minX: Math.min(minX, vmX), maxX: Math.max(minX, vmX), minY: Math.min(minY, vmY), maxY: Math.max(minY, vmY) };
}
export function clampViewportToBounds(vp: WorkspaceViewport, w: number, h: number, zoom = 1): WorkspaceViewport {
  const world = getWorldBounds(w, h);
  return { x: clamp(vp.x, Math.min(0, w - world.width * zoom), 0), y: clamp(vp.y, Math.min(0, h - world.height * zoom), 0) };
}
export function clampTileToWorldBounds(tile: WorkspaceTile, w: number, h: number): WorkspaceTile {
  const world = getWorldBounds(w, h);
  const nx = clampAxisWithinWorld(tile.x, tile.width, world.width);
  const ny = clampAxisWithinWorld(tile.y, tile.height, world.height);
  if (nx === tile.x && ny === tile.y) return tile;
  return { ...tile, x: nx, y: ny };
}
function sanitizeTile(raw: unknown, fbZ: number): WorkspaceTile | null {
  if (!raw || typeof raw !== 'object') return null;
  const tile = raw as Partial<WorkspaceTile>;
  if (!isWorkspaceWidgetKind(tile.kind)) return null;
  const size = DEFAULT_TILE_SIZE[tile.kind]; const fbc = new Date().toISOString();
  const zIndex = Math.max(1, Math.round(toFiniteNumber(tile.zIndex, fbZ)));
  const status = isWorkspaceTileStatus(tile.status) ? tile.status : 'floating';
  const legacyTitle = typeof tile.title === 'string' ? tile.title.trim() : '';
  const title = tile.kind === 'chapan'
    ? 'Производство'
    : legacyTitle || TITLES[tile.kind];
  return {
    id: typeof tile.id === 'string' && tile.id.trim() ? tile.id : nanoid(),
    kind: tile.kind, title,
    x: Math.max(0, toFiniteNumber(tile.x, 20)), y: Math.max(0, toFiniteNumber(tile.y, 20)),
    width: Math.max(160, toPositiveNumber(tile.width, size.width)), height: Math.max(120, toPositiveNumber(tile.height, size.height)),
    modalSize: isWorkspaceModalSize(tile.modalSize) ? tile.modalSize : 'default',
    version: Math.max(1, Math.round(toFiniteNumber(tile.version, 1))),
    createdAt: toIsoString(tile.createdAt, fbc), lastInteractionAt: toIsoString(tile.lastInteractionAt, fbc),
    status, rotation3D: sanitizeEuler3D(tile.rotation3D, deriveTile3DRotation(status)),
    distance3D: 'mid', pinned: typeof tile.pinned === 'boolean' ? tile.pinned : false, zIndex,
  };
}
function sanitizeTiles(raw: unknown): WorkspaceTile[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t, i) => sanitizeTile(t, 10 + i)).filter((t): t is WorkspaceTile => t !== null);
}
function sanitizeViewport(raw: unknown): WorkspaceViewport {
  if (!raw || typeof raw !== 'object') return { x: 0, y: 0 };
  const v = raw as Partial<WorkspaceViewport>;
  return { x: toFiniteNumber(v.x, 0), y: toFiniteNumber(v.y, 0) };
}
export function sanitizeWorkspacePersistedState(p: unknown) {
  const persisted = (p ?? {}) as PersistedWorkspaceState;
  const tiles = sanitizeTiles(persisted.tiles);
  return {
    tiles, viewport: sanitizeViewport(persisted.viewport),
    viewportReady: typeof persisted.viewportReady === 'boolean' ? persisted.viewportReady : false,
    zoom: clamp(toFiniteNumber(persisted.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    topZIndex: Math.max(10, Math.round(toFiniteNumber(persisted.topZIndex, 10)), tiles.reduce((m, t) => Math.max(m, t.zIndex ?? 10), 10)),
    sceneTheme: isWorkspaceSceneTheme(persisted.sceneTheme) ? persisted.sceneTheme : 'morning',
    sceneTerrainMode: isWorkspaceSceneTerrainMode(persisted.sceneTerrainMode) ? persisted.sceneTerrainMode : 'full',
  };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      tiles: [], viewport: { x: 0, y: 0 }, viewportSize: { width: 0, height: 0 },
      viewportReady: false, hoveredTileId: null, zoom: 1, contextMenu: null,
      topZIndex: 10, sceneTheme: 'morning', sceneThemeAuto: false, sceneMode: 'surface', sceneTerrainMode: 'full',
      addTile: (kind) => {
        const { viewport, viewportSize, topZIndex, zoom } = get();
        const size = DEFAULT_TILE_SIZE[kind]; const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
        const bounds = getTileViewportBounds(viewport, viewportSize, zoom, size); const scatter = get().tiles.length;
        const id = nanoid(); const newZ = topZIndex + 1; const createdAt = nowIsoString();
        const bx = clamp(visible.left + visible.width/2 - size.width/2 + (scatter%4)*24-36, bounds.minX, bounds.maxX);
        const by = clamp(visible.top + visible.height/2 - size.height/2 + Math.floor(scatter/4)*24-12, bounds.minY, bounds.maxY);
        const tile: WorkspaceTile = { id, kind, title: TITLES[kind], x: bx, y: by, width: size.width, height: size.height,
          modalSize: 'default', version: 1, createdAt, lastInteractionAt: createdAt, status: 'floating',
          rotation3D: deriveTile3DRotation('floating'), distance3D: 'mid', pinned: false, zIndex: newZ };
        set((s) => ({ tiles: [...s.tiles, tile], topZIndex: newZ }));
        return id;
      },
      alignTilesToGrid: () => {
        const { tiles, viewport, viewportSize, zoom } = get();
        if (!tiles.length || viewportSize.width <= 0) return;
        const maxTW = Math.max(...tiles.map(t => t.width)); const maxTH = Math.max(...tiles.map(t => t.height));
        const gap = 24, pad = 20; const cols = Math.max(1, Math.floor((viewportSize.width - pad*2 + gap) / (maxTW + gap)));
        const ww = viewportSize.width * WORLD_FACTOR; const wh = viewportSize.height * WORLD_FACTOR;
        const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
        const sx = clamp(visible.left + pad, 0, Math.max(0, ww - maxTW)); const sy = clamp(visible.top + pad, 0, Math.max(0, wh - maxTH));
        set((s) => ({ tiles: s.tiles.map((t, i) => ({ ...t, x: clamp(sx + (i%cols)*(maxTW+gap), 0, Math.max(0, ww-t.width)), y: clamp(sy + Math.floor(i/cols)*(maxTH+gap), 0, Math.max(0, wh-t.height)) })) }));
      },
      setTilePosition: (id, x, y) => set((s) => ({ tiles: s.tiles.map(t => t.id===id ? { ...t, x, y, lastInteractionAt: nowIsoString(), status: 'floating', rotation3D: deriveTile3DRotation('floating') } : t) })),
      bringToFront: (id) => { const newZ = get().topZIndex + 1; set((s) => ({ tiles: s.tiles.map(t => t.id===id ? { ...t, zIndex: newZ, lastInteractionAt: nowIsoString(), status: 'floating', rotation3D: deriveTile3DRotation('floating') } : t), topZIndex: newZ })); },
      removeTile: (id) => set((s) => ({ tiles: s.tiles.filter(t => t.id!==id), hoveredTileId: s.hoveredTileId===id ? null : s.hoveredTileId, contextMenu: s.contextMenu?.tileId===id ? null : s.contextMenu })),
      renameTile: (id, title) => set((s) => ({ tiles: s.tiles.map(t => t.id===id ? { ...t, title: title.trim() || t.title } : t) })),
      setViewport: (x, y) => set((s) => ({ viewport: clampViewportToBounds({ x, y }, s.viewportSize.width, s.viewportSize.height, s.zoom) })),
      initializeViewport: (width, height) => set((s) => ({ viewportSize: { width, height }, viewport: clampViewportToBounds(s.viewportReady ? s.viewport : { x: 0, y: 0 }, width, height, s.zoom), tiles: width > 0 && height > 0 ? s.tiles.map(tile => clampTileToWorldBounds(tile, width, height)) : s.tiles, viewportReady: true })),
      setZoom: (zoom) => set((s) => { const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX); return { zoom: z, viewport: clampViewportToBounds(s.viewport, s.viewportSize.width, s.viewportSize.height, z) }; }),
      zoomIn: () => set((s) => { const z = clamp(+(s.zoom + ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX); return { zoom: z, viewport: clampViewportToBounds(s.viewport, s.viewportSize.width, s.viewportSize.height, z) }; }),
      zoomOut: () => set((s) => { const z = clamp(+(s.zoom - ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX); return { zoom: z, viewport: clampViewportToBounds(s.viewport, s.viewportSize.width, s.viewportSize.height, z) }; }),
      resetZoom: () => set((s) => ({ zoom: 1, viewport: clampViewportToBounds(s.viewport, s.viewportSize.width, s.viewportSize.height, 1) })),
      setHoveredTile: (id) => set({ hoveredTileId: id }),
      markTileActive: (id, opts) => set((s) => {
        const target = s.tiles.find(t => t.id === id); if (!target) return s;
        const ns = opts?.status ?? 'floating'; if (target.status === ns && !opts?.rotation3D) return s;
        return { tiles: s.tiles.map(tile => tile.id !== id ? tile : { ...tile, lastInteractionAt: nowIsoString(), status: ns, rotation3D: { ...deriveTile3DRotation(ns), ...opts?.rotation3D } }) };
      }),
      updateIdleTiles: () => set((s) => {
        const now = Date.now(); let changed = false;
        const tiles = s.tiles.map(tile => {
          const elapsed = now - new Date(tile.lastInteractionAt).getTime();
          const next: WorkspaceTileStatus = tile.pinned ? 'idle' : elapsed >= WORKSPACE_TILE_IDLE_MS ? 'drifting' : 'floating';
          if (next === tile.status) return tile;
          changed = true; return { ...tile, status: next, rotation3D: deriveTile3DRotation(next) };
        });
        return changed ? { tiles } : s;
      }),
      openContextMenu: (tileId, x, y) => set({ contextMenu: { tileId, x, y } }),
      closeContextMenu: () => set({ contextMenu: null }),
      setSceneTheme: (sceneTheme) => set({ sceneTheme, sceneThemeAuto: false }),
      setSceneThemeAuto: (sceneThemeAuto) => set({ sceneThemeAuto }),
      setSceneMode: (sceneMode) => set({ sceneMode }),
      setSceneTerrainMode: (sceneTerrainMode) => set({ sceneTerrainMode }),
    }),
    {
      name: 'kort-workspace',
      partialize: (s) => ({ tiles: s.tiles, viewport: s.viewport, viewportReady: s.viewportReady, zoom: s.zoom, topZIndex: s.topZIndex, sceneTheme: s.sceneTheme, sceneTerrainMode: s.sceneTerrainMode }),
      merge: (p, c) => ({ ...c, ...sanitizeWorkspacePersistedState(p) }),
    },
  ),
);
