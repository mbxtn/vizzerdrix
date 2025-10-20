import React from 'react';
import { UIConfig, defaultUIConfig, getCardDimensions, getZoneHeight } from '../config/ui';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: UIConfig;
  onConfigChange: (config: UIConfig) => void;
}

export function Settings({ isOpen, onClose, config, onConfigChange }: SettingsProps) {
  if (!isOpen) return null;

  const handleCardWidthChange = (width: number) => {
    const { height } = getCardDimensions(width);
    onConfigChange({
      ...config,
      card: {
        ...config.card,
        width,
        height,
      },
    });
  };

  const calculatedZoneHeight = getZoneHeight(config.card.height);

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>UI Settings</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        <div className="settings-content">
          <div className="setting-group">
            <label htmlFor="card-width">Card Width: {config.card.width}px</label>
            <input
              id="card-width"
              type="range"
              min="40"
              max="350"
              value={config.card.width}
              onChange={(e) => handleCardWidthChange(parseInt(e.target.value))}
            />
            <div className="setting-description">
              Card Height: {config.card.height}px<br/>
              Zone Height: {calculatedZoneHeight}px
            </div>
          </div>

          <div className="setting-group">
            <button 
              onClick={() => onConfigChange(defaultUIConfig)}
              className="reset-button"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const settingsStyles = `
  .settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .settings-modal {
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 8px;
    width: 400px;
    max-width: 90vw;
    color: white;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #444;
  }

  .settings-header h2 {
    margin: 0;
    font-size: 18px;
  }

  .close-button {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .settings-content {
    padding: 16px;
  }

  .setting-group {
    margin-bottom: 20px;
  }

  .setting-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: bold;
  }

  .setting-group input[type="range"] {
    width: 100%;
    height: 6px;
    background: #444;
    border-radius: 3px;
    outline: none;
    -webkit-appearance: none;
  }

  .setting-group input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #4CAF50;
    border-radius: 50%;
    cursor: pointer;
  }

  .setting-group input[type="range"]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #4CAF50;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }

  .setting-description {
    font-size: 12px;
    color: #ccc;
    margin-top: 4px;
  }

  .reset-button {
    background: #f44336;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .reset-button:hover {
    background: #d32f2f;
  }
`;