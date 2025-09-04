// scryfallCache.js
// Browser-compatible Scryfall card cache for local use
// Usage: await ScryfallCache.load(['Black Lotus', 'Lightning Bolt'])
//        const card = ScryfallCache.get('Black Lotus')

const ScryfallCache = {
    _cache: {},
    _cardBackCache: {},
    _cacheVersion: '1.0', // Version for cache invalidation if needed

    // Initialize cache from localStorage
    _initCache() {
        try {
            const savedCache = localStorage.getItem('scryfallCache');
            const savedBackCache = localStorage.getItem('scryfallBackCache');
            const savedVersion = localStorage.getItem('scryfallCacheVersion');
            
            // Only load if version matches (allows cache invalidation)
            if (savedVersion === this._cacheVersion) {
                if (savedCache) {
                    this._cache = JSON.parse(savedCache);
                }
                if (savedBackCache) {
                    this._cardBackCache = JSON.parse(savedBackCache);
                }
                console.log(`Loaded ${Object.keys(this._cache).length} cards from cache`);
            } else {
                console.log('Cache version mismatch, starting fresh');
                this._clearLocalStorage();
            }
        } catch (error) {
            console.error('Error loading cache from localStorage:', error);
            this._clearLocalStorage();
        }
    },

    // Save cache to localStorage
    _saveCache() {
        // Use setTimeout to make cache saving non-blocking
        setTimeout(() => {
            try {
                localStorage.setItem('scryfallCache', JSON.stringify(this._cache));
                localStorage.setItem('scryfallBackCache', JSON.stringify(this._cardBackCache));
                localStorage.setItem('scryfallCacheVersion', this._cacheVersion);
            } catch (error) {
                console.error('Error saving cache to localStorage:', error);
                // If localStorage is full or unavailable, clear some old entries
                this._clearOldCacheEntries();
            }
        }, 0);
    },

    // Clear localStorage cache
    _clearLocalStorage() {
        localStorage.removeItem('scryfallCache');
        localStorage.removeItem('scryfallBackCache');
        localStorage.removeItem('scryfallCacheVersion');
    },

    // Clear old cache entries if storage is full
    _clearOldCacheEntries() {
        // Keep only the most recently used cards (simple approach)
        const cacheKeys = Object.keys(this._cache);
        if (cacheKeys.length > 500) { // Keep only 500 most recent cards
            const keysToRemove = cacheKeys.slice(0, cacheKeys.length - 500);
            keysToRemove.forEach(key => {
                delete this._cache[key];
                delete this._cardBackCache[key];
            });
            this._saveCache();
        }
    },

    async load(cardNames, progressCallback = null) {
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }
        
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
            const batchPromises = batch.map(async (name) => {
                if (this._cache[name]) return; // Double-check in case of race conditions
                
                try {
                    let data = null;
                    let finalName = name;
                    
                    // First try exact match
                    let resp = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
                    
                    if (!resp.ok) {
                        // If exact match fails, try fuzzy search for potential double-faced cards or adventure cards
                        const fuzzyResp = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                        if (fuzzyResp.ok) {
                            const fuzzyData = await fuzzyResp.json();
                            // Check if this is a multi-faced card and our search term matches one face
                            if (fuzzyData.card_faces && fuzzyData.card_faces.length > 1) {
                                const matchesFace = fuzzyData.card_faces.some(face => 
                                    face.name.toLowerCase().includes(name.toLowerCase()) ||
                                    name.toLowerCase().includes(face.name.toLowerCase())
                                );
                                if (matchesFace) {
                                    data = fuzzyData;
                                    finalName = fuzzyData.name; // Use the full card name
                                }
                            } else if (fuzzyData.name.toLowerCase().includes(name.toLowerCase()) ||
                                      name.toLowerCase().includes(fuzzyData.name.toLowerCase())) {
                                // Also accept close matches for single-faced cards
                                data = fuzzyData;
                                finalName = fuzzyData.name;
                            }
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
                    
                    // Load card back asynchronously if it's a true double-faced card (not adventure)
                    if (data.card_faces && data.card_faces.length > 1 && data.layout !== 'adventure') {
                        // Don't await - let it load in background
                        this._loadCardBack(data.id, data.name).catch(err => 
                            console.error('Background card back load failed:', err)
                        );
                        if (finalName !== name) {
                            this._loadCardBack(data.id, finalName).catch(err => 
                                console.error('Background card back load failed:', err)
                            );
                        }
                    }
                    
                    return name;
                } catch (err) {
                    console.error('Scryfall error:', name, err);
                    this._cache[name] = null;
                    return name;
                }
            });
            
            // Wait for all cards in this batch to complete
            const completedCards = await Promise.all(batchPromises);
            
            // Update progress for all completed cards in this batch
            completedCards.forEach(name => {
                if (name) {
                    loadedCards++;
                    if (progressCallback) {
                        progressCallback(loadedCards, totalCards, name);
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
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }
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
        
        // Check if this card has multiple faces (double-faced card, not adventure)
        const cardData = this._cache[name];
        if (cardData && cardData.card_faces && cardData.card_faces.length > 1 && cardData.layout !== 'adventure') {
            // If it's a double-faced card but we don't have the back cached, try to generate the URL
            return `https://api.scryfall.com/cards/${cardData.id}?format=image&face=back&version=normal`;
        }
        
        // Default to our local card back image for single-faced cards
        return './cardback.png';
    },

    hasBackFace(name) {
        const cardData = this._cache[name];
        return cardData && cardData.card_faces && cardData.card_faces.length > 1 && cardData.layout !== 'adventure';
    },

    getAll() {
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }
        return { ...this._cache };
    },

    // Get cache statistics
    getCacheStats() {
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }
        return {
            totalCards: Object.keys(this._cache).length,
            totalBackImages: Object.keys(this._cardBackCache).length,
            cacheVersion: this._cacheVersion
        };
    },

    // Clear all cache (useful for debugging)
    clearCache() {
        this._cache = {};
        this._cardBackCache = {};
        this._clearLocalStorage();
        console.log('Cache cleared');
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
                // Check if any face matches our search term (works for both DFCs and adventure cards)
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

    // Helper to check if a card name looks like it might be a partial double-faced card name or adventure
    mightBePartialCard(name) {
        // Simple heuristics - these are common single face names that are part of DFCs or adventures
        const commonDFCPatterns = [
            /^(Stump|Stomp)$/i,
            /Clearing$/i,
            /^Boseiju/i,
            // Add more patterns as needed
        ];
        
        // Common adventure spell patterns
        const commonAdventurePatterns = [
            /^Tempt with/i,
            /^Curious Pair$/i,
            /^Treats to Share$/i,
            /^Bake into a Pie$/i,
            /^Spinning Wheel$/i,
            // Add more patterns as needed
        ];
        
        return commonDFCPatterns.some(pattern => pattern.test(name)) ||
               commonAdventurePatterns.some(pattern => pattern.test(name));
    },

    // Check if a card is an adventure card
    isAdventureCard(name) {
        const cardData = this._cache[name];
        return cardData && cardData.layout === 'adventure';
    },

    // Get the adventure spell name from an adventure card
    getAdventureSpellName(name) {
        const cardData = this._cache[name];
        if (cardData && cardData.layout === 'adventure' && cardData.card_faces && cardData.card_faces.length > 1) {
            // Adventure spell is typically the second face
            return cardData.card_faces[1].name;
        }
        return null;
    },

    // Get the creature name from an adventure card
    getCreatureName(name) {
        const cardData = this._cache[name];
        if (cardData && cardData.layout === 'adventure' && cardData.card_faces && cardData.card_faces.length > 1) {
            // Creature is typically the first face
            return cardData.card_faces[0].name;
        }
        return null;
    },

    // Test function to verify double-faced card and adventure card resolution
    async testCardResolution() {
        console.log('Testing double-faced card and adventure card resolution...');
        const testCards = [
            'Stump', 'Stomp', 'Stump Stomp //  Burnwillow Clearing', // DFC test
            'Gumdrop Poisoner', 'Tempt with Treats', 'Gumdrop Poisoner // Tempt with Treats' // Adventure test
        ];
        
        for (const cardName of testCards) {
            console.log(`Testing: "${cardName}"`);
            await this.load([cardName]);
            const result = this.get(cardName);
            if (result) {
                const cardType = result.layout === 'adventure' ? 'Adventure' : 
                               result.card_faces ? 'DFC' : 'Single-faced';
                console.log(`✅ Found: "${result.name}" (${cardType})`);
                
                if (result.layout === 'adventure') {
                    console.log(`   Creature: ${this.getCreatureName(cardName)}`);
                    console.log(`   Adventure: ${this.getAdventureSpellName(cardName)}`);
                }
            } else {
                console.log(`❌ Not found: "${cardName}"`);
            }
        }
    },

    // Load cards by their Scryfall ID (extracted from URI)
    async loadById(cardUri, cardName = null) {
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }

        // Extract the card ID from the URI
        // URI format: https://api.scryfall.com/cards/{id}
        const cardId = cardUri.split('/').pop();
        
        console.log(`Loading card by ID: ${cardId} (name: ${cardName || 'unknown'})`);
        
        // Check if we already have this card cached by ID
        const cacheKey = `id:${cardId}`;
        if (this._cache[cacheKey]) {
            console.log(`Card with ID ${cardId} already cached`);
            return this._cache[cacheKey];
        }
        
        try {
            // Fetch the card by ID directly
            const resp = await fetch(`https://api.scryfall.com/cards/${cardId}`);
            if (!resp.ok) {
                throw new Error(`Scryfall fetch failed for ID ${cardId}: ${resp.status}`);
            }
            
            const data = await resp.json();
            
            // Cache under both the ID key and the name key (if provided)
            this._cache[cacheKey] = data;
            if (cardName) {
                this._cache[cardName] = data;
            }
            // Also cache under the card's actual name from the API response
            if (data.name && data.name !== cardName) {
                this._cache[data.name] = data;
            }
            
            console.log(`Successfully loaded and cached card: ${data.name} (ID: ${cardId})`);
            
            // Load card back asynchronously if it's a true double-faced card (not adventure)
            if (data.card_faces && data.card_faces.length > 1 && data.layout !== 'adventure') {
                this._loadCardBack(data.id, data.name).catch(err => 
                    console.error('Background card back load failed:', err)
                );
            }
            
            // Save cache
            this._saveCache();
            
            return data;
        } catch (error) {
            console.error('Error loading card by ID:', cardId, error);
            this._cache[cacheKey] = null;
            if (cardName) {
                this._cache[cardName] = null;
            }
            return null;
        }
    },

    // Get card data by Scryfall ID
    getById(cardId) {
        // Initialize cache from localStorage if not already done
        if (Object.keys(this._cache).length === 0) {
            this._initCache();
        }
        const cacheKey = `id:${cardId}`;
        return this._cache[cacheKey] || null;
    },
};

export default ScryfallCache;
