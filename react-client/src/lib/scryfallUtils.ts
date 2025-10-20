import { ScryfallCard, ScryfallCardFace } from '@scryfall/api-types';

// Helpful function to get the typeline of a card
export function GetTypeLine(card: ScryfallCard.Any, isFlipped: boolean): string {
    if ('card_faces' in card) {
        // Double-faced card: use the front face
        const mfc : ScryfallCard.AnyMultiFaced = card;
        if(isFlipped) {
            return mfc.card_faces[1].type_line
        }
        return mfc.card_faces[0].type_line;
    } else {
        const sfc: ScryfallCard.AnySingleFaced = card;
        // Single-faced card
        return sfc.type_line;
    }
}

// Helpful function to get the card image url object
export function GetCardFace(card: ScryfallCard.Any, isFlipped: boolean, cardBack = "/cardback.png") : string | undefined {
    if("image_uris" in card){
        if(isFlipped) {
            return cardBack;
        } else {
            return card.image_uris?.large
        }
    } else if("card_faces" in card) {
        if(!isFlipped) {
            if("image_uris" in card.card_faces[0]) {
                return card.card_faces[0].image_uris?.large;
            }
        } else {
            if("image_uris" in card.card_faces[1]) {
                return card.card_faces[1].image_uris?.large;
            }
        }
    }
}