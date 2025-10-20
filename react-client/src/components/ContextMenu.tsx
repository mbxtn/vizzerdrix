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
  const defaultOptions: ContextMenuOption[] = [
    { name: 'Dummy Option 1', action: onClose },
    { name: 'Dummy Option 2', action: onClose },
    { name: 'Dummy Option 3', action: onClose },
  ];
  const opts = options || defaultOptions;
  return (
    <>
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
      />
      <div
        style={{
          position: 'absolute',
          top: y,
          left: x,
          background: '#222',
          color: '#fff',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: 160,
          padding: '8px 0',
        }}
      >
        {opts.map((opt, idx) => (
          <div
            key={idx}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
            onClick={() => { opt.action(); onClose(); }}
          >
            {opt.name}
          </div>
        ))}
      </div>
    </>
  );
};
