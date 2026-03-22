import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { useBadgeStore } from '../../shared-bus/badge.store';
import { clearTileLeadsUI } from '../../leads-spa/model/tile-ui.store';
import { clearTileDealsUI } from '../../deals-spa/model/tile-ui.store';
import { clearTileTasksUI } from '../../tasks-spa/model/tile-ui.store';
import { clearTileChapanUI } from '../../chapan-spa/model/tile-ui.store';
import { clearTileProductionShell } from '../widgets/chapan/spa/production-shell.store';
import type {
  WorkspaceEuler3D,
  WorkspaceModalSize,
  WorkspaceSceneMode,
  WorkspaceSceneTerrainMode,
  WorkspaceSceneTheme,
  WorkspaceTile,
  WorkspaceTileStatus,
  WorkspaceViewport,
  WorkspaceWidgetKind,
} from './types';

export const WORLD_FACTOR = 3;
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.08;
export const WORKSPACE_TILE_IDLE_MS = 15_000;

const VALID_WIDGET_KINDS = new Set<WorkspaceWidgetKind>([
  'customers',
  'deals',
  'tasks',
  'reports',
  'imports',
  'chapan',
  'requests',
]);

const VALID_MODAL_SIZES = new Set<WorkspaceModalSize>(['compact', 'default', 'wide']);
const VALID_SCENE_THEMES = new Set<WorkspaceSceneTheme>(['default', 'morning', 'overcast', 'dusk', 'night']);
const VALID_SCENE_TERRAIN_MODES = new Set<WorkspaceSceneTerrainMode>(['full', 'calm', 'void']);
const VALID_TILE_STATUSES = new Set<WorkspaceTileStatus>(['floating', 'drifting', 'idle']);

const DEFAULT_TILE_SIZE: Record<WorkspaceWidgetKind, { width: number; height: number }> = {
  customers: { width: 280, height: 175 },
  deals:     { width: 260, height: 170 },
  tasks:     { width: 260, height: 170 },
  reports:   { width: 240, height: 155 },
  imports:   { width: 240, height: 155 },
  chapan:    { width: 260, height: 170 },
  requests:  { width: 270, height: 170 },
};

const TITLES: Record<WorkspaceWidgetKind, string> = {
  customers: 'Лиды',
  deals:     'Сделки',
  tasks:     'Задачи',
  reports:   'Сводка',
  imports:   'Импорт',
  chapan:    'Производство',
  requests:  'Заявки',
};

interface ContextMenuState {
  tileId: string;
  x: number;
  y: number;
}

interface PersistedWorkspaceState {
  tiles?: unknown;
  viewport?: unknown;
  viewportReady?: unknown;
  zoom?: unknown;
  topZIndex?: unknown;
  sceneTheme?: unknown;
  sceneTerrainMode?: unknown;
}

interface WorkspaceStore {
  tiles: WorkspaceTile[];
  viewport: WorkspaceViewport;
  viewportSize: { width: number; height: number };
  viewportReady: boolean;
  activeTileId: string | null;
  settingsTileId: string | null;
  recentTileId: string | null;
  hoveredTileId: string | null;
  zoom: number;
  contextMenu: ContextMenuState | null;
  topZIndex: number;
  sceneTheme: WorkspaceSceneTheme;
  sceneThemeAuto: boolean;
  sceneMode: WorkspaceSceneMode;
  sceneTerrainMode: WorkspaceSceneTerrainMode;

  addTile: (kind: WorkspaceWidgetKind) => string;
  duplicateTile: (id: string) => string | null;
  openWorkspaceTileByKind: (kind: WorkspaceWidgetKind, opts?: { createIfMissing?: boolean }) => string | null;
  alignTilesToGrid: () => void;
  setTilePosition: (id: string, x: number, y: number) => void;
  bringToFront: (id: string) => void;
  removeTile: (id: string) => void;
  renameTile: (id: string, title: string) => void;
  resizeModal: (id: string, size: WorkspaceModalSize) => void;
  reloadTile: (id: string) => void;
  openTile: (id: string) => void;
  minimizeTile: () => void;
  openSettings: (id: string) => void;
  closeSettings: () => void;
  setViewport: (x: number, y: number) => void;
  initializeViewport: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  pinTile: (id: string) => void;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isWorkspaceWidgetKind(value: unknown): value is WorkspaceWidgetKind {
  return typeof value === 'string' && VALID_WIDGET_KINDS.has(value as WorkspaceWidgetKind);
}

function isWorkspaceModalSize(value: unknown): value is WorkspaceModalSize {
  return typeof value === 'string' && VALID_MODAL_SIZES.has(value as WorkspaceModalSize);
}

function isWorkspaceSceneTheme(value: unknown): value is WorkspaceSceneTheme {
  return typeof value === 'string' && VALID_SCENE_THEMES.has(value as WorkspaceSceneTheme);
}

function isWorkspaceSceneTerrainMode(value: unknown): value is WorkspaceSceneTerrainMode {
  return typeof value === 'string' && VALID_SCENE_TERRAIN_MODES.has(value as WorkspaceSceneTerrainMode);
}

function isWorkspaceTileStatus(value: unknown): value is WorkspaceTileStatus {
  return typeof value === 'string' && VALID_TILE_STATUSES.has(value as WorkspaceTileStatus);
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toPositiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function toIsoString(value: unknown, fallback: string) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? value : fallback;
}

function getDefaultModalSize(kind: WorkspaceWidgetKind): WorkspaceModalSize {
  return kind === 'customers' || kind === 'deals' ? 'wide' : 'default';
}

function deriveTile3DRotation(status: WorkspaceTileStatus): WorkspaceEuler3D {
  if (status === 'drifting') {
    return { x: -0.14, y: 0.12, z: -0.04 };
  }

  if (status === 'idle') {
    return { x: -0.08, y: 0.02, z: 0 };
  }

  return { x: -0.03, y: 0, z: 0 };
}


function sanitizeEuler3D(value: unknown, fallback: WorkspaceEuler3D): WorkspaceEuler3D {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const next = value as Partial<WorkspaceEuler3D>;
  return {
    x: toFiniteNumber(next.x, fallback.x),
    y: toFiniteNumber(next.y, fallback.y),
    z: toFiniteNumber(next.z, fallback.z),
  };
}

function nowIsoString() {
  return new Date().toISOString();
}

function buildTile3DState(tile: Pick<WorkspaceTile, 'x' | 'y'> & Partial<Pick<WorkspaceTile, 'status'>>) {
  const status = tile.status ?? 'floating';
  return {
    status,
    rotation3D: deriveTile3DRotation(status),
  };
}

function getWorldBounds(width: number, height: number) {
  return {
    width: Math.max(0, width * WORLD_FACTOR),
    height: Math.max(0, height * WORLD_FACTOR),
  };
}

function clampAxisWithinWorld(value: number, itemSize: number, worldSize: number) {
  return clamp(value, 0, Math.max(0, worldSize - itemSize));
}

export function getVisibleWorldRect(
  viewport: WorkspaceViewport,
  viewportSize: { width: number; height: number },
  zoom: number,
) {
  const world = getWorldBounds(viewportSize.width, viewportSize.height);
  const safeZoom = Math.max(zoom, 0.001);

  const left = clamp(-viewport.x / safeZoom, 0, world.width);
  const top = clamp(-viewport.y / safeZoom, 0, world.height);
  const right = clamp((viewportSize.width - viewport.x) / safeZoom, 0, world.width);
  const bottom = clamp((viewportSize.height - viewport.y) / safeZoom, 0, world.height);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function getTileViewportBounds(
  viewport: WorkspaceViewport,
  viewportSize: { width: number; height: number },
  zoom: number,
  tileSize: { width: number; height: number },
) {
  const world = getWorldBounds(viewportSize.width, viewportSize.height);
  const visible = getVisibleWorldRect(viewport, viewportSize, zoom);
  const maxX = Math.max(0, world.width - tileSize.width);
  const maxY = Math.max(0, world.height - tileSize.height);
  const minX = clamp(visible.left, 0, maxX);
  const minY = clamp(visible.top, 0, maxY);
  const visibleMaxX = clamp(visible.right - tileSize.width, 0, maxX);
  const visibleMaxY = clamp(visible.bottom - tileSize.height, 0, maxY);

  return {
    minX: Math.min(minX, visibleMaxX),
    maxX: Math.max(minX, visibleMaxX),
    minY: Math.min(minY, visibleMaxY),
    maxY: Math.max(minY, visibleMaxY),
  };
}

export function clampViewportToBounds(
  viewport: WorkspaceViewport,
  width: number,
  height: number,
  zoom = 1,
): WorkspaceViewport {
  const world = getWorldBounds(width, height);
  const minX = Math.min(0, width - world.width * zoom);
  const minY = Math.min(0, height - world.height * zoom);

  return {
    x: clamp(viewport.x, minX, 0),
    y: clamp(viewport.y, minY, 0),
  };
}

export function clampTileToWorldBounds(tile: WorkspaceTile, width: number, height: number): WorkspaceTile {
  const world = getWorldBounds(width, height);
  const nextX = clampAxisWithinWorld(tile.x, tile.width, world.width);
  const nextY = clampAxisWithinWorld(tile.y, tile.height, world.height);

  if (nextX === tile.x && nextY === tile.y) {
    return tile;
  }

  return {
    ...tile,
    x: nextX,
    y: nextY,
  };
}

function sanitizeTile(rawTile: unknown, fallbackZIndex: number): WorkspaceTile | null {
  if (!rawTile || typeof rawTile !== 'object') return null;

  const tile = rawTile as Partial<WorkspaceTile>;
  if (!isWorkspaceWidgetKind(tile.kind)) return null;

  const size = DEFAULT_TILE_SIZE[tile.kind];
  const fallbackCreatedAt = new Date().toISOString();
  const zIndex = Math.max(1, Math.round(toFiniteNumber(tile.zIndex, fallbackZIndex)));
  const status = isWorkspaceTileStatus(tile.status) ? tile.status : 'floating';
  const fallbackRotation3D = deriveTile3DRotation(status);
  const title = typeof tile.title === 'string' && tile.title.trim()
    ? tile.title.trim() === 'Чапан' && tile.kind === 'chapan'
      ? TITLES[tile.kind]
      : tile.title.trim()
    : TITLES[tile.kind];

  return {
    id: typeof tile.id === 'string' && tile.id.trim() ? tile.id : nanoid(),
    kind: tile.kind,
    title,
    x: Math.max(0, toFiniteNumber(tile.x, 20)),
    y: Math.max(0, toFiniteNumber(tile.y, 20)),
    width: Math.max(160, toPositiveNumber(tile.width, size.width)),
    height: Math.max(120, toPositiveNumber(tile.height, size.height)),
    modalSize: isWorkspaceModalSize(tile.modalSize) ? tile.modalSize : getDefaultModalSize(tile.kind),
    version: Math.max(1, Math.round(toFiniteNumber(tile.version, 1))),
    createdAt: toIsoString(tile.createdAt, fallbackCreatedAt),
    lastInteractionAt: toIsoString(tile.lastInteractionAt, fallbackCreatedAt),
    status,
    rotation3D: sanitizeEuler3D(tile.rotation3D, fallbackRotation3D),
    distance3D: 'mid',
    pinned: typeof tile.pinned === 'boolean' ? tile.pinned : false,
    zIndex,
  };
}

function sanitizeTiles(rawTiles: unknown): WorkspaceTile[] {
  if (!Array.isArray(rawTiles)) return [];

  return rawTiles
    .map((tile, index) => sanitizeTile(tile, 10 + index))
    .filter((tile): tile is WorkspaceTile => tile !== null);
}

function sanitizeViewport(rawViewport: unknown): WorkspaceViewport {
  if (!rawViewport || typeof rawViewport !== 'object') {
    return { x: 0, y: 0 };
  }

  const viewport = rawViewport as Partial<WorkspaceViewport>;
  return {
    x: toFiniteNumber(viewport.x, 0),
    y: toFiniteNumber(viewport.y, 0),
  };
}

function sanitizeTopZIndex(rawTopZIndex: unknown, tiles: WorkspaceTile[]) {
  const persistedTopZIndex = Math.round(toFiniteNumber(rawTopZIndex, 10));
  const tileTopZIndex = tiles.reduce((max, tile) => Math.max(max, tile.zIndex ?? 10), 10);
  return Math.max(10, persistedTopZIndex, tileTopZIndex);
}

export function sanitizeWorkspacePersistedState(persistedState: unknown) {
  const persisted = (persistedState ?? {}) as PersistedWorkspaceState;
  const tiles = sanitizeTiles(persisted.tiles);

  return {
    tiles,
    viewport: sanitizeViewport(persisted.viewport),
    viewportReady: typeof persisted.viewportReady === 'boolean' ? persisted.viewportReady : false,
    zoom: clamp(toFiniteNumber(persisted.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    topZIndex: sanitizeTopZIndex(persisted.topZIndex, tiles),
    sceneTheme: isWorkspaceSceneTheme(persisted.sceneTheme) ? persisted.sceneTheme : 'morning',
    sceneTerrainMode: isWorkspaceSceneTerrainMode(persisted.sceneTerrainMode) ? persisted.sceneTerrainMode : 'full',
  };
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      tiles: [],
      viewport: { x: 0, y: 0 },
      viewportSize: { width: 0, height: 0 },
      viewportReady: false,
      activeTileId: null,
      settingsTileId: null,
      recentTileId: null,
      hoveredTileId: null,
      zoom: 1,
      contextMenu: null,
      topZIndex: 10,
      sceneTheme: 'morning',
      sceneThemeAuto: false,
      sceneMode: 'surface',
      sceneTerrainMode: 'full',

      addTile: (kind) => {
        const { viewport, viewportSize, topZIndex, zoom } = get();
        const size = DEFAULT_TILE_SIZE[kind];
        const visibleRect = getVisibleWorldRect(viewport, viewportSize, zoom);
        const visibleBounds = getTileViewportBounds(viewport, viewportSize, zoom, size);
        const scatter = get().tiles.length;
        const offsetX = (scatter % 4) * 24 - 36;
        const offsetY = Math.floor(scatter / 4) * 24 - 12;
        const id = nanoid();
        const newZ = topZIndex + 1;
        const createdAt = nowIsoString();
        const visibleCenterX = visibleRect.left + visibleRect.width / 2 - size.width / 2;
        const visibleCenterY = visibleRect.top + visibleRect.height / 2 - size.height / 2;
        const baseX = clamp(visibleCenterX + offsetX, visibleBounds.minX, visibleBounds.maxX);
        const baseY = clamp(visibleCenterY + offsetY, visibleBounds.minY, visibleBounds.maxY);
        const tile3D = buildTile3DState({ x: baseX, y: baseY, status: 'floating' });
        const tile: WorkspaceTile = {
          id, kind, title: TITLES[kind],
          x: baseX,
          y: baseY,
          width: size.width, height: size.height,
          modalSize: (kind === 'customers' || kind === 'deals') ? 'wide' : 'default',
          version: 1, createdAt,
          lastInteractionAt: createdAt,
          status: tile3D.status,
          rotation3D: tile3D.rotation3D,
          distance3D: 'mid',
          pinned: false, zIndex: newZ,
        };
        set((state) => ({ tiles: [...state.tiles, tile], recentTileId: id, topZIndex: newZ }));
        setTimeout(() => { set((s) => (s.recentTileId === id ? { recentTileId: null } : {})); }, 3000);
        return id;
      },

      duplicateTile: (id) => {
        const state = get();
        const src = state.tiles.find(t => t.id === id);
        if (!src) return null;
        const visibleBounds = getTileViewportBounds(state.viewport, state.viewportSize, state.zoom, src);
        const newId = nanoid();
        const newZ = state.topZIndex + 1;
        const createdAt = nowIsoString();
        const nextX = clamp(src.x + 32, visibleBounds.minX, visibleBounds.maxX);
        const nextY = clamp(src.y + 32, visibleBounds.minY, visibleBounds.maxY);
        const tile3D = buildTile3DState({ x: nextX, y: nextY, status: 'floating' });
        const dup: WorkspaceTile = {
          ...src,
          id: newId,
          x: nextX,
          y: nextY,
          version: 1,
          createdAt,
          lastInteractionAt: createdAt,
          status: tile3D.status,
          rotation3D: tile3D.rotation3D,
          distance3D: 'mid',
          pinned: false,
          zIndex: newZ,
        };
        set((s) => ({ tiles: [...s.tiles, dup], recentTileId: newId, topZIndex: newZ }));
        setTimeout(() => { set((s) => (s.recentTileId === newId ? { recentTileId: null } : {})); }, 3000);
        return newId;
      },

      openWorkspaceTileByKind: (kind, opts) => {
        const createIfMissing = opts?.createIfMissing ?? true;
        const state = get();
        const existing = state.tiles
          .filter((tile) => tile.kind === kind)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (existing) { state.openTile(existing.id); return existing.id; }
        if (!createIfMissing) return null;
        const newTileId = state.addTile(kind);
        get().openTile(newTileId);
        return newTileId;
      },

      alignTilesToGrid: () => {
        const { tiles, viewport, viewportSize, zoom } = get();
        if (!tiles.length || viewportSize.width <= 0 || viewportSize.height <= 0) return;
        const maxTileWidth = Math.max(...tiles.map((t) => t.width));
        const maxTileHeight = Math.max(...tiles.map((t) => t.height));
        const gap = 24, outerPadding = 20;
        const colWidth = maxTileWidth + gap, rowHeight = maxTileHeight + gap;
        const columns = Math.max(1, Math.floor((viewportSize.width - outerPadding * 2 + gap) / colWidth));
        const worldWidth = viewportSize.width * WORLD_FACTOR;
        const worldHeight = viewportSize.height * WORLD_FACTOR;
        const visibleRect = getVisibleWorldRect(viewport, viewportSize, zoom);
        const startX = clamp(visibleRect.left + outerPadding, 0, Math.max(0, worldWidth - maxTileWidth));
        const startY = clamp(visibleRect.top + outerPadding, 0, Math.max(0, worldHeight - maxTileHeight));
        set((state) => ({
          tiles: state.tiles.map((tile, index) => {
            const col = index % columns, row = Math.floor(index / columns);
            return {
              ...tile,
              x: clamp(startX + col * colWidth, 0, Math.max(0, worldWidth - tile.width)),
              y: clamp(startY + row * rowHeight, 0, Math.max(0, worldHeight - tile.height)),
            };
          }),
        }));
      },

      setTilePosition: (id, x, y) => set((state) => ({
        tiles: state.tiles.map((t) => (t.id === id
          ? {
              ...t,
              x,
              y,
              lastInteractionAt: nowIsoString(),
              status: 'floating',
              rotation3D: deriveTile3DRotation('floating'),
            }
          : t)),
      })),

      bringToFront: (id) => {
        const newZ = get().topZIndex + 1;
        set((state) => ({
          tiles: state.tiles.map((t) => (t.id === id
            ? {
                ...t,
                zIndex: newZ,
                lastInteractionAt: nowIsoString(),
                status: 'floating',
                rotation3D: deriveTile3DRotation('floating'),
              }
            : t)),
          topZIndex: newZ,
        }));
      },

      removeTile: (id) => {
        clearTileLeadsUI(id); clearTileDealsUI(id); clearTileTasksUI(id); clearTileChapanUI(id); clearTileProductionShell(id);
        set((state) => ({
          tiles: state.tiles.filter((t) => t.id !== id),
          activeTileId: state.activeTileId === id ? null : state.activeTileId,
          settingsTileId: state.settingsTileId === id ? null : state.settingsTileId,
          hoveredTileId: state.hoveredTileId === id ? null : state.hoveredTileId,
          contextMenu: state.contextMenu?.tileId === id ? null : state.contextMenu,
        }));
      },

      renameTile: (id, title) => set((state) => ({
        tiles: state.tiles.map((t) => (t.id === id ? { ...t, title: title.trim() || t.title } : t)),
      })),

      resizeModal: (id, modalSize) => set((state) => ({
        tiles: state.tiles.map((t) => (t.id === id ? { ...t, modalSize } : t)),
      })),

      reloadTile: (id) => set((state) => ({
        tiles: state.tiles.map((t) => (t.id === id
          ? { ...t, version: t.version + 1, lastInteractionAt: nowIsoString(), status: 'floating' }
          : t)),
      })),

      openTile: (id) => {
        set({ activeTileId: id, contextMenu: null });
        const tile = get().tiles.find(t => t.id === id);
        if (tile && (tile.kind === 'customers' || tile.kind === 'deals')) {
          useBadgeStore.getState().clearBadge(tile.kind);
        }
        // bring to front visually
        get().bringToFront(id);
      },

      minimizeTile: () => set({ activeTileId: null, settingsTileId: null }),
      openSettings: (id) => set({ settingsTileId: id }),
      closeSettings: () => set({ settingsTileId: null }),
      setViewport: (x, y) => set((state) => ({
        viewport: clampViewportToBounds({ x, y }, state.viewportSize.width, state.viewportSize.height, state.zoom),
      })),
      initializeViewport: (width, height) => {
        set((s) => ({
          viewportSize: { width, height },
          viewport: clampViewportToBounds(s.viewportReady ? s.viewport : { x: 0, y: 0 }, width, height, s.zoom),
          tiles: width > 0 && height > 0
            ? s.tiles.map((tile) => clampTileToWorldBounds(tile, width, height))
            : s.tiles,
          viewportReady: true,
        }));
      },

      setZoom: (zoom) => set((state) => {
        const nextZoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
        return {
          zoom: nextZoom,
          viewport: clampViewportToBounds(state.viewport, state.viewportSize.width, state.viewportSize.height, nextZoom),
        };
      }),
      zoomIn:  () => set((state) => {
        const nextZoom = clamp(+(state.zoom + ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX);
        return {
          zoom: nextZoom,
          viewport: clampViewportToBounds(state.viewport, state.viewportSize.width, state.viewportSize.height, nextZoom),
        };
      }),
      zoomOut: () => set((state) => {
        const nextZoom = clamp(+(state.zoom - ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX);
        return {
          zoom: nextZoom,
          viewport: clampViewportToBounds(state.viewport, state.viewportSize.width, state.viewportSize.height, nextZoom),
        };
      }),
      resetZoom: () => set((state) => ({
        zoom: 1,
        viewport: clampViewportToBounds(state.viewport, state.viewportSize.width, state.viewportSize.height, 1),
      })),

      pinTile: (id) => set((state) => ({
        tiles: state.tiles.map((t) => (t.id === id
          ? { ...t, pinned: !t.pinned, lastInteractionAt: nowIsoString(), status: 'floating' }
          : t)),
      })),

      setHoveredTile: (id) => set({ hoveredTileId: id }),
      markTileActive: (id, opts) => set((state) => {
        const target = state.tiles.find(t => t.id === id);
        if (!target) return state;

        const nextStatus = opts?.status ?? 'floating';
        // Skip update if tile already has the target status and no custom rotation
        if (target.status === nextStatus && !opts?.rotation3D) return state;

        return {
          tiles: state.tiles.map((tile) => {
            if (tile.id !== id) return tile;
            return {
              ...tile,
              lastInteractionAt: nowIsoString(),
              status: nextStatus,
              rotation3D: {
                ...deriveTile3DRotation(nextStatus),
                ...opts?.rotation3D,
              },
            };
          }),
        };
      }),
      updateIdleTiles: () => set((state) => {
        const now = Date.now();
        let changed = false;
        const tiles = state.tiles.map((tile) => {
          const elapsed = now - new Date(tile.lastInteractionAt).getTime();
          const nextStatus: WorkspaceTileStatus =
            tile.pinned ? 'idle' : elapsed >= WORKSPACE_TILE_IDLE_MS ? 'drifting' : 'floating';

          if (nextStatus === tile.status) {
            return tile;
          }

          changed = true;
          return {
            ...tile,
            status: nextStatus,
            rotation3D: deriveTile3DRotation(nextStatus),
          };
        });

        return changed ? { tiles } : state;
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
      partialize: (state) => ({
        tiles: state.tiles,
        viewport: state.viewport,
        viewportReady: state.viewportReady,
        zoom: state.zoom,
        topZIndex: state.topZIndex,
        sceneTheme: state.sceneTheme,
        sceneTerrainMode: state.sceneTerrainMode,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeWorkspacePersistedState(persistedState),
      }),
    },
  ),
);
