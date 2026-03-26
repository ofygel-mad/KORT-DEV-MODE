import { useState } from 'react';
import { WorkspaceCanvas } from '../../features/workspace/components/WorkspaceCanvas';
import { WorkspaceAddMenu } from '../../features/workspace/components/WorkspaceAddMenu';
import { useWorkspaceStore } from '../../features/workspace/model/store';
import type { WorkspaceWidgetKind } from '../../features/workspace/model/types';
import styles from './Canvas.module.css';

export default function CanvasPage() {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addTile = useWorkspaceStore((s) => s.addTile);

  function handleAddTile(kind: WorkspaceWidgetKind) {
    addTile(kind);
  }

  return (
    <div className={styles.root}>
      <WorkspaceCanvas />

      {/* Add tile button */}
      <div className={styles.controls} data-workspace-ui="true">
        <button className={styles.addBtn} onClick={() => setAddMenuOpen(true)}>
          + Добавить ярлык
        </button>
      </div>

      <WorkspaceAddMenu
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        onSelect={handleAddTile}
      />
    </div>
  );
}
