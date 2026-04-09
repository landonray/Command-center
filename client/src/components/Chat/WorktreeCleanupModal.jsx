import React, { useState } from 'react';
import { AlertTriangle, GitCommit, Trash2, MinusCircle } from 'lucide-react';
import styles from './WorktreeCleanupModal.module.css';

export default function WorktreeCleanupModal({ onChoice, onClose }) {
  const [loading, setLoading] = useState(null);

  const handleChoice = async (choice) => {
    setLoading(choice);
    try {
      await onChoice(choice);
    } catch (e) {
      setLoading(null);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <AlertTriangle size={18} style={{ color: 'var(--warning, #f39c12)' }} />
          <h3>Uncommitted Changes</h3>
        </div>
        <div className={styles.body}>
          This session has uncommitted changes in the worktree. What would you like to do?
        </div>
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.commitBtn}`}
            onClick={() => handleChoice('commit')}
            disabled={loading !== null}
          >
            <GitCommit size={16} />
            <div>
              Commit & Keep Branch
              <div className={styles.actionDesc}>Save changes to the branch for future work</div>
            </div>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            onClick={() => handleChoice('delete')}
            disabled={loading !== null}
          >
            <Trash2 size={16} />
            <div>
              Delete Everything
              <div className={styles.actionDesc}>Discard changes and remove the branch permanently</div>
            </div>
          </button>

          <button
            className={`${styles.actionBtn} ${styles.leaveBtn}`}
            onClick={() => handleChoice('leave')}
            disabled={loading !== null}
          >
            <MinusCircle size={16} />
            <div>
              Leave As-Is
              <div className={styles.actionDesc}>End session without cleaning up</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
