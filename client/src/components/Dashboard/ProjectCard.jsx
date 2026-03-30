import React from 'react';
import { Folder } from 'lucide-react';
import styles from './ProjectCard.module.css';

export default function ProjectCard({ project, onClick, disabled }) {
  return (
    <button
      className={styles.card}
      onClick={onClick}
      disabled={disabled}
      title={project.path}
    >
      <Folder size={24} />
      <span className={styles.name}>{project.name}</span>
      <span className={styles.path}>{project.path}</span>
    </button>
  );
}
