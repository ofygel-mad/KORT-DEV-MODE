import { memo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pin } from 'lucide-react';
import { WORKSPACE_WIDGET_MAP } from '../registry';
import { useWorkspaceStore } from '../model/store';
import type { WorkspaceTile as WorkspaceTileType } from '../model/types';
import styles from './Workspace.module.css';

interface Props {
  tile: WorkspaceTileType;
  presentation?: 'surface' | 'flight';
  flightLayout?: WorkspaceFlightTileLayout;
}

export interface WorkspaceFlightTileLayout {
  left: number;
  top: number;
  scale: number;
  opacity: number;
  blur: number;
  zIndex: number;
  visible: boolean;
}

const DRAG_THRESHOLD = 5;

export const WorkspaceTile = memo(function WorkspaceTile({ tile, presentation = 'surface', flightLayout }: Props) {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const hasDragged = useRef(false);

  const setTilePosition = useWorkspaceStore((s) => s.setTilePosition);
  const bringToFront = useWorkspaceStore((s) => s.bringToFront);
  const markTileActive = useWorkspaceStore((s) => s.markTileActive);
  const openContextMenu = useWorkspaceStore((s) => s.openContextMenu);
  const setHoveredTile = useWorkspaceStore((s) => s.setHoveredTile);
  const isHovered = useWorkspaceStore((s) => s.hoveredTileId === tile.id);

  const definition = WORKSPACE_WIDGET_MAP[tile.kind];
  if (!definition) return null;

  const Icon = definition.icon;
  const isFlightPresentation = presentation === 'flight';

  const style: React.CSSProperties = isFlightPresentation && flightLayout
    ? {
        position: 'absolute',
        left: flightLayout.left,
        top: flightLayout.top,
        transform: `scale(${flightLayout.scale})`,
        opacity: flightLayout.opacity,
        filter: flightLayout.blur > 0 ? `blur(${flightLayout.blur}px)` : undefined,
        zIndex: flightLayout.zIndex,
        transformOrigin: 'center center',
        pointerEvents: flightLayout.visible ? 'auto' : 'none',
        width: tile.width,
        height: tile.height,
      }
    : {
        position: 'absolute',
        left: tile.x,
        top: tile.y,
        width: tile.width,
        height: tile.height,
        zIndex: tile.zIndex ?? 10,
        cursor: dragging ? 'grabbing' : 'grab',
      };

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    hasDragged.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, tx: tile.x, ty: tile.y };
    bringToFront(tile.id);
    markTileActive(tile.id, { status: 'floating' });
    setDragging(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (!hasDragged.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      hasDragged.current = true;
      setDragging(true);
    }
    if (hasDragged.current) {
      setTilePosition(tile.id, Math.max(0, dragStart.current.tx + dx), Math.max(0, dragStart.current.ty + dy));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const wasDragging = hasDragged.current;
    dragStart.current = null;
    hasDragged.current = false;
    setDragging(false);
    if (!wasDragging) {
      // Navigate on click
      navigate(definition.navTo);
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    openContextMenu(tile.id, e.clientX, e.clientY);
  }

  return (
    <div
      data-tile-id={tile.id}
      className={`${styles.tile} ${isHovered ? styles.tileHovered : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHoveredTile(tile.id)}
      onMouseLeave={() => setHoveredTile(null)}
    >
      <div className={styles.tileInner} style={{ '--tile-color': definition.color } as React.CSSProperties}>
        <div className={styles.tileHeader}>
          <div className={styles.tileIconWrap}>
            <Icon size={16} />
          </div>
          <span className={styles.tileTitle}>{tile.title}</span>
          {tile.pinned && <Pin size={10} className={styles.tilePinIcon} />}
        </div>
        <p className={styles.tileDesc}>{definition.description}</p>
        <div className={styles.tileArrow}>
          <span>Открыть →</span>
        </div>
      </div>
    </div>
  );
});
