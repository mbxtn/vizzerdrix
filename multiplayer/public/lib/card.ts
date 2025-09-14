// Class representing cards, will provide game state
// that can be built on per clients
export class Card {

    // Basic information about a card
    // this should be copied if we make duplicates
    cardName: string;
    scryfallId: string;
    frontFace?: { name: string, imageUris: string[] };
    backFace?: { name: string, imageUris: string[] };

    // Information more specfic to a player themselves,
    // this should probably be preserved betweem games.
    commander: boolean;
    id: string;

    // Informatiion that's extemely stateful
    tapped: boolean;
    flipped: boolean;
    counters = 0;

    constructor(id: string, name: string,scryfallData?: any, isCommander = false) {
        this.cardName = name;
        this.id = id;
        this.scryfallId = "";
        this.tapped = false;
        this.flipped = false;
        this.commander = isCommander;
    }

    toggleTap() {
        this.tapped = !this.tapped;
    }

    canHover() :  boolean {
        return true;
    }

    getFaceUri() : string {
        return "";
    }

    shouldMagnify() : boolean {
        // We should always magnify if it's a face card, 
        // or if there's a valid backface
        return !this.flipped || this.backFace !== undefined;
    }

}