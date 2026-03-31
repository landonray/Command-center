import React, { useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { User, Bot, Wrench, Loader, FileIcon, Download } from 'lucide-react';
import { formatDate } from '../../utils/format';
import MarkdownPreview from '../FileBrowser/MarkdownPreview';
import styles from './MessageList.module.css';

function MessageAttachments({ attachments }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={styles.attachments}>
      {attachments.map((file, i) => (
        <a
          key={file.id || i}
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.attachmentItem}
        >
          {file.isImage ? (
            <img src={file.url} alt={file.originalName} className={styles.attachmentImage} />
          ) : (
            <div className={styles.attachmentFile}>
              <FileIcon size={16} />
              <span className={styles.attachmentFileName}>{file.originalName}</span>
              <Download size={12} className={styles.attachmentDownload} />
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

export default function MessageList({ messages, loading, streamEvents }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
  }, []);

  // Instant scroll to bottom when messages load (session switch) or change significantly
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currCount = messages.length;
    prevMessageCountRef.current = currCount;

    // If messages changed by more than 1, it's likely a session switch — jump instantly
    if (Math.abs(currCount - prevCount) > 1 || prevCount === 0) {
      isNearBottomRef.current = true;
      if (containerRef.current) {
        // Use requestAnimationFrame to ensure DOM has rendered
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
        });
      }
    }
  }, [messages]);

  // Smooth scroll for incremental updates (new messages arriving one at a time)
  useLayoutEffect(() => {
    if (isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamEvents]);

  // Extract recent tool calls from stream events for indicators
  const recentTools = streamEvents
    .filter(e => e.type === 'tool_use')
    .slice(-5)
    .map(e => e.tool || e.name || 'tool');

  if (loading) {
    return (
      <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Loader size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef} onScroll={handleScroll}>
      {messages.length === 0 && (
        <div className="empty-state">
          <Bot size={32} />
          <p>Send a message to start the conversation</p>
        </div>
      )}

      {messages.map((msg, i) => (
        <div
          key={i}
          className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
        >
          <div className={styles.avatar}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          <div className={styles.content}>
            <div className={styles.meta}>
              <span className={styles.role}>{msg.role === 'user' ? 'You' : 'Claude'}</span>
              {msg.timestamp && (
                <span className={styles.time}>{formatDate(msg.timestamp)}</span>
              )}
            </div>
            {msg.attachments && msg.attachments.length > 0 && (
              <MessageAttachments attachments={msg.attachments} />
            )}
            <div className={styles.text}>
              {msg.role === 'assistant' && typeof msg.content === 'string' ? (
                <MarkdownPreview content={msg.content.trim()} />
              ) : (
                typeof msg.content === 'string' ? msg.content.trim() : msg.content
              )}
            </div>
            {msg.isResult && (
              <div className={styles.resultBadge}>Final Result</div>
            )}
          </div>
        </div>
      ))}

      {/* Tool call indicators */}
      {recentTools.length > 0 && (
        <div className={styles.toolIndicator}>
          <Wrench size={12} />
          <span>Using tools: {recentTools.join(', ')}</span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
