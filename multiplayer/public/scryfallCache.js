// scryfallCache.js
// Browser-compatible Scryfall card cache with persistent localStorage storage
// Features:
// - Automatic localStorage persistence with 24-hour expiry
// - Double-faced card support with back face caching
// - Cache statistics and management utilities
// 
// Usage: await ScryfallCache.load(['Black Lotus', 'Lightning Bolt'])
//        const card = ScryfallCache.get('Black Lotus')
//        const stats = ScryfallCache.getCacheStats()
//        ScryfallCache.clearCache() // Clear all caches

const ScryfallCache = {
    _cache: {},
    _cardBackCache: {},
    _storageKeys: {
        cardCache: 'scryfall_card_cache',
        cardBackCache: 'scryfall_cardback_cache',
        cacheTimestamp: 'scryfall_cache_timestamp'
    },
    _cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

    // Initialize the cache by loading from localStorage
    async init() {
        this._loadFromStorage();
    },

    // Load cache from localStorage
    _loadFromStorage() {
        try {
            // Check if cache has expired
            const timestamp = localStorage.getItem(this._storageKeys.cacheTimestamp);
            if (timestamp) {
                const cacheAge = Date.now() - parseInt(timestamp);
                if (cacheAge > this._cacheExpiry) {
                    console.log('Cache expired, clearing localStorage');
                    this._clearStorage();
                    return;
                }
            }

            // Load card cache
            const savedCache = localStorage.getItem(this._storageKeys.cardCache);
            if (savedCache) {
                this._cache = JSON.parse(savedCache);
                console.log(`Loaded ${Object.keys(this._cache).length} cards from localStorage`);
            }

            // Load card back cache
            const savedBackCache = localStorage.getItem(this._storageKeys.cardBackCache);
            if (savedBackCache) {
                this._cardBackCache = JSON.parse(savedBackCache);
                console.log(`Loaded ${Object.keys(this._cardBackCache).length} card backs from localStorage`);
            }
        } catch (err) {
            console.error('Error loading from localStorage:', err);
            this._clearStorage();
        }
    },

    async load(cardNames) {
        const uniqueNames = Array.from(new Set(cardNames)).filter(name => {
            if (typeof name !== 'string') {
                console.warn('Invalid card name passed to ScryfallCache.load:', name);
                return false;
            }
            return true;
        });
        
        // Initialize if not already done
        if (Object.keys(this._cache).length === 0) {
            this._loadFromStorage();
        }
        
        let newCardsLoaded = false;
        
        for (const name of uniqueNames) {
            if (this._cache[name]) continue;
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
                
                newCardsLoaded = true;
                
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
            // Wait 100ms before next request
            await new Promise(res => setTimeout(res, 100));
        }
        
        // Save to localStorage if we loaded new cards
        if (newCardsLoaded) {
            this._saveToStorage();
        }
    },

    async _loadCardBack(cardId, cardName) {
        if (this._cardBackCache[cardName]) return;
        
        try {
            // Try to get the back face image
            const backResp = await fetch(`https://api.scryfall.com/cards/${cardId}?format=image&face=back&version=normal`);
            if (backResp.ok) {
                this._cardBackCache[cardName] = backResp.url;
                // Save to localStorage when we get a new card back
                this._saveToStorage();
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

    // Save cache to localStorage
    _saveToStorage() {
        try {
            localStorage.setItem(this._storageKeys.cardCache, JSON.stringify(this._cache));
            localStorage.setItem(this._storageKeys.cardBackCache, JSON.stringify(this._cardBackCache));
            localStorage.setItem(this._storageKeys.cacheTimestamp, Date.now().toString());
        } catch (err) {
            console.error('Error saving to localStorage:', err);
            // If we can't save (e.g., quota exceeded), clear old data and try again
            this._clearStorage();
            try {
                localStorage.setItem(this._storageKeys.cardCache, JSON.stringify(this._cache));
                localStorage.setItem(this._storageKeys.cardBackCache, JSON.stringify(this._cardBackCache));
                localStorage.setItem(this._storageKeys.cacheTimestamp, Date.now().toString());
            } catch (retryErr) {
                console.error('Failed to save to localStorage even after clearing:', retryErr);
            }
        }
    },

    // Clear localStorage cache
    _clearStorage() {
        localStorage.removeItem(this._storageKeys.cardCache);
        localStorage.removeItem(this._storageKeys.cardBackCache);
        localStorage.removeItem(this._storageKeys.cacheTimestamp);
    },

    // Clear all caches (memory and localStorage)
    clearCache() {
        this._cache = {};
        this._cardBackCache = {};
        this._clearStorage();
        console.log('All caches cleared');
    },

    // Get cache statistics
    getCacheStats() {
        const cardCount = Object.keys(this._cache).length;
        const backCount = Object.keys(this._cardBackCache).length;
        const timestamp = localStorage.getItem(this._storageKeys.cacheTimestamp);
        const cacheAge = timestamp ? Date.now() - parseInt(timestamp) : 0;
        
        return {
            cardCount,
            backCount,
            cacheAge: Math.floor(cacheAge / (1000 * 60)), // Age in minutes
            isExpired: cacheAge > this._cacheExpiry
        };
    },

    // Force refresh of specific cards (bypass cache)
    async forceRefresh(cardNames) {
        const namesToRefresh = Array.isArray(cardNames) ? cardNames : [cardNames];
        
        // Remove from cache
        namesToRefresh.forEach(name => {
            delete this._cache[name];
            delete this._cardBackCache[name];
        });
        
        // Reload
        await this.load(namesToRefresh);
        console.log(`Force refreshed: ${namesToRefresh.join(', ')}`);
    },
};

// Auto-initialize the cache when the module is loaded
ScryfallCache.init();

export default ScryfallCache;
