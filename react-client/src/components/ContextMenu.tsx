import React from 'react';

export interface ContextMenuOption {
  name: string;
  action: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  options?: ContextMenuOption[];
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, options }) => {
  // Add hover state for menu options
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const defaultOptions: ContextMenuOption[] = [
    { name: 'Dummy Option 1', action: onClose },
    { name: 'Dummy Option 2', action: onClose },
    { name: 'Dummy Option 3', action: onClose },
  ];
  const opts = options || defaultOptions;

  // Menu dimensions (should match your style)
  const MENU_WIDTH = 180; // px
  const MENU_HEIGHT = opts.length * 40 + 16; // px, estimate 40px per option + padding
  const PADDING = 8; // px

  // Calculate adjusted position to keep menu in viewport
  let adjustedX = x;
  let adjustedY = y;
  if (typeof window !== 'undefined') {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    if (x + MENU_WIDTH + PADDING > winW) {
      adjustedX = x - (MENU_WIDTH + PADDING)
    }
    if (y + MENU_HEIGHT + PADDING > winH) {
      adjustedY = y - (MENU_HEIGHT + PADDING);
    }
  }

  return (
    <React.Fragment>
      {/* Overlay div to catch outside clicks */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999,
          background: 'transparent',
        }}
        onClick={onClose}
      ></div>
      <div
        style={{
          position: 'absolute',
          top: adjustedY,
          left: adjustedX,
          background: '#222',
          color: '#fff',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: 160,
          width: MENU_WIDTH,
          padding: '8px 0',
        }}
      >
        {opts.map((opt, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: hoverIdx === idx ? '#444' : 'none',
              color: hoverIdx === idx ? '#ff9800' : '#fff',
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={() => { opt.action(); onClose(); }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {opt.name}
          </div>
        ))}
      </div>
    </React.Fragment>
  );
};
