// Simple scryfall image cache for React client
// Simplified version of the original scryfallCache.ts

export interface CardImageData {
    scryfallId: string;
    name: string;
    imageUri?: string;
    cached: boolean;
}

export class ScryfallImageCache {
    private static instance: ScryfallImageCache;
    private cache: Map<string, CardImageData> = new Map();

    private constructor() {}

    public static getInstance(): ScryfallImageCache {
        if (!ScryfallImageCache.instance) {
            ScryfallImageCache.instance = new ScryfallImageCache();
        }
        return ScryfallImageCache.instance;
    }

    // Get image URL for a card name (returns placeholder if not cached)
    getImageUri(cardName: string): string {
        const cached = this.cache.get(cardName.toLowerCase());
        if (cached?.imageUri) {
            return cached.imageUri;
        }
        
        // Return a placeholder or generic card back image
        return 'https://cards.scryfall.io/large/back/0/0/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';
    }

    // Simple fetch for a card's image (for future enhancement)
    async fetchCard(cardName: string): Promise<CardImageData> {
        const searchName = cardName.toLowerCase().replace(/[^\w\s]/g, '');
        
        try {
            const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
            if (response.ok) {
                const cardData = await response.json();
                const imageData: CardImageData = {
                    scryfallId: cardData.id,
                    name: cardData.name,
                    imageUri: cardData.image_uris?.large || cardData.image_uris?.normal,
                    cached: true,
                };
                
                this.cache.set(cardName.toLowerCase(), imageData);
                return imageData;
            }
        } catch (error) {
            console.warn(`Failed to fetch image for ${cardName}:`, error);
        }
        
        // Return placeholder data
        const placeholderData: CardImageData = {
            scryfallId: '',
            name: cardName,
            cached: false,
        };
        
        return placeholderData;
    }
}