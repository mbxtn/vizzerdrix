import { VdClient } from '../state/socketclient';
import { Game } from '../state/game';
import { Player } from '../state/player';
import { ScryfallCardFactory } from '../state/card';

export class CommanderSelectionModal {
    private modal: HTMLElement | null = null;
    private selectionList: HTMLElement | null = null;
    private selectedCommandersCount: HTMLElement | null = null;
    private confirmBtn: HTMLButtonElement | null = null;
    private cancelBtn: HTMLElement | null = null;
    
    private pendingDecklist: string[] = [];
    private pendingRoomName: string = '';
    private pendingDisplayName: string = '';
    private selectedIndices: Set<number> = new Set();
    
    private vdClient: VdClient;
    private onGameJoined?: (game: Game, player: Player) => void;
    private showMessage?: (message: string) => void;

    constructor(vdClient: VdClient) {
        this.vdClient = vdClient;
        this.initializeElements();
        this.bindEvents();
    }

    private initializeElements(): void {
        this.modal = document.getElementById('commander-selection-modal');
        this.selectionList = document.getElementById('commander-selection-list');
        this.selectedCommandersCount = document.getElementById('selected-commanders-count');
        this.confirmBtn = document.getElementById('confirm-commander-selection-btn') as HTMLButtonElement;
        this.cancelBtn = document.getElementById('cancel-commander-selection-btn');
    }

    private bindEvents(): void {
        this.confirmBtn?.addEventListener('click', () => {
            if (this.selectedIndices.size > 0) {
                this.processSelection();
            }
        });

        this.cancelBtn?.addEventListener('click', () => {
            this.hide();
        });
    }

    public setCallbacks(callbacks: {
        onGameJoined?: (game: Game, player: Player) => void;
        showMessage?: (message: string) => void;
    }): void {
        this.onGameJoined = callbacks.onGameJoined;
        this.showMessage = callbacks.showMessage;
    }

    public show(allCardNames: string[], roomName: string, displayName: string): void {
        console.log('CommanderSelectionModal.show called with:', { 
            cardCount: allCardNames.length, 
            roomName, 
            displayName 
        });

        if (!this.modal) {
            console.error('Commander selection modal element not found!');
            return;
        }

        this.pendingDecklist = [...allCardNames];
        this.pendingRoomName = roomName;
        this.pendingDisplayName = displayName;
        this.selectedIndices.clear();

        this.populateSelectionList(allCardNames);
        this.updateSelectedCount();
        this.modal.classList.remove('hidden');
    }

    public hide(): void {
        this.modal?.classList.add('hidden');
        this.selectedIndices.clear();
    }

    private populateSelectionList(allCardNames: string[]): void {
        if (!this.selectionList) return;

        this.selectionList.innerHTML = '';

        // Group identical card names and show counts while preserving order
        const cardCounts: { [key: string]: number } = {};
        const uniqueCardOrder: string[] = [];
        
        allCardNames.forEach(cardName => {
            if (!cardCounts[cardName]) {
                cardCounts[cardName] = 0;
                uniqueCardOrder.push(cardName);
            }
            cardCounts[cardName]++;
        });

        console.log('Creating selection for', uniqueCardOrder.length, 'unique cards');

        uniqueCardOrder.forEach((cardName, index) => {
            const count = cardCounts[cardName];
            const cardItem = this.createCardItem(cardName, count, index);
            this.selectionList!.appendChild(cardItem);
        });
    }

    private createCardItem(cardName: string, count: number, index: number): HTMLElement {
        const cardItem = document.createElement('div');
        cardItem.className = 'flex items-center justify-between p-3 border border-gray-600 rounded-md mb-2 cursor-pointer hover:bg-gray-600 transition-colors';
        cardItem.dataset.cardIndex = index.toString();
        cardItem.dataset.cardName = cardName;

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'flex items-center flex-1';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mr-3 pointer-events-none';
        checkbox.id = `commander-checkbox-${index}`;

        const label = document.createElement('label');
        label.htmlFor = `commander-checkbox-${index}`;
        label.className = 'flex-1 cursor-pointer select-none';
        label.textContent = count > 1 ? `${cardName} (${count}x)` : cardName;

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        cardItem.appendChild(checkboxContainer);

        // Add click handler
        cardItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            checkbox.checked = !checkbox.checked;

            if (checkbox.checked) {
                cardItem.classList.add('bg-blue-600', 'border-blue-400');
                cardItem.classList.remove('hover:bg-gray-600');
                this.selectedIndices.add(index);
            } else {
                cardItem.classList.remove('bg-blue-600', 'border-blue-400');
                cardItem.classList.add('hover:bg-gray-600');
                this.selectedIndices.delete(index);
            }

            this.updateSelectedCount();
        });

        return cardItem;
    }

    private updateSelectedCount(): void {
        if (this.selectedCommandersCount) {
            this.selectedCommandersCount.textContent = this.selectedIndices.size.toString();
        }

        // Enable/disable confirm button
        if (this.confirmBtn) {
            if (this.selectedIndices.size > 0) {
                this.confirmBtn.disabled = false;
                this.confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                this.confirmBtn.disabled = true;
                this.confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    private processSelection(): void {
        const decklist: string[] = [];
        const commanders: string[] = [];

        // Group cards again for processing
        const cardCounts: { [key: string]: number } = {};
        const uniqueCardOrder: string[] = [];
        
        this.pendingDecklist.forEach(cardName => {
            if (!cardCounts[cardName]) {
                cardCounts[cardName] = 0;
                uniqueCardOrder.push(cardName);
            }
            cardCounts[cardName]++;
        });

        // Process selected commanders
        this.selectedIndices.forEach(index => {
            const cardName = uniqueCardOrder[index];
            const count = cardCounts[cardName];

            // Add all copies as commanders
            for (let i = 0; i < count; i++) {
                commanders.push(cardName);
            }

            // Remove from potential decklist
            delete cardCounts[cardName];
        });

        // Add remaining cards to decklist
        Object.entries(cardCounts).forEach(([cardName, count]) => {
            for (let i = 0; i < count; i++) {
                decklist.push(cardName);
            }
        });

        console.log(`Commander selection complete: ${decklist.length} library cards, ${commanders.length} commanders`);
        if (commanders.length > 0) {
            console.log('Selected commanders:', commanders);
        }

        // TODO: Remove this Emit join event, once we've moved to the new interface. 
        this.vdClient.socket.emit('join', {
            roomName: this.pendingRoomName,
            displayName: this.pendingDisplayName,
            decklist,
            commanders
        });

        // Save game info for potential future rejoins
        localStorage.setItem('vizzerdrix-game-info', JSON.stringify({
            roomName: this.pendingRoomName,
            displayName: this.pendingDisplayName,
            timestamp: Date.now()
        }));

        // Join the game
        this.vdClient.joinGame(this.pendingDisplayName, this.pendingRoomName, commanders, decklist)
            .then((joinedGame: Game) => {
                console.log("Joined game");
                const id = this.vdClient.getId();
                const player = joinedGame.players[id];
                
                if (!player) {
                    console.log("We joined but weren't added - something terrible has happened");
                    return;
                }
                
                // Restore Player and Game prototypes
                Object.setPrototypeOf(joinedGame, Game.prototype);
                Object.setPrototypeOf(player, Player.prototype);
                
                // Create deck and update state
                player.createDeck(new ScryfallCardFactory(id));
                this.vdClient.updateState(player);
                
                console.log(player);
                
                // Callback for successful join
                this.onGameJoined?.(joinedGame, player);
            })
            .catch((reason: any) => {
                console.log("Failed to join game", reason);
            });

        this.showMessage?.("Joining Vizzerdrix game...");
        this.hide();
    }
}