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