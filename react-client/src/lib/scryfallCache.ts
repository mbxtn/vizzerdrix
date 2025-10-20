// scryfallCache.ts
// Browser-compatible Scryfall card cache for local use
// Usage: await ScryfallCache.getInstance().load(['Black Lotus', 'Lightning Bolt'])  // Load by names
//        await ScryfallCache.getInstance().loadByIds(['uuid1', 'uuid2'])              // Load by IDs
//        await ScryfallCache.getInstance().load(['uuid1', 'uuid2'], null, true)      // Load by IDs (alternative)
//        const card = ScryfallCache.getInstance().get('Black Lotus')

import { ScryfallCard } from '@scryfall/api-types';

// TypeScript interfaces for our cache structure
export interface CacheEntry {
    scryfallData: ScryfallCard.Any; // Now properly typed Scryfall data
    cardName: string;  // Official card name from Scryfall
    scryfallId: string; // Scryfall UUID
    searchKeys: string[]; // All the ways this card can be searched (names, face names, etc.)
    cachedAt: number; // Timestamp when cached
}

export interface CacheIndex {
    byName: { [name: string]: string }; // name -> scryfallId
    byId: { [scryfallId: string]: CacheEntry }; // scryfallId -> cache entry
}

export interface CacheStats {
    totalCards: number;
    totalBackImages: number;
    cacheVersion: string;
    oldestEntry?: number;
    newestEntry?: number;
}

export class ScryfallCache {
    private static instance: ScryfallCache;

    private _cacheIndex: CacheIndex = { byName: {}, byId: {} };
    private readonly _cacheVersion: string = '2.0'; // Updated version for new schema
    private readonly _isBrowser: boolean = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

    private constructor() {
        // Initialize cache from localStorage when instance is created (browser only)
        this._initCache();
    }

    public static getInstance(): ScryfallCache {
        if (!ScryfallCache.instance) {
            ScryfallCache.instance = new ScryfallCache();
        }
        return ScryfallCache.instance;
    }

    // Initialize cache from localStorage
    private _initCache(): void {
        if (!this._isBrowser) {
            console.log('Running in Node.js environment, localStorage unavailable - using in-memory cache only');
            return;
        }

        try {
            const savedCache = localStorage.getItem('scryfallCache');
            const savedVersion = localStorage.getItem('scryfallCacheVersion');

            // Check version and migrate if needed
            if (savedVersion === this._cacheVersion) {
                // Load new format
                if (savedCache) {
                    this._cacheIndex = JSON.parse(savedCache);
                }
            } else {
                console.log('Cache version mismatch or new install, starting fresh');
                this._clearLocalStorage();
            }

            console.log(`Loaded ${Object.keys(this._cacheIndex.byId).length} cards from cache`);
        } catch (error) {
            console.error('Error loading cache from localStorage:', error);
            this._clearLocalStorage();
        }
    }

    // Save cache to localStorage
    private _saveCache(): void {
        if (!this._isBrowser) {
            return; // Skip saving in Node.js environment
        }

        // Use setTimeout to make cache saving non-blocking
        setTimeout(() => {
            try {
                localStorage.setItem('scryfallCache', JSON.stringify(this._cacheIndex));
                localStorage.setItem('scryfallCacheVersion', this._cacheVersion);
            } catch (error) {
                console.error('Error saving cache to localStorage:', error);
                // If localStorage is full or unavailable, clear some old entries
                this._clearOldCacheEntries();
            }
        }, 0);
    }

    // Clear localStorage cache
    private _clearLocalStorage(): void {
        if (!this._isBrowser) {
            return; // Skip in Node.js environment
        }

        localStorage.removeItem('scryfallCache');
        localStorage.removeItem('scryfallCacheVersion');
    }

    // Clear old cache entries if storage is full
    private _clearOldCacheEntries(): void {
        // Keep only the most recently used cards (simple approach)
        const cacheEntries = Object.values(this._cacheIndex.byId);
        if (cacheEntries.length > 500) { // Keep only 500 most recent cards
            // Sort by cachedAt timestamp and keep newest
            cacheEntries.sort((a, b) => b.cachedAt - a.cachedAt);
            const entriesToKeep = cacheEntries.slice(0, 500);
            const idsToKeep = new Set(entriesToKeep.map(entry => entry.scryfallId));

            // Rebuild index with only entries to keep
            const newIndex: CacheIndex = { byName: {}, byId: {} };
            entriesToKeep.forEach(entry => {
                newIndex.byId[entry.scryfallId] = entry;
                entry.searchKeys.forEach(key => {
                    newIndex.byName[key] = entry.scryfallId;
                });
            });

            this._cacheIndex = newIndex;
            this._saveCache();
        }
    }

    // Helper methods for the new cache structure
    private _isMultiFaced(card: ScryfallCard.Any): card is ScryfallCard.AnyMultiFaced {
        return 'card_faces' in card && card.card_faces !== undefined && card.card_faces.length > 1;
    }

    private _isDoubleSided(card: ScryfallCard.Any): boolean {
        return this._isMultiFaced(card) && card.layout !== 'adventure' && card.layout !== 'split' && card.layout !== 'flip';
    }

    private _extractSearchKeys(card: ScryfallCard.Any, additionalKeys: string[] = []): string[] {
        const searchKeys = [card.name, ...additionalKeys];

        // Add face names for multi-faced cards
        if (this._isMultiFaced(card)) {
            card.card_faces.forEach(face => {
                if (face.name && !searchKeys.includes(face.name)) {
                    searchKeys.push(face.name);
                }
            });
        }

        return [...new Set(searchKeys)]; // Remove duplicates
    }

    private _addToCache(scryfallData: ScryfallCard.Any, searchKeys: string[]): void {
        const cacheEntry: CacheEntry = {
            scryfallData,
            cardName: scryfallData.name,
            scryfallId: scryfallData.id,
            searchKeys: [...new Set(searchKeys)], // Remove duplicates
            cachedAt: Date.now()
        };

        // Store in index
        this._cacheIndex.byId[scryfallData.id] = cacheEntry;
        searchKeys.forEach(key => {
            this._cacheIndex.byName[key] = scryfallData.id;
        });
    }

    private _isCardCached(searchKey: string): boolean {
        return this._cacheIndex.byName[searchKey] !== undefined;
    }

    private _getCardByKey(searchKey: string): ScryfallCard.Any | null {
        const scryfallId = this._cacheIndex.byName[searchKey];
        if (scryfallId) {
            const entry = this._cacheIndex.byId[scryfallId];
            return entry ? entry.scryfallData : null;
        }
        return null;
    }

    // New method: get card by Scryfall ID
    public getById(scryfallId: string): ScryfallCard.Any | null {
        const entry = this._cacheIndex.byId[scryfallId];
        return entry ? entry.scryfallData : null;
    }

    // New method: search for cards by name or ID
    public findCard(query: string): ScryfallCard.Any | null {
        // First try exact name match
        let card = this._getCardByKey(query);
        if (card) return card;

        // Try as Scryfall ID
        card = this.getById(query);
        if (card) return card;

        // Try case-insensitive search through all search keys
        const lowerQuery = query.toLowerCase();
        for (const [searchKey, scryfallId] of Object.entries(this._cacheIndex.byName)) {
            if (searchKey.toLowerCase() === lowerQuery) {
                const entry = this._cacheIndex.byId[scryfallId];
                return entry ? entry.scryfallData : null;
            }
        }

        return null;
    }

    public async load(cardNames: string[], progressCallback: ((loaded: number, total: number, currentCard: string) => void) | null = null, isIds: boolean = false): Promise<void> {
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cacheIndex.byId).length === 0) {
            this._initCache();
        }

        const uniqueNames = Array.from(new Set(cardNames)).filter(name => {
            if (typeof name !== 'string') {
                console.warn('Invalid card name/ID passed to ScryfallCache.load:', name);
                return false;
            }
            return true;
        });

        // Filter out cards that are already cached
        // For IDs, check if the ID exists in byId index; for names, use the existing name lookup
        const uncachedNames = uniqueNames.filter(nameOrId => {
            if (isIds) {
                return !this._cacheIndex.byId[nameOrId];
            } else {
                return !this._isCardCached(nameOrId);
            }
        });

        const totalCards = uncachedNames.length;
        let loadedCards = 0;

        console.log(`Cache status: ${uniqueNames.length - uncachedNames.length} cached, ${uncachedNames.length} need loading`);

        // If we have a progress callback and uncached cards, report initial progress
        if (progressCallback && totalCards > 0) {
            progressCallback(0, totalCards, 'Starting...');
        } else if (progressCallback && totalCards === 0 && uniqueNames.length > 0) {
            // All cards already cached - show quick completion
            progressCallback(uniqueNames.length, uniqueNames.length, `All ${uniqueNames.length} cards already loaded from cache`);
            return; // Exit early since no work needed
        }

        // Load cards in small batches for better performance
        const batchSize = 3; // Load 3 cards concurrently
        const batches = [];
        for (let i = 0; i < uncachedNames.length; i += batchSize) {
            batches.push(uncachedNames.slice(i, i + batchSize));
        }

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];

            // Load all cards in this batch concurrently
            const batchPromises = batch.map(async (nameOrId) => {
                // Double-check cache to avoid race conditions
                if (isIds && this._cacheIndex.byId[nameOrId]) return nameOrId;
                if (!isIds && this._isCardCached(nameOrId)) return nameOrId;

                try {
                    let data = null;

                    if (isIds) {
                        // Load by Scryfall ID directly - much simpler and faster
                        const resp = await fetch(`https://api.scryfall.com/cards/${nameOrId}`);
                        if (!resp.ok) {
                            throw new Error(`Scryfall fetch failed for ID ${nameOrId}: ${resp.status}`);
                        }
                        data = await resp.json();

                        // For ID-based loading, use the card name and ID as search keys
                        const searchKeys = [data.name, nameOrId];

                        // Add face names for multi-faced cards
                        if (this._isMultiFaced(data)) {
                            data.card_faces.forEach((face: any) => {
                                if (face.name && !searchKeys.includes(face.name)) {
                                    searchKeys.push(face.name);
                                }
                            });
                        }

                        this._addToCache(data, searchKeys);

                    } else {
                        // Original name-based loading logic
                        let setRegex = /\(.*\)/g
                        const setMatch = nameOrId.match(setRegex);
                        let finalName = nameOrId;
                        let setCode = null;
                        if (setMatch) {
                            setCode = setMatch[0].replace(/\(|\)/g, "");
                            finalName = nameOrId.split(setRegex)[0];
                        }

                        // First try exact match
                        let resp: Response;
                        if (setCode) {
                            resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(finalName)}&set=${encodeURIComponent(setCode)}`);
                        } else {
                            resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(finalName)}`);
                        }

                        if (!resp.ok) {
                            // If exact match fails, try fuzzy search for potential double-faced cards or adventure cards
                            const fuzzyResp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nameOrId)}`);
                            if (fuzzyResp.ok) {
                                const fuzzyData = await fuzzyResp.json();
                                // Check if this is a multi-faced card and our search term matches one face
                                if (this._isMultiFaced(fuzzyData)) {
                                    const matchesFace = fuzzyData.card_faces.some((face: any) =>
                                        face.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
                                        nameOrId.toLowerCase().includes(face.name.toLowerCase())
                                    );
                                    if (matchesFace) {
                                        data = fuzzyData;
                                        finalName = fuzzyData.name; // Use the full card name
                                    }
                                } else if (fuzzyData.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
                                    nameOrId.toLowerCase().includes(fuzzyData.name.toLowerCase())) {
                                    // Also accept close matches for single-faced cards
                                    data = fuzzyData;
                                    finalName = fuzzyData.name;
                                }
                            }
                        }

                        if (!data) {
                            if (!resp.ok) throw new Error(`Scryfall fetch failed for ${nameOrId}`);
                            data = await resp.json();
                        }

                        // Build search keys using our helper
                        const additionalKeys = [nameOrId];
                        if (finalName !== nameOrId && finalName !== data.name) {
                            additionalKeys.push(finalName);
                        }
                        const searchKeys = this._extractSearchKeys(data, additionalKeys);

                        // Add to cache with all search keys
                        this._addToCache(data, searchKeys);
                    }

                    return nameOrId;
                } catch (err) {
                    console.error(`Scryfall error for ${isIds ? 'ID' : 'name'}:`, nameOrId, err);
                    // Store failed attempt to prevent repeated attempts
                    if (isIds) {
                        // For failed ID lookups, we can't store in byName index
                        console.warn(`Failed to load card with ID: ${nameOrId}`);
                    } else {
                        this._cacheIndex.byName[nameOrId] = 'failed';
                    }
                    return nameOrId;
                }
            });

            // Wait for all cards in this batch to complete
            const completedCards = await Promise.all(batchPromises);

            // Update progress for all completed cards in this batch
            completedCards.forEach(nameOrId => {
                if (nameOrId) {
                    loadedCards++;
                    if (progressCallback) {
                        progressCallback(loadedCards, totalCards, nameOrId);
                    }
                }
            });

            // Wait 25ms between batches (not between individual cards)
            if (batchIndex < batches.length - 1) {
                await new Promise(res => setTimeout(res, 25));
            }
        }

        // Save cache once at the end (more efficient than incremental saving)
        if (totalCards > 0) {
            this._saveCache();
        }

        // If we had cached cards, report final progress including them
        if (progressCallback && uniqueNames.length > totalCards) {
            const cachedCount = uniqueNames.length - totalCards;
            progressCallback(uniqueNames.length, uniqueNames.length, `Loaded ${totalCards} new cards, ${cachedCount} from cache`);
        }
    }

    // Convenience method for loading cards by Scryfall IDs
    public async loadByIds(scryfallIds: string[], progressCallback: ((loaded: number, total: number, currentId: string) => void) | null = null): Promise<void> {
        return this.load(scryfallIds, progressCallback, true);
    }

    public get(name: string): ScryfallCard.Any | null {
        return this._getCardByKey(name);
    }

    public getCardBack(name: string, forceDefault: boolean = false): string {
        // If we want to force default (like for library cards), always return cardback.png
        if (forceDefault) {
            return './cardback.png';
        }

        // Check if this card has multiple faces and get the back face image from card data
        const cardData = this._getCardByKey(name);
        if (cardData && this._isDoubleSided(cardData)) {
            // For double-faced cards, get the back face image from the card_faces data
            if (this._isMultiFaced(cardData)) {
                const backFace = cardData.card_faces[1]; // Back face is typically index 1
                // Try to access image_uris safely with type checking
                if ('image_uris' in backFace && backFace.image_uris && backFace.image_uris.normal) {
                    return backFace.image_uris.normal;
                }
            }
            // Fallback to API URL if image_uris not available
            return `https://api.scryfall.com/cards/${cardData.id}?format=image&face=back&version=normal`;
        }

        // Default to our local card back image for single-faced cards
        return './cardback.png';
    }

    public hasBackFace(name: string): boolean {
        const cardData = this._getCardByKey(name);
        return !!(cardData && this._isDoubleSided(cardData));
    }

    public getAll(): { [name: string]: ScryfallCard.Any } {
        const result: { [name: string]: ScryfallCard.Any } = {};
        Object.entries(this._cacheIndex.byName).forEach(([name, scryfallId]) => {
            if (scryfallId !== 'failed') {
                const entry = this._cacheIndex.byId[scryfallId];
                if (entry) {
                    result[name] = entry.scryfallData;
                }
            }
        });
        return result;
    }

    // Get cache statistics
    public getCacheStats(): CacheStats {
        const entries = Object.values(this._cacheIndex.byId);
        const timestamps = entries.map(entry => entry.cachedAt).filter(ts => ts);

        return {
            totalCards: entries.length,
            totalBackImages: 0, // No longer tracking back images separately
            cacheVersion: this._cacheVersion,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
        };
    }

    // Clear all cache (useful for debugging)
    public clearCache(): void {
        this._cacheIndex = { byName: {}, byId: {} };
        this._clearLocalStorage();
        console.log('Cache cleared');
    }

    // Helper method to get the full name of a double-faced card
    public getFullCardName(searchName: string): string {
        // First check if we have it cached under the search name
        const cachedCard = this._getCardByKey(searchName);
        if (cachedCard) {
            return cachedCard.name; // Return the official full name
        }

        // If not found, look through all cached cards for partial matches
        for (const entry of Object.values(this._cacheIndex.byId)) {
            const cardData = entry.scryfallData;
            if (cardData && this._isMultiFaced(cardData)) {
                // Check if any face matches our search term (works for both DFCs and adventure cards)
                const matchesFace = cardData.card_faces.some((face: any) =>
                    face.name.toLowerCase() === searchName.toLowerCase() ||
                    face.name.toLowerCase().includes(searchName.toLowerCase()) ||
                    searchName.toLowerCase().includes(face.name.toLowerCase())
                );
                if (matchesFace) {
                    return cardData.name;
                }
            }
        }

        return searchName; // Return original if no match found
    }

    // Check if a card is an adventure card
    public isAdventureCard(name: string): boolean {
        const cardData = this._getCardByKey(name);
        return !!(cardData && cardData.layout === 'adventure');
    }

    // Get the adventure spell name from an adventure card
    public getAdventureSpellName(name: string): string | null {
        const cardData = this._getCardByKey(name);
        if (cardData && cardData.layout === 'adventure' && this._isMultiFaced(cardData)) {
            // Adventure spell is typically the second face
            return cardData.card_faces[1].name;
        }
        return null;
    }

    // Get the creature name from an adventure card
    public getCreatureName(name: string): string | null {
        const cardData = this._getCardByKey(name);
        if (cardData && cardData.layout === 'adventure' && this._isMultiFaced(cardData)) {
            // Creature is typically the first face
            return cardData.card_faces[0].name;
        }
        return null;
    }

    // Load cards by their Scryfall ID (extracted from URI)
    public async loadById(cardUri: string, cardName: string | null = null): Promise<ScryfallCard.Any | null> {
        // Extract the card ID from the URI
        // URI format: https://api.scryfall.com/cards/{id}
        const cardId = cardUri.split('/').pop();
        if (!cardId) return null;

        console.log(`Loading card by ID: ${cardId} (name: ${cardName || 'unknown'})`);

        // Check if we already have this card cached by ID
        if (this._cacheIndex.byId[cardId]) {
            console.log(`Card with ID ${cardId} already cached`);
            return this._cacheIndex.byId[cardId].scryfallData;
        }

        try {
            // Fetch the card by ID directly
            const resp = await fetch(`https://api.scryfall.com/cards/${cardId}`);
            if (!resp.ok) {
                throw new Error(`Scryfall fetch failed for ID ${cardId}: ${resp.status}`);
            }

            const data = await resp.json();

            // Build search keys
            const searchKeys = [data.name];
            if (cardName && cardName !== data.name) {
                searchKeys.push(cardName);
            }

            // Add face names for multi-faced cards
            if (this._isMultiFaced(data)) {
                data.card_faces.forEach((face: any) => {
                    if (face.name && !searchKeys.includes(face.name)) {
                        searchKeys.push(face.name);
                    }
                });
            }

            // Add to cache
            this._addToCache(data, searchKeys);

            console.log(`Successfully loaded and cached card: ${data.name} (ID: ${cardId})`);

            // Save cache
            this._saveCache();

            return data;
        } catch (error) {
            console.error('Error loading card by ID:', cardId, error);
            return null;
        }
    }

    // New method: Load card by Scryfall ID directly (for multiplayer scenarios)
    public async loadByScryfallId(scryfallId: string): Promise<ScryfallCard.Any | null> {
        // Check if already cached
        if (this._cacheIndex.byId[scryfallId]) {
            return this._cacheIndex.byId[scryfallId].scryfallData;
        }

        try {
            // Fetch directly by ID
            const resp = await fetch(`https://api.scryfall.com/cards/${scryfallId}`);
            if (!resp.ok) {
                throw new Error(`Scryfall fetch failed for ID ${scryfallId}: ${resp.status}`);
            }

            const data = await resp.json();

            // Build search keys
            const searchKeys = [data.name];

            // Add face names for multi-faced cards
            if (this._isMultiFaced(data)) {
                data.card_faces.forEach((face: any) => {
                    if (face.name && !searchKeys.includes(face.name)) {
                        searchKeys.push(face.name);
                    }
                });
            }

            // Add to cache
            this._addToCache(data, searchKeys);

            // Save cache
            this._saveCache();

            return data;
        } catch (error) {
            console.error('Error loading card by Scryfall ID:', scryfallId, error);
            return null;
        }
    }

    // Utility method to get all Scryfall IDs for cards that match a search
    public getScryfallIds(searchKeys: string[]): string[] {
        const ids: string[] = [];
        searchKeys.forEach(key => {
            const id = this._cacheIndex.byName[key];
            if (id && id !== 'failed' && !ids.includes(id)) {
                ids.push(id);
            }
        });
        return ids;
    }
}

// Export both the class and a default instance for backward compatibility
export const scryfallCache = ScryfallCache.getInstance();
export default scryfallCache;
