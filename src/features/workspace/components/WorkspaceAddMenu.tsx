import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { WORKSPACE_WIDGETS } from '../registry';
import type { WorkspaceWidgetKind } from '../model/types';
import styles from './Workspace.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: WorkspaceWidgetKind) => void;
}

export function WorkspaceAddMenu({ open, onClose, onSelect }: Props) {
  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="menu-overlay" className={styles.menuOverlay}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }} onClick={onClose}
          />
          <motion.div key="menu-panel" className={styles.menuPanel}
            role="dialog" aria-modal="true" aria-label="Добавить плитку"
            initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.75 }}
          >
            <div className={styles.menuHeader}>
              <div className={styles.menuHeaderLeft}>
                <span className={styles.menuEyebrow}>Плитки</span>
                <h2 className={styles.menuTitle}>Добавить ярлык</h2>
              </div>
              <button className={styles.menuClose} onClick={onClose} aria-label="Закрыть"><X size={15} /></button>
            </div>
            <div className={styles.menuDivider} />
            <div className={styles.menuGrid}>
              {WORKSPACE_WIDGETS.map((widget) => {
                const Icon = widget.icon;
                return (
                  <motion.button key={widget.kind} className={styles.menuCard}
                    onClick={() => { onSelect(widget.kind); onClose(); }}
                    whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                    transition={{ type: 'spring', stiffness: 440, damping: 26 }}
                  >
                    <div className={styles.menuCardIconWrap} style={{ color: widget.color }}><Icon size={18} /></div>
                    <div className={styles.menuCardBody}>
                      <strong className={styles.menuCardTitle}>{widget.title}</strong>
                      <span className={styles.menuCardDesc}>{widget.description}</span>
                    </div>
                    <span className={styles.menuCardArrow}>›</span>
                  </motion.button>
                );
              })}
            </div>
            <p className={styles.menuFooterHint}>Клик по плитке — переход к модулю.</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
  return createPortal(content, document.body);
}
