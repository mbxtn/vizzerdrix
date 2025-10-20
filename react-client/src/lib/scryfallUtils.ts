import { ScryfallCard, ScryfallCardFace } from '@scryfall/api-types';

// Returns the front face of a card
export function GetFaces(card : ScryfallCard.Any) : string[] {
    let a : ScryfallCardFace.Split
    let result : string[] = []
    if("image_uris" in card) {
        // TODO add error checking We're just gonna assume it's there for now.
        result.push(card.image_uris?.large!!)
    } else if("card_faces"  in card) {
        card.card_faces.forEach( (face : ScryfallCardFace.Any) => {
            if("image_uris" in face) {
                // TODO same as above, we need error checking
                result.push(face.image_uris?.large!!)
            } 
        })
    }
    return result
}

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
export function GetCardFace(card: ScryfallCard.Any, isFlipped: boolean) : string | undefined {
    if("image_uris" in card){
        if(isFlipped) {
            return undefined;
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