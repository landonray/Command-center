import React, { useState } from 'react';
import { api } from '../../utils/api';
import { useApp } from '../../context/AppContext';
import { Pause, Play, Square, Map, Zap, MoreVertical } from 'lucide-react';
import styles from './SessionControls.module.css';

export default function SessionControls({ sessionId, status, session }) {
  const { loadSessions } = useApp();
  const [showMenu, setShowMenu] = useState(false);
  const [planMode, setPlanMode] = useState(session?.plan_mode || false);
  const [autoAccept, setAutoAccept] = useState(session?.auto_accept || false);

  const handlePause = async () => {
    await api.post(`/api/sessions/${sessionId}/pause`);
    loadSessions();
  };

  const handleResume = async () => {
    await api.post(`/api/sessions/${sessionId}/resume`);
    loadSessions();
  };

  const handleEnd = async () => {
    if (confirm('End this session?')) {
      await api.post(`/api/sessions/${sessionId}/end`);
      loadSessions();
    }
  };

  const togglePlanMode = async () => {
    const newVal = !planMode;
    setPlanMode(newVal);
    await api.post(`/api/sessions/${sessionId}/plan-mode`, { enabled: newVal });
  };

  const toggleAutoAccept = async () => {
    const newVal = !autoAccept;
    setAutoAccept(newVal);
    await api.post(`/api/sessions/${sessionId}/auto-accept`, { enabled: newVal });
  };

  if (status === 'ended') return null;

  return (
    <div className={styles.controls}>
      {status === 'paused' ? (
        <button className="btn btn-ghost btn-sm" onClick={handleResume} title="Resume">
          <Play size={14} /> Resume
        </button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={handlePause} title="Pause">
          <Pause size={14} />
        </button>
      )}

      <button className="btn btn-ghost btn-sm" onClick={handleEnd} title="End session">
        <Square size={14} />
      </button>

      <div className={styles.menuWrapper}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowMenu(!showMenu)}>
          <MoreVertical size={14} />
        </button>

        {showMenu && (
          <>
            <div className={styles.menuBackdrop} onClick={() => setShowMenu(false)} />
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={togglePlanMode}>
                <Map size={14} />
                <span>Plan Mode</span>
                <span className={`${styles.indicator} ${planMode ? styles.on : ''}`} />
              </button>
              <button className={styles.menuItem} onClick={toggleAutoAccept}>
                <Zap size={14} />
                <span>Auto Accept</span>
                <span className={`${styles.indicator} ${autoAccept ? styles.on : ''}`} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
