/**
 * Join Game UI Manager
 * Handles all functionality related to the join game screen, including:
 * - Form validation and input management
 * - Decklist parsing
 * - Room creation/joining
 * - Rejoining existing games
 * - Loading progress display
 * - Transition to game UI
 */

import { CommanderSelectionModal } from './commanderSelectionModal';
import { scryfallCache } from '../scryfallCache';
import type { Game } from '../state/game';
import type { Player } from '../state/player';

export class JoinGameUI {
    private socket: any;
    private commanderModal: CommanderSelectionModal;
    
    // DOM elements
    private joinUI!: HTMLElement;
    private gameUI!: HTMLElement;
    private joinBtn!: HTMLElement;
    private rejoinBtn!: HTMLElement;
    private roomInput!: HTMLInputElement;
    private displayNameInput!: HTMLInputElement;
    private decklistInput!: HTMLInputElement;
    private loadingModal!: HTMLElement;
    private loadingProgressBar!: HTMLElement;
    private loadingProgressText!: HTMLElement;
    private loadingCurrentCard!: HTMLElement;

    // Callbacks
    private onGameJoined?: (game: Game, player: Player) => void;
    private showMessage?: (message: string) => void;

    constructor(socket: any, commanderModal: CommanderSelectionModal) {
        this.socket = socket;
        this.commanderModal = commanderModal;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadSavedGameInfo();
    }

    private initializeElements(): void {
        this.joinUI = document.getElementById('join-ui')!;
        this.gameUI = document.getElementById('game-ui')!;
        this.joinBtn = document.getElementById('join-btn')!;
        this.rejoinBtn = document.getElementById('rejoin-btn')!;
        this.roomInput = document.getElementById('room-input') as HTMLInputElement;
        this.displayNameInput = document.getElementById('display-name-input') as HTMLInputElement;
        this.decklistInput = document.getElementById('decklist-input') as HTMLInputElement;
        this.loadingModal = document.getElementById('loading-modal')!;
        this.loadingProgressBar = document.getElementById('loading-progress-bar')!;
        this.loadingProgressText = document.getElementById('loading-progress-text')!;
        this.loadingCurrentCard = document.getElementById('loading-current-card')!;
    }

    private setupEventListeners(): void {
        this.joinBtn?.addEventListener('click', this.handleJoinClick.bind(this));
        this.rejoinBtn?.addEventListener('click', this.handleRejoinClick.bind(this));
    }

    private setupSocketListeners(): void {
        this.socket.on('joinSuccess', this.handleJoinSuccess.bind(this));
        this.socket.on('rejoinSuccess', this.handleRejoinSuccess.bind(this));
        this.socket.on('joinError', this.handleJoinError.bind(this));
        this.socket.on('rejoinError', this.handleRejoinError.bind(this));
    }

    public setCallbacks(callbacks: {
        onGameJoined?: (game: Game, player: Player) => void;
        showMessage?: (message: string) => void;
    }): void {
        this.onGameJoined = callbacks.onGameJoined;
        this.showMessage = callbacks.showMessage;
    }

    private async handleJoinClick(): Promise<void> {
        const roomName = this.roomInput?.value?.trim();
        const displayName = this.displayNameInput.value.trim();
        const decklistRaw = this.decklistInput.value.trim();
        
        // Parse decklist into arrays of card names
        const decklist: string[] = [];
        
        // Split by lines and handle empty lines
        const lines = decklistRaw.split('\n').map(line => line.trim());
        
        lines.forEach((line, index) => {
            if (!line) return; // Skip empty lines
            
            let cardName: string;
            let count: number;
            
            // First, try to match count at the beginning
            const countMatch = line.match(/^(\d+)\s*x?\s*(.+)$/);
            
            if (countMatch) {
                count = parseInt(countMatch[1]);
                cardName = countMatch[2];
            } else {
                // No count specified, assume 1 copy
                count = 1;
                cardName = line;
            }
            
            // Remove any trailing/leading whitespace
            cardName = cardName.trim();
            
            // Skip if card name is empty after cleaning
            if (!cardName) {
                console.warn('Empty card name after parsing:', line);
                return;
            }
            
            // Log parsing for debugging (only for first few cards to avoid spam)
            if (index < 10) {
                console.log(`Parsed line "${line}" -> Count: ${count}, Name: "${cardName}"`);
            }
            
            // Add the specified number of copies to the decklist
            for (let i = 0; i < count; i++) {
                decklist.push(cardName);
            }
        });

        if (!roomName || !displayName || decklist.length === 0) {
            this.showMessage?.("Please enter a room name, display name, and at least one card in your decklist.");
            return;
        }

        // Load card images
        this.showLoadingProgress();
        try {
            await scryfallCache.load(decklist, (loaded: number, total: number, currentCard: string) => {
                this.updateLoadingProgress(loaded, total, currentCard);
            });
            console.log('Finished loading card images');
        } catch (error) {
            console.error('Error loading card images:', error);
            this.showMessage?.('Some card images failed to load. The game will continue with placeholders.');
        } finally {
            this.hideLoadingProgress();
        }

        // Log parsing summary
        console.log(`Decklist parsing complete: ${decklist.length} library cards`);

        // Set up callbacks for the commander modal
        this.commanderModal.setCallbacks({
            onGameJoined: (joinedGame: Game, player: Player) => {
                console.log("Joined game");
                this.saveGameInfo(roomName, displayName);
                this.transitionToGameUI();
                this.onGameJoined?.(joinedGame, player);
            },
            showMessage: this.showMessage || (() => {})
        });
        
        // Show the commander selection modal
        this.commanderModal.show([...decklist], roomName, displayName);
    }

    private handleRejoinClick(): void {
        const roomName = this.roomInput.value.trim();
        const displayName = this.displayNameInput.value.trim();
        this.attemptRejoin(roomName, displayName);
    }

    private attemptRejoin(roomName: string, displayName: string): void {
        if (roomName && displayName) {
            console.log('Attempting rejoin with:', { roomName, displayName });
            this.socket.emit('rejoin', { roomName, displayName });
            this.showMessage?.("Attempting to rejoin Vizzerdrix game...");
        } else {
            console.error('Cannot rejoin: missing room name or display name');
            this.showMessage?.("Please enter both room name and display name to rejoin.");
        }
    }

    private handleJoinSuccess(data: any): void {
        console.log('Successfully joined game:', data);
        this.saveGameInfo(data.roomName, this.displayNameInput.value.trim());
        this.showMessage?.(`Welcome to Vizzerdrix! Joined room: ${data.roomName}`);
    }

    private handleRejoinSuccess(data: any): void {
        console.log('Successfully rejoined game:', data);
        this.saveGameInfo(data.roomName, this.displayNameInput.value.trim());
        this.transitionToGameUI();
        this.showMessage?.(`Welcome back to Vizzerdrix! Rejoined room: ${data.roomName}`);
    }

    private handleJoinError(error: any): void {
        console.error('Join error:', error);
        this.showMessage?.(`Error joining game: ${error.message}`);
    }

    private handleRejoinError(error: any): void {
        console.error('Rejoin error:', error);
        this.showMessage?.(`Error rejoining game: ${error.message}. You may need to create a new game.`);
    }

    private showLoadingProgress(): void {
        if (this.loadingModal && this.loadingProgressBar && this.loadingProgressText && this.loadingCurrentCard) {
            this.loadingModal.classList.remove('hidden');
            this.loadingProgressBar.style.width = '0%';
            this.loadingProgressText.textContent = 'Preparing to load cards...';
            this.loadingCurrentCard.textContent = '';
        }
    }

    private updateLoadingProgress(loaded: number, total: number, currentCard: string): void {
        if (this.loadingModal && !this.loadingModal.classList.contains('hidden')) {
            const percentage = Math.round((loaded / total) * 100);
            this.loadingProgressBar.style.width = `${percentage}%`;
            
            if (total === 0) {
                this.loadingProgressText.textContent = 'Preparing to load cards...';
                this.loadingCurrentCard.textContent = '';
            } else {
                this.loadingProgressText.textContent = `Loading card images: ${loaded}/${total} (${percentage}%)`;
                if (currentCard) {
                    // Truncate long card names for better UI
                    const displayName = currentCard.length > 30 ? 
                        currentCard.substring(0, 30) + '...' : 
                        currentCard;
                    this.loadingCurrentCard.textContent = `Loading: ${displayName}`;
                } else {
                    this.loadingCurrentCard.textContent = '';
                }
            }
        }
    }

    private hideLoadingProgress(): void {
        if (this.loadingModal) {
            this.loadingModal.classList.add('hidden');
        }
    }

    private transitionToGameUI(): void {
        this.joinUI.style.display = 'none';
        this.gameUI.style.display = '';
    }

    private saveGameInfo(roomName: string, displayName: string): void {
        try {
            const gameInfo = {
                roomName,
                displayName,
                timestamp: Date.now()
            };
            localStorage.setItem('vizzerdrix-game-info', JSON.stringify(gameInfo));
        } catch (error) {
            console.error('Error saving game info:', error);
        }
    }

    private loadSavedGameInfo(): void {
        try {
            const savedGameInfo = localStorage.getItem('vizzerdrix-game-info');
            if (savedGameInfo) {
                const gameInfo = JSON.parse(savedGameInfo);
                // Only auto-fill if the save is recent (within 24 hours)
                if (Date.now() - gameInfo.timestamp < 24 * 60 * 60 * 1000) {
                    this.roomInput.value = gameInfo.roomName;
                    this.displayNameInput.value = gameInfo.displayName;
                } else {
                    // Remove old saved info
                    localStorage.removeItem('vizzerdrix-game-info');
                }
            }
        } catch (error) {
            console.error('Error parsing saved game info:', error);
            localStorage.removeItem('vizzerdrix-game-info');
        }
    }

    // Public method to show the join UI (useful for logout/disconnect scenarios)
    public show(): void {
        this.joinUI.style.display = '';
        this.gameUI.style.display = 'none';
    }

    // Public method to hide the join UI (when game starts)
    public hide(): void {
        this.joinUI.style.display = 'none';
        this.gameUI.style.display = '';
    }

    // Cleanup method
    public destroy(): void {
        // Remove event listeners
        this.joinBtn?.removeEventListener('click', this.handleJoinClick.bind(this));
        this.rejoinBtn?.removeEventListener('click', this.handleRejoinClick.bind(this));
        
        // Remove socket listeners
        this.socket.off('joinSuccess', this.handleJoinSuccess.bind(this));
        this.socket.off('rejoinSuccess', this.handleRejoinSuccess.bind(this));
        this.socket.off('joinError', this.handleJoinError.bind(this));
        this.socket.off('rejoinError', this.handleRejoinError.bind(this));
    }
}