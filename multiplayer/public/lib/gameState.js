// Game state management class and functions
// This state will use optmistic concurrency control to manage updates
// and ensure all clients have a consistent view of the game state while
// prioritizing low latency for user actions.
export class GameState {
    // The emitted state object has the following structure:
    // {
    //   players: {
    //     [playerId]: {
    //       hand: [CardObject],
    //       library: [CardObject],
    //       graveyard: [CardObject],
    //       exile: [CardObject],
    //       command: [CardObject],
    //       displayName: string,
    //       decklist: [string],
    //       commanders: [string],
    //       life: number
    //     },
    //     ...
    //   },
    //   playZones: {
    //     [playerId]: [CardObject],
    //     ...
    //   },
    //   turnOrder: [playerId],
    //   currentTurn: number, // index in turnOrder
    //   turnOrderSet: boolean,
    //   turnCounter: number,
    //   playerSelections: {
    //     [playerId]: [cardId],
    //     ...
    //   }
    // }
    // CardObject: {
    //   id: string,
    //   name: string,
    //   displayName: string,
    //   isCommander?: boolean,
    //   faceup: boolean,
    //   ...
    // }

    constructor(playerId, socket) {
        // Initialize things to empty so we can add to them later
        this.playerId = playerId; // The local player's ID
        this.socket = socket;

        // Initialize everything else to null/empty/0
        // and provide light descriptions of what everything is.

        // listener callbacks registered with names and a function, so we can
        // remove callbacks easily (not sure if it's really a thing but whatever)
        this.listeners = [];
        // The last raw state received from the server
        this.serverState = null; 
        // Local Client State
        this.clientState = {};
        // This should honestly be inside clientState, but I'll make that change after
        // I've completed this refactor.
        this.playZone = [];
        // Timestamp of the last update from Client
        this.lastUpdate = Date.now(); 
    }

    addListener(name, callback) {
        this.listeners.push({ name, callback });
    }
    removeListeners(name) {
        this.listeners = this.listeners.filter(listener => listener.name !== name);
    }

    getCardsFromZone(zone, commanders = [], others = []) {
        console.log("Attempting to get cards from this zone", {zone: zone});
        zone.forEach(card => {
            if(card.isCommander) {
                commanders.push(card)
            } else {
                others.push(card)
            }
        });
        // I personally prefer = [] but that doesn't work in a function
        zone.length = 0;
    }
    // This is a basic function, it'll just put all of a players own cards
    // into their hand/command zone
    resetGame() {
        let commanderCards = [];
        let library = [];

        this.getCardsFromZone(this.clientState.hand, commanderCards, library);
        this.getCardsFromZone(this.clientState.library, commanderCards, library);
        this.getCardsFromZone(this.clientState.graveyard, commanderCards, library);
        this.getCardsFromZone(this.clientState.exile, commanderCards, library);
        this.getCardsFromZone(this.clientState.command, commanderCards, library);
        this.getCardsFromZone(this.playZone, commanderCards, library);

        this.clientState.library = library;
        this.clientState.command = commanderCards;

        console.log("Reset game:", {
            battlefield: this.playZone,
            command: this.clientState.command,
            library: this.clientState.library.length,
            hand: this.clientState.hand,
            exile: this.clientState.exile,
            graveyard: this.clientState.graveyard,
        } )
    }

    moveCard(cardId, fromZone, toZone, x = 0, y = 0) {
        this.lastUpdate = Date.now();
        // Find the card in the fromZone   
    }

    moveCards(cardIds, fromZone, toZone, x = 0, y = 0) {
        // Find the cards in the fromZone
    }

    updateFromServer(state) {
        // Basic logging, should help for getting a sense of the schema
        console.log('RAW STATE RECEIVED:', new Date().toISOString(), {
            serverState: JSON.stringify(state)
        });

        if (JSON.stringify(this.serverState) === JSON.stringify(state)) {
            console.log('No changes in state, skipping update.');
            return; // No changes, skip processing
        }

        const turnOrderChanged = !this.serverState ||
            this.serverState.currentTurn !== state.currentTurn ||
            this.serverState.turnOrderSet !== state.turnOrderSet ||
            this.serverState.turnCounter !== state.turnCounter ||
            JSON.stringify(this.serverState.turnOrder) !== JSON.stringify(state.turnOrder);
        const currentTurnChanged = this.serverState && 
        (
            this.serverState.currentTurn !== state.currentTurn ||
             this.serverState.turnCounter !== state.turnCounter
        );



        this.serverState = state;
        // Automatically take the server's client state for this player
        // if we don't have one yet (first update) or if it's empty
        if (!this.clientState || JSON.stringify(this.clientState) === JSON.stringify({})) {
            this.clientState = state.players[this.playerId] || {};
            this.lastUpdate = Date.now();
        } else {
            // We can be pretty primative here. The server should never 
            // cause the clients state to change, so we can just
            // ignore any changes to the client state from the server
            if (Date.now() > this.lastUpdate + 1000) {
                // Resend our state to the server again.
                //this.sendMove();
            }
        }

        // Notify all listeners of the updated state
        this.listeners.forEach(listener => listener.callback(state));
    }

}




