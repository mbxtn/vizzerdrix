import React from 'react';
import { UIConfig, defaultUIConfig, getCardDimensions, getZoneHeight } from '../config/ui';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  config: UIConfig;
  onConfigChange: (config: UIConfig) => void;
  onCardCreated: (name: string) => void;
}
import { useState } from "react";

// Simple reusable toggle switch component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
      <span>{label}</span>
      <span
        style={{
          width: 40,
          height: 22,
          background: checked ? '#4CAF50' : '#ccc',
          borderRadius: 12,
          position: 'relative',
          transition: 'background 0.2s',
          display: 'inline-block',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: checked ? 22 : 2,
            top: 2,
            width: 18,
            height: 18,
            background: '#fff',
            borderRadius: '50%',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ opacity: 0, width: 40, height: 22, position: 'absolute', left: 0, top: 0, margin: 0, cursor: 'pointer' }}
        />
      </span>
    </label>
  );
}
export function Settings({ isOpen, onClose, config, onConfigChange, onCardCreated }: SettingsProps) {
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
  const [activeTab, setActiveTab] = useState("ux");
  const TABS = [
    { label: "UX Controls", key: "ux" },
    { label: "Game Controls", key: "game" },
    { label: "Game Status", key: "status" },
  ];

  // Dialog state for card creation
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [cardNameInput, setCardNameInput] = useState("");

  const handleCreateCardClick = () => {
    setCardNameInput("");
    setShowCardDialog(true);
  };

  const handleCardDialogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNameInput.trim()) {
      onCardCreated(cardNameInput.trim());
      setShowCardDialog(false);
      onClose();
    }
  };

  const handleCardDialogCancel = () => {
    setShowCardDialog(false);
  };

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: "0.5rem 1rem",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #007bff" : "2px solid transparent",
                background: "none",
                fontWeight: activeTab === tab.key ? "bold" : "normal",
                cursor: "pointer",
                outline: "none",
                color: activeTab === tab.key ? "#007bff" : "#333",
                transition: "border-bottom 0.2s"
              }}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="settings-content">

          <div>
            {activeTab === "ux" && (
              <div>
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
                    Card Height: {config.card.height}px<br />
                    Zone Height: {calculatedZoneHeight}px
                  </div>
                </div>

                <div className="setting-group">
                  <ToggleSwitch
                    checked={!!config.card.magnifyOnHover}
                    onChange={checked => onConfigChange({
                      ...config,
                      card: {
                        ...config.card,
                        magnifyOnHover: checked,
                      },
                    })}
                    label="Show magnified copy of hovered card"
                  />
                {config.card.magnifyOnHover && (
                  <div>
                   <label htmlFor="magnify-width">Magnify Width: {config.card.magnifyWidth}px</label>
                  <input
                    id="magnify-width"
                    type="range"
                    min="200"
                    max="400"
                    value={config.card.magnifyWidth}
                    onChange={(e) => {
                        onConfigChange({
                          ...config,
                          card: {
                            ...config.card,
                            magnifyWidth: parseInt(e.target.value),
                          }
                        })
                    }}
                  />
                  </div>
                )}
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
            )}
            {activeTab === "game" && (
              <div>
                <div className="setting-group">
                  <button
                    onClick={handleCreateCardClick}
                    className="create-card-button"
                  >
                    Create a place-holder
                  </button>
                </div>
                {showCardDialog && (
                  <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0,0,0,0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2000
                  }}>
                    <form
                      onSubmit={handleCardDialogSubmit}
                      style={{
                        background: "#222",
                        padding: 24,
                        borderRadius: 8,
                        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        minWidth: 280
                      }}
                    >
                      <label htmlFor="card-name-input" style={{ color: "#fff" }}>Card Name:</label>
                      <input
                        id="card-name-input"
                        type="text"
                        value={cardNameInput}
                        onChange={e => setCardNameInput(e.target.value)}
                        autoFocus
                        style={{
                          padding: "8px 12px",
                          borderRadius: 4,
                          border: "1px solid #555",
                          fontSize: 16
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button type="button" onClick={handleCardDialogCancel} style={{
                          background: "#888",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 16px",
                          cursor: "pointer"
                        }}>Cancel</button>
                        <button type="submit" style={{
                          background: "#ff9800",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          padding: "6px 16px",
                          cursor: "pointer"
                        }}>Create</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
            {activeTab === "status" && (
              <div>
                {/* Add game status info here */}
              </div>
            )}
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

  .create-card-button {
    background: #ff9800;
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