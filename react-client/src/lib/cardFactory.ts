import { Card, CardFactory, Point, Zone } from '@vizzerdrix/shared';
import { ScryfallCache } from './scryfallCache';

export class ScryfallCardFactory implements CardFactory {
    playerId : string;
    counter = 0;
    scryfallCache = ScryfallCache.getInstance();

    constructor(playerId : string) {
        this.playerId = playerId;
    }

    createCardsFromIds(scryfallIds: string[]): Card[] {
        let cards : Card[] = [];
        scryfallIds.forEach(
            id => {
                let scryFallCard = this.scryfallCache.getById(id);
                let name = scryFallCard?.name ?? "unnamed";
                cards.push(new Card(this.playerId + this.counter, name, Zone.library, false, id));
                ++this.counter;
            }
        )
        return  cards;
    }

    createCardsFromNames(names: string[]) : Card[] {
        let cards : Card[] = [];
        names.forEach(
            name => {
                let scryFallCard = this.scryfallCache.get(name);
                cards.push(new Card(this.playerId + this.counter, name, Zone.library, false, scryFallCard?.id ?? ""));
                ++this.counter;
            }
        )
        return  cards;
    }

    // Active step, but we can be a bit more agressive here, there's a progress callback but it typically shouldn't be used
    loadCardsFromIds(ids: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) {
        this.scryfallCache.load(ids, (loaded: number, total: number, currentCard: string) => {
            progressCallback(loaded, total, currentCard);
        }, true);
    }

    // Preload step, each client should only have to do this on their own cards
    loadCardsFromNames(names: string[], progressCallback: (loaded: number, total: number, currentCard: string) => void) {
        this.scryfallCache.load(names, (loaded: number, total: number, currentCard: string) => {
            progressCallback(loaded, total, currentCard);
        }); 
    }
}