import { BaseCard } from "./basecard";
// Class representing cards, has clientside specific behavior. Server only tracks information in BaseState
export class Card extends BaseCard {

    // Basic information about a card
    // this should be copied if we make duplicates
    frontFace?: Face;
    backFace?: Face;

    // Indicator if the card is considered temporary and should be deleted at the end of a game.
    temporary = false;

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

    duplicate(newId : string) : Card {
        return new Card(newId, this.cardName);
    }

}

export class Face { 
    name: String = "";
    imageUris: string[] = [];
}