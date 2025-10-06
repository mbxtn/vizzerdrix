/**
 * Settings Manager
 * Handles all game settings including:
 * - Settings state management
 * - UI updates and event listeners
 * - Local storage persistence
 * - Settings modal functionality
 */

export interface GameSettings {
    isMagnifyEnabled: boolean;
    isAutoFitEnabled: boolean;
    isAutoFocusEnabled: boolean;
    isGhostModeEnabled: boolean;
    isReverseGhostModeEnabled: boolean;
    isAutoUntapEnabled: boolean;
    isSnapToGridEnabled: boolean;
    isTabHoverPreviewEnabled: boolean;
    isEnhancedImageQualityEnabled: boolean;
    magnifyPreviewWidth: number;
    currentCardSpacing: number;
    currentCardWidth: number;
    isSpacingSliderVisible: boolean;
}

export interface SettingsCallbacks {
    onMagnifyChange?: (enabled: boolean) => void;
    onAutoFitChange?: (enabled: boolean) => void;
    onAutoFocusChange?: (enabled: boolean) => void;
    onGhostModeChange?: (enabled: boolean) => void;
    onReverseGhostModeChange?: (enabled: boolean) => void;
    onAutoUntapChange?: (enabled: boolean) => void;
    onSnapToGridChange?: (enabled: boolean) => void;
    onTabHoverPreviewChange?: (enabled: boolean) => void;
    onEnhancedImageQualityChange?: (enabled: boolean) => void;
    onMagnifyPreviewSizeChange?: (width: number, height: number) => void;
    savePersistentSettings?: () => void;
    showBottomBarContextMenu?: (event: any) => void;
    autoFitSevenCards?: (showNotification?: boolean) => void;
    updateImageQualityCutoffs?: (enabled: boolean) => void;
    updateGridVisuals?: () => void;
    debouncedRender?: () => void;
}

export class SettingsManager {
    private settings: GameSettings;
    private callbacks: SettingsCallbacks;
    
    // DOM elements
    private magnifyToggleBtn!: HTMLElement;
    private magnifyStatusEl!: HTMLElement;
    private autoFocusToggleBtn!: HTMLElement;
    private autoFocusStatusEl!: HTMLElement;
    private ghostModeToggleBtn!: HTMLElement;
    private ghostModeStatusEl!: HTMLElement;
    private reverseGhostModeToggleBtn!: HTMLElement;
    private reverseGhostModeStatusEl!: HTMLElement;
    private autoUntapToggleBtn!: HTMLElement;
    private autoUntapStatusEl!: HTMLElement;
    private enhancedImageQualityToggleBtn!: HTMLElement;
    private enhancedImageQualityStatusEl!: HTMLElement;
    private snapToGridToggleBtn!: HTMLElement;
    private snapToGridStatusEl!: HTMLElement;
    private tabHoverPreviewToggleBtn!: HTMLElement;
    private tabHoverPreviewStatusEl!: HTMLElement;
    private magnifySizeSliderContainer!: HTMLElement;
    private magnifySizeSlider!: HTMLInputElement;
    private toggleSpacingSliderBtn!: HTMLElement;
    private autoFitSevenCardsBtn!: HTMLElement;
    private autoFitStatus!: HTMLElement;
    private spacingSliderStatusEl!: HTMLElement;
    private cardSpacingSliderContainer!: HTMLElement;
    private bottomBarSettingsBtn!: HTMLElement;

    constructor() {
        this.settings = this.getDefaultSettings();
        this.callbacks = {};
        
        this.initializeElements();
        this.loadPersistentSettings();
        this.setupEventListeners();
        this.updateAllUI();
    }

    private getDefaultSettings(): GameSettings {
        return {
            isMagnifyEnabled: false,
            isAutoFitEnabled: false,
            isAutoFocusEnabled: true,
            isGhostModeEnabled: false,
            isReverseGhostModeEnabled: false,
            isAutoUntapEnabled: false,
            isSnapToGridEnabled: false,
            isTabHoverPreviewEnabled: false,
            isEnhancedImageQualityEnabled: false,
            magnifyPreviewWidth: 320,
            currentCardSpacing: 0,
            currentCardWidth: 80,
            isSpacingSliderVisible: true
        };
    }

    private initializeElements(): void {
        this.magnifyToggleBtn = document.getElementById('magnify-toggle-btn')!;
        this.magnifyStatusEl = document.getElementById('magnify-status')!;
        this.autoFocusToggleBtn = document.getElementById('auto-focus-toggle-btn')!;
        this.autoFocusStatusEl = document.getElementById('auto-focus-status')!;
        this.ghostModeToggleBtn = document.getElementById('ghost-mode-toggle-btn')!;
        this.ghostModeStatusEl = document.getElementById('ghost-mode-status')!;
        this.reverseGhostModeToggleBtn = document.getElementById('reverse-ghost-mode-toggle-btn')!;
        this.reverseGhostModeStatusEl = document.getElementById('reverse-ghost-mode-status')!;
        this.autoUntapToggleBtn = document.getElementById('auto-untap-toggle-btn')!;
        this.autoUntapStatusEl = document.getElementById('auto-untap-status')!;
        this.enhancedImageQualityToggleBtn = document.getElementById('enhanced-image-quality-toggle-btn')!;
        this.enhancedImageQualityStatusEl = document.getElementById('enhanced-image-quality-status')!;
        this.snapToGridToggleBtn = document.getElementById('snap-to-grid-toggle-btn')!;
        this.snapToGridStatusEl = document.getElementById('snap-to-grid-status')!;
        this.tabHoverPreviewToggleBtn = document.getElementById('tab-hover-preview-toggle-btn')!;
        this.tabHoverPreviewStatusEl = document.getElementById('tab-hover-preview-status')!;
        this.magnifySizeSliderContainer = document.getElementById('magnify-size-slider-container')!;
        this.magnifySizeSlider = document.getElementById('magnify-size-slider') as HTMLInputElement;
        this.toggleSpacingSliderBtn = document.getElementById('toggle-spacing-slider')!;
        this.autoFitSevenCardsBtn = document.getElementById('auto-fit-seven-cards-btn')!;
        this.autoFitStatus = document.getElementById('auto-fit-status')!;
        this.spacingSliderStatusEl = document.getElementById('spacing-slider-status')!;
        this.cardSpacingSliderContainer = document.getElementById('card-spacing-slider-container')!;
        this.bottomBarSettingsBtn = document.getElementById('bottom-bar-settings-btn')!;
    }

    private setupEventListeners(): void {
        // Magnify toggle
        this.magnifyToggleBtn?.addEventListener('click', () => {
            this.settings.isMagnifyEnabled = !this.settings.isMagnifyEnabled;
            this.updateMagnifyStatusUI();
            this.callbacks.onMagnifyChange?.(this.settings.isMagnifyEnabled);
            this.savePersistentSettings();
        });

        // Auto focus toggle
        this.autoFocusToggleBtn?.addEventListener('click', () => {
            this.settings.isAutoFocusEnabled = !this.settings.isAutoFocusEnabled;
            this.updateAutoFocusStatusUI();
            this.callbacks.onAutoFocusChange?.(this.settings.isAutoFocusEnabled);
            this.savePersistentSettings();
        });

        // Ghost mode toggle
        this.ghostModeToggleBtn?.addEventListener('click', () => {
            this.settings.isGhostModeEnabled = !this.settings.isGhostModeEnabled;
            this.updateGhostModeStatusUI();
            this.callbacks.onGhostModeChange?.(this.settings.isGhostModeEnabled);
            this.callbacks.debouncedRender?.();
            this.savePersistentSettings();
        });

        // Reverse ghost mode toggle
        this.reverseGhostModeToggleBtn?.addEventListener('click', () => {
            this.settings.isReverseGhostModeEnabled = !this.settings.isReverseGhostModeEnabled;
            this.updateReverseGhostModeStatusUI();
            this.callbacks.onReverseGhostModeChange?.(this.settings.isReverseGhostModeEnabled);
            this.callbacks.debouncedRender?.();
            this.savePersistentSettings();
        });

        // Auto untap toggle
        this.autoUntapToggleBtn?.addEventListener('click', () => {
            this.settings.isAutoUntapEnabled = !this.settings.isAutoUntapEnabled;
            this.updateAutoUntapStatusUI();
            this.callbacks.onAutoUntapChange?.(this.settings.isAutoUntapEnabled);
            this.savePersistentSettings();
        });

        // Enhanced image quality toggle
        this.enhancedImageQualityToggleBtn?.addEventListener('click', () => {
            this.settings.isEnhancedImageQualityEnabled = !this.settings.isEnhancedImageQualityEnabled;
            this.updateEnhancedImageQualityStatusUI();
            this.callbacks.onEnhancedImageQualityChange?.(this.settings.isEnhancedImageQualityEnabled);
            this.callbacks.updateImageQualityCutoffs?.(this.settings.isEnhancedImageQualityEnabled);
            this.savePersistentSettings();
        });

        // Snap to grid toggle
        this.snapToGridToggleBtn?.addEventListener('click', () => {
            this.settings.isSnapToGridEnabled = !this.settings.isSnapToGridEnabled;
            this.updateSnapToGridStatusUI();
            this.callbacks.onSnapToGridChange?.(this.settings.isSnapToGridEnabled);
            
            // Update global reference for backwards compatibility
            (window as any).isSnapToGridEnabled = this.settings.isSnapToGridEnabled;
            
            // Update play zones container with grid class
            const playZonesContainer = document.getElementById('play-zones-container');
            if (playZonesContainer) {
                if (this.settings.isSnapToGridEnabled) {
                    playZonesContainer.classList.add('snap-grid-enabled');
                } else {
                    playZonesContainer.classList.remove('snap-grid-enabled');
                }
            }
            
            this.callbacks.updateGridVisuals?.();
            this.savePersistentSettings();
        });

        // Tab hover preview toggle
        this.tabHoverPreviewToggleBtn?.addEventListener('click', () => {
            this.settings.isTabHoverPreviewEnabled = !this.settings.isTabHoverPreviewEnabled;
            this.updateTabHoverPreviewStatusUI();
            this.callbacks.onTabHoverPreviewChange?.(this.settings.isTabHoverPreviewEnabled);
            this.savePersistentSettings();
        });

        // Toggle spacing slider visibility
        this.toggleSpacingSliderBtn?.addEventListener('click', () => {
            this.settings.isSpacingSliderVisible = !this.settings.isSpacingSliderVisible;
            this.updateSpacingSliderVisibilityUI();
            this.savePersistentSettings();
        });

        // Auto-fit toggle
        this.autoFitSevenCardsBtn?.addEventListener('click', () => {
            this.settings.isAutoFitEnabled = !this.settings.isAutoFitEnabled;
            this.updateAutoFitStatusUI();
            this.callbacks.onAutoFitChange?.(this.settings.isAutoFitEnabled);
            if (this.settings.isAutoFitEnabled) {
                this.callbacks.autoFitSevenCards?.(false); // Show notification when manually enabled
            }
            this.savePersistentSettings();
        });

        // Bottom bar settings button
        this.bottomBarSettingsBtn?.addEventListener('click', (e) => {
            // Create a fake context menu event at the gear button's position
            const rect = this.bottomBarSettingsBtn.getBoundingClientRect();
            const fakeEvent = {
                clientX: rect.left,
                clientY: rect.bottom + 5,
                preventDefault: () => {}
            };
            this.callbacks.showBottomBarContextMenu?.(fakeEvent);
        });

        // Magnify size slider
        this.magnifySizeSlider?.addEventListener('input', (e) => {
            const width = parseInt((e.target as HTMLInputElement).value);
            this.settings.magnifyPreviewWidth = width;
            const height = Math.round(width * (107 / 80)); // Standard Magic card ratio
            
            // Update global variable for backwards compatibility
            (window as any).magnifyPreviewSize = {
                width: this.settings.magnifyPreviewWidth,
                height: height
            };
            
            this.callbacks.onMagnifyPreviewSizeChange?.(width, height);
        });

        this.magnifySizeSlider?.addEventListener('change', (e) => {
            const width = parseInt((e.target as HTMLInputElement).value);
            const height = Math.round(width * (107 / 80));
            
            // Update global variable for backwards compatibility
            (window as any).magnifyPreviewSize = {
                width: this.settings.magnifyPreviewWidth,
                height: height
            };
            
            this.savePersistentSettings();
        });
    }

    public setCallbacks(callbacks: SettingsCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    public getSettings(): GameSettings {
        return { ...this.settings };
    }

    public getSetting<K extends keyof GameSettings>(key: K): GameSettings[K] {
        return this.settings[key];
    }

    public setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
        this.settings[key] = value;
        this.updateAllUI();
        this.savePersistentSettings();
    }

    private loadPersistentSettings(): void {
        try {
            const savedSettings = localStorage.getItem('vizzerdrix-settings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                this.settings = { ...this.settings, ...parsedSettings };
                console.log('Loaded persistent settings:', this.settings);
            }
        } catch (error) {
            console.error('Error loading persistent settings:', error);
        }
    }

    private savePersistentSettings(): void {
        try {
            localStorage.setItem('vizzerdrix-settings', JSON.stringify(this.settings));
            console.log('Saved persistent settings:', this.settings);
        } catch (error) {
            console.error('Error saving persistent settings:', error);
        }
    }

    private updateMagnifyStatusUI(): void {
        if (this.settings.isMagnifyEnabled) {
            this.magnifyStatusEl.textContent = 'On';
            this.magnifyStatusEl.classList.remove('bg-red-600');
            this.magnifyStatusEl.classList.add('bg-green-600');
            this.magnifyToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.magnifyToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
            this.magnifySizeSliderContainer.classList.remove('hidden');
        } else {
            this.magnifyStatusEl.textContent = 'Off';
            this.magnifyStatusEl.classList.remove('bg-green-600');
            this.magnifyStatusEl.classList.add('bg-red-600');
            this.magnifyToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.magnifyToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            this.magnifySizeSliderContainer.classList.add('hidden');
        }
    }

    private updateAutoFocusStatusUI(): void {
        if (this.settings.isAutoFocusEnabled) {
            this.autoFocusStatusEl.textContent = 'On';
            this.autoFocusStatusEl.classList.remove('bg-red-600');
            this.autoFocusStatusEl.classList.add('bg-green-600');
            this.autoFocusToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.autoFocusToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.autoFocusStatusEl.textContent = 'Off';
            this.autoFocusStatusEl.classList.remove('bg-green-600');
            this.autoFocusStatusEl.classList.add('bg-red-600');
            this.autoFocusToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.autoFocusToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateGhostModeStatusUI(): void {
        if (this.settings.isGhostModeEnabled) {
            this.ghostModeStatusEl.textContent = 'On';
            this.ghostModeStatusEl.classList.remove('bg-red-600');
            this.ghostModeStatusEl.classList.add('bg-green-600');
            this.ghostModeToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.ghostModeToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.ghostModeStatusEl.textContent = 'Off';
            this.ghostModeStatusEl.classList.remove('bg-green-600');
            this.ghostModeStatusEl.classList.add('bg-red-600');
            this.ghostModeToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.ghostModeToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateReverseGhostModeStatusUI(): void {
        if (this.settings.isReverseGhostModeEnabled) {
            this.reverseGhostModeStatusEl.textContent = 'On';
            this.reverseGhostModeStatusEl.classList.remove('bg-red-600');
            this.reverseGhostModeStatusEl.classList.add('bg-green-600');
            this.reverseGhostModeToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.reverseGhostModeToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.reverseGhostModeStatusEl.textContent = 'Off';
            this.reverseGhostModeStatusEl.classList.remove('bg-green-600');
            this.reverseGhostModeStatusEl.classList.add('bg-red-600');
            this.reverseGhostModeToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.reverseGhostModeToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateAutoUntapStatusUI(): void {
        if (this.settings.isAutoUntapEnabled) {
            this.autoUntapStatusEl.textContent = 'On';
            this.autoUntapStatusEl.classList.remove('bg-red-600');
            this.autoUntapStatusEl.classList.add('bg-green-600');
            this.autoUntapToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.autoUntapToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.autoUntapStatusEl.textContent = 'Off';
            this.autoUntapStatusEl.classList.remove('bg-green-600');
            this.autoUntapStatusEl.classList.add('bg-red-600');
            this.autoUntapToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.autoUntapToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateEnhancedImageQualityStatusUI(): void {
        if (this.settings.isEnhancedImageQualityEnabled) {
            this.enhancedImageQualityStatusEl.textContent = 'On';
            this.enhancedImageQualityStatusEl.classList.remove('bg-red-600');
            this.enhancedImageQualityStatusEl.classList.add('bg-green-600');
            this.enhancedImageQualityToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.enhancedImageQualityToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.enhancedImageQualityStatusEl.textContent = 'Off';
            this.enhancedImageQualityStatusEl.classList.remove('bg-green-600');
            this.enhancedImageQualityStatusEl.classList.add('bg-red-600');
            this.enhancedImageQualityToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.enhancedImageQualityToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateSnapToGridStatusUI(): void {
        if (this.settings.isSnapToGridEnabled) {
            this.snapToGridStatusEl.textContent = 'On';
            this.snapToGridStatusEl.classList.remove('bg-red-600');
            this.snapToGridStatusEl.classList.add('bg-green-600');
            this.snapToGridToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.snapToGridToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.snapToGridStatusEl.textContent = 'Off';
            this.snapToGridStatusEl.classList.remove('bg-green-600');
            this.snapToGridStatusEl.classList.add('bg-red-600');
            this.snapToGridToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.snapToGridToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateTabHoverPreviewStatusUI(): void {
        if (this.settings.isTabHoverPreviewEnabled) {
            this.tabHoverPreviewStatusEl.textContent = 'On';
            this.tabHoverPreviewStatusEl.classList.remove('bg-red-600');
            this.tabHoverPreviewStatusEl.classList.add('bg-green-600');
            this.tabHoverPreviewToggleBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.tabHoverPreviewToggleBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.tabHoverPreviewStatusEl.textContent = 'Off';
            this.tabHoverPreviewStatusEl.classList.remove('bg-green-600');
            this.tabHoverPreviewStatusEl.classList.add('bg-red-600');
            this.tabHoverPreviewToggleBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.tabHoverPreviewToggleBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateSpacingSliderVisibilityUI(): void {
        if (this.settings.isSpacingSliderVisible) {
            this.cardSpacingSliderContainer.classList.remove('hidden');
            this.spacingSliderStatusEl.textContent = 'On';
            this.spacingSliderStatusEl.classList.remove('bg-red-600');
            this.spacingSliderStatusEl.classList.add('bg-green-600');
        } else {
            this.cardSpacingSliderContainer.classList.add('hidden');
            this.spacingSliderStatusEl.textContent = 'Off';
            this.spacingSliderStatusEl.classList.remove('bg-green-600');
            this.spacingSliderStatusEl.classList.add('bg-red-600');
        }
    }

    private updateAutoFitStatusUI(): void {
        if (this.settings.isAutoFitEnabled) {
            this.autoFitStatus.textContent = 'On';
            this.autoFitStatus.classList.remove('bg-red-600');
            this.autoFitStatus.classList.add('bg-green-600');
            this.autoFitSevenCardsBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            this.autoFitSevenCardsBtn.classList.add('bg-gray-700', 'hover:bg-gray-600');
        } else {
            this.autoFitStatus.textContent = 'Off';
            this.autoFitStatus.classList.remove('bg-green-600');
            this.autoFitStatus.classList.add('bg-red-600');
            this.autoFitSevenCardsBtn.classList.remove('bg-gray-700', 'hover:bg-gray-600');
            this.autoFitSevenCardsBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
        }
    }

    private updateAllUI(): void {
        this.updateMagnifyStatusUI();
        this.updateAutoFocusStatusUI();
        this.updateGhostModeStatusUI();
        this.updateReverseGhostModeStatusUI();
        this.updateAutoUntapStatusUI();
        this.updateEnhancedImageQualityStatusUI();
        this.updateSnapToGridStatusUI();
        this.updateTabHoverPreviewStatusUI();
        this.updateSpacingSliderVisibilityUI();
        this.updateAutoFitStatusUI();
    }

    // Cleanup method
    public destroy(): void {
        // Event listeners are automatically cleaned up when DOM elements are removed
        // or when the page is unloaded, but this method is here for completeness
    }
}