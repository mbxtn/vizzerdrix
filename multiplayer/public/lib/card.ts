// Class representing cards, will provide game state
// that can be built on per clients
export class Card {
    cardName: string; 
    id: string;
    scryfallId: string;
    tapped: boolean;
    flipped: boolean;
    counters = 0;

    frontFace?: {name: string, imageUris: string[]};
    backFace?: {name: string, imageUris: string[]};

    constructor(id: string, name: string, scryfallData?: any) {
        this.cardName = name;
        this.id = id;
        this.scryfallId = "";
        this.tapped = false;
        this.flipped = false;
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