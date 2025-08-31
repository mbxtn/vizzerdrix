// scryfallCache.js
// Browser-compatible Scryfall card cache for local use
// Usage: await ScryfallCache.load(['Black Lotus', 'Lightning Bolt'])
//        const card = ScryfallCache.get('Black Lotus')

const ScryfallCache = {
    _cache: {},
    _cardBackCache: {},

    async load(cardNames, progressCallback = null) {
        const uniqueNames = Array.from(new Set(cardNames)).filter(name => {
            if (typeof name !== 'string') {
                console.warn('Invalid card name passed to ScryfallCache.load:', name);
                return false;
            }
            return true;
        });
        
        // Filter out cards that are already cached
        const uncachedNames = uniqueNames.filter(name => !this._cache[name]);
        const totalCards = uncachedNames.length;
        let loadedCards = 0;
        
        // If we have a progress callback and uncached cards, report initial progress
        if (progressCallback && totalCards > 0) {
            progressCallback(0, totalCards, 'Starting...');
        } else if (progressCallback && totalCards === 0 && uniqueNames.length > 0) {
            // All cards already cached - show quick completion
            progressCallback(uniqueNames.length, uniqueNames.length, `All ${uniqueNames.length} cards already loaded from cache`);
            return; // Exit early since no work needed
        }
        
        for (const name of uncachedNames) {
            if (this._cache[name]) continue; // Double-check in case of race conditions
            try {
                let data = null;
                let finalName = name;
                
                // First try exact match
                let resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
                
                if (!resp.ok) {                // If exact match fails, try fuzzy search for potential double-faced cards
                console.log(`Exact match failed for "${name}", trying fuzzy search...`);
                const fuzzyResp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                if (fuzzyResp.ok) {
                    const fuzzyData = await fuzzyResp.json();
                    // Check if this is a double-faced card and our search term matches one face
                    if (fuzzyData.card_faces && fuzzyData.card_faces.length > 1) {
                        const matchesFace = fuzzyData.card_faces.some(face => 
                            face.name.toLowerCase().includes(name.toLowerCase()) ||
                            name.toLowerCase().includes(face.name.toLowerCase())
                        );
                        if (matchesFace) {
                            data = fuzzyData;
                            finalName = fuzzyData.name; // Use the full double-faced name
                            console.log(`✅ Found double-faced card: "${name}" -> "${finalName}"`);
                        }
                    }
                } else {
                    console.log(`❌ Fuzzy search also failed for "${name}"`);
                }
                }
                
                if (!data) {
                    if (!resp.ok) throw new Error(`Scryfall fetch failed for ${name}`);
                    data = await resp.json();
                }
                
                // Cache under both the original name and the full name (if different)
                this._cache[name] = data;
                if (finalName !== name) {
                    this._cache[finalName] = data;
                }
                
                // If this is a double-faced card, also cache the back image
                if (data.card_faces && data.card_faces.length > 1) {
                    await this._loadCardBack(data.id, name);
                    if (finalName !== name) {
                        await this._loadCardBack(data.id, finalName);
                    }
                }
            } catch (err) {
                console.error('Scryfall error:', name, err);
                this._cache[name] = null;
            }
            
            // Update progress
            loadedCards++;
            if (progressCallback) {
                progressCallback(loadedCards, totalCards, name);
            }
            
            // Only wait between network requests for uncached cards
            if (loadedCards < totalCards) {
                await new Promise(res => setTimeout(res, 100));
            }
        }
        
        // If we had cached cards, report final progress including them
        if (progressCallback && uniqueNames.length > totalCards) {
            const cachedCount = uniqueNames.length - totalCards;
            progressCallback(uniqueNames.length, uniqueNames.length, `Loaded ${totalCards} new cards, ${cachedCount} from cache`);
        }
    },

    async _loadCardBack(cardId, cardName) {
        if (this._cardBackCache[cardName]) return;
        
        try {
            // Try to get the back face image
            const backResp = await fetch(`https://api.scryfall.com/cards/${cardId}?format=image&face=back&version=normal`);
            if (backResp.ok) {
                this._cardBackCache[cardName] = backResp.url;
            }
        } catch (err) {
            console.error('Card back fetch error for', cardName, err);
            this._cardBackCache[cardName] = null;
        }
    },

    get(name) {
        return this._cache[name] || null;
    },

    getCardBack(name, forceDefault = false) {
        // If we want to force default (like for library cards), always return cardback.png
        if (forceDefault) {
            return './cardback.png';
        }
        
        // First check if we have a cached back image for this specific card
        if (this._cardBackCache[name]) {
            return this._cardBackCache[name];
        }
        
        // Check if this card has multiple faces (double-faced card)
        const cardData = this._cache[name];
        if (cardData && cardData.card_faces && cardData.card_faces.length > 1) {
            // If it's a double-faced card but we don't have the back cached, try to generate the URL
            return `https://api.scryfall.com/cards/${cardData.id}?format=image&face=back&version=normal`;
        }
        
        // Default to our local card back image for single-faced cards
        return './cardback.png';
    },

    hasBackFace(name) {
        const cardData = this._cache[name];
        return cardData && cardData.card_faces && cardData.card_faces.length > 1;
    },

    getAll() {
        return { ...this._cache };
    },

    // Helper method to get the full name of a double-faced card
    getFullCardName(searchName) {
        // First check if we have it cached under the search name
        const cachedCard = this._cache[searchName];
        if (cachedCard) {
            return cachedCard.name; // Return the official full name
        }
        
        // If not found, look through all cached cards for partial matches
        for (const [fullName, cardData] of Object.entries(this._cache)) {
            if (cardData && cardData.card_faces && cardData.card_faces.length > 1) {
                // Check if any face matches our search term
                const matchesFace = cardData.card_faces.some(face => 
                    face.name.toLowerCase() === searchName.toLowerCase() ||
                    face.name.toLowerCase().includes(searchName.toLowerCase()) ||
                    searchName.toLowerCase().includes(face.name.toLowerCase())
                );
                if (matchesFace) {
                    return fullName;
                }
            }
        }
        
        return searchName; // Return original if no match found
    },

    // Helper to check if a card name looks like it might be a partial double-faced card name
    mightBePartialDFC(name) {
        // Simple heuristics - these are common single face names that are part of DFCs
        const commonDFCPatterns = [
            /^(Stump|Stomp)$/i,
            /Clearing$/i,
            /^Boseiju/i,
            // Add more patterns as needed
        ];
        
        return commonDFCPatterns.some(pattern => pattern.test(name));
    },

    // Test function to verify double-faced card resolution
    async testDFCResolution() {
        console.log('Testing double-faced card resolution...');
        const testCards = ['Stump', 'Stomp', 'Stump // Stomp'];
        
        for (const cardName of testCards) {
            console.log(`Testing: "${cardName}"`);
            await this.load([cardName]);
            const result = this.get(cardName);
            if (result) {
                console.log(`✅ Found: "${result.name}" (${result.card_faces ? 'DFC' : 'Single-faced'})`);
            } else {
                console.log(`❌ Not found: "${cardName}"`);
            }
        }
    },
};

export default ScryfallCache;
