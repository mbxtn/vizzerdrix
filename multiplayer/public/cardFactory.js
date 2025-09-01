import ScryfallCache from './scryfallCache.js';

// Helper function to find the correct face of a double-faced card
function findMatchingFace(scryfallData, requestedName) {
    // If it's not a multi-faced card, return the main card data
    if (!scryfallData.card_faces || scryfallData.card_faces.length <= 1) {
        return { imageUri: scryfallData.image_uris?.normal, faceName: scryfallData.name };
    }
    
    // For adventure cards, always use the top-level image (they only have one image for both parts)
    if (scryfallData.layout === 'adventure') {
        return { imageUri: scryfallData.image_uris?.normal, faceName: scryfallData.name };
    }
    
    // For true double-faced cards, try to match the requested name to a specific face
    const requestedLower = requestedName.toLowerCase().trim();
    
    // First, try exact face name matches
    for (const face of scryfallData.card_faces) {
        if (face.name.toLowerCase() === requestedLower) {
            return { 
                imageUri: face.image_uris?.normal, 
                faceName: face.name,
                isSpecificFace: true 
            };
        }
    }
    
    // Then try partial matches (requested name contains face name or vice versa)
    for (const face of scryfallData.card_faces) {
        const faceLower = face.name.toLowerCase();
        if (requestedLower.includes(faceLower) || faceLower.includes(requestedLower)) {
            return { 
                imageUri: face.image_uris?.normal, 
                faceName: face.name,
                isSpecificFace: true 
            };
        }
    }
    
    // If no specific face matches, default to the first face
    return { 
        imageUri: scryfallData.card_faces[0].image_uris?.normal, 
        faceName: scryfallData.card_faces[0].name,
        isSpecificFace: false 
    };
}

export function createCardElement(card, location, options) {
    const { isMagnifyEnabled, isInteractable, onCardClick, onCardDblClick, onCardDragStart, showBack = false } = options;

    const cardEl = document.createElement('div');
    cardEl.className = 'card flex-shrink-0 cursor-grab';
    
    // Determine which image to show
    if (showBack) {
        // Show card back - for library cards, always use default cardback.png
        const forceDefault = location === 'library' || location === 'popped' || location === 'panel';
        const backImageSrc = ScryfallCache.getCardBack(card.name, forceDefault);
        const img = document.createElement('img');
        img.src = backImageSrc;
        img.alt = `${card.displayName || card.name} (back)`;
        img.className = 'w-full h-full object-cover';
        cardEl.appendChild(img);
        cardEl.classList.add('has-image'); // Add black border for card backs
        cardEl.dataset.faceShown = 'back';
    } else {
        // Show card front
        if (card.isPlaceholder) {
            // Handle placeholder cards specially - try to show Scryfall image if available
            const scryfallData = ScryfallCache.get(card.name);
            if (scryfallData) {
                // Placeholder has Scryfall data, find the correct face to display
                const faceData = findMatchingFace(scryfallData, card.name);
                
                if (faceData.imageUri) {
                    const img = document.createElement('img');
                    img.src = faceData.imageUri;
                    img.alt = card.displayName || card.name;
                    img.className = 'w-full h-full object-cover';
                    cardEl.appendChild(img);
                    cardEl.classList.add('has-image');
                    
                    // Add a subtle indicator that this is a placeholder/copy
                    if (card.isCopy) {
                        cardEl.classList.add('placeholder-copy');
                        const indicator = document.createElement('div');
                        indicator.className = 'absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded opacity-75';
                        indicator.textContent = 'COPY';
                        cardEl.appendChild(indicator);
                    } else {
                        cardEl.classList.add('placeholder-card');
                        const indicator = document.createElement('div');
                        indicator.className = 'absolute top-1 right-1 bg-orange-500 text-white text-xs px-1 rounded opacity-75';
                        indicator.textContent = 'TEMP';
                        cardEl.appendChild(indicator);
                    }
                } else {
                    // Scryfall data exists but no image - show placeholder with name
                    cardEl.innerHTML = `
                        <div class="w-full h-full bg-gray-300 border-2 border-dashed border-gray-400 rounded-md flex items-center justify-center p-2">
                            <div class="text-center text-gray-700 text-sm font-medium break-words">
                                ${card.displayName || card.name}
                            </div>
                        </div>
                    `;
                    cardEl.classList.add('placeholder-card');
                }
            } else {
                // No Scryfall data, show traditional placeholder
                cardEl.innerHTML = `
                    <div class="w-full h-full bg-gray-300 border-2 border-dashed border-gray-400 rounded-md flex items-center justify-center p-2">
                        <div class="text-center text-gray-700 text-sm font-medium break-words">
                            ${card.displayName || card.name}
                        </div>
                    </div>
                `;
                cardEl.classList.add('placeholder-card');
            }
        } else {
            // Show card front (existing logic)
            const scryfallData = ScryfallCache.get(card.name);
            if (scryfallData) {
                let imageUri = null;
                
                // Get the correct image URI based on card type
                if (scryfallData.image_uris) {
                    // Single-faced cards and adventure cards have top-level image_uris
                    imageUri = scryfallData.image_uris.normal;
                } else if (scryfallData.card_faces && scryfallData.card_faces.length > 0 && scryfallData.card_faces[0].image_uris) {
                    // True double-faced cards have image_uris in each face
                    imageUri = scryfallData.card_faces[0].image_uris.normal;
                }
                
                if (imageUri) {
                    const img = document.createElement('img');
                    img.src = imageUri;
                    img.alt = card.displayName || card.name;
                    img.className = 'w-full h-full object-cover';
                    cardEl.appendChild(img);
                    cardEl.classList.add('has-image'); // Add black border for cards with images
                } else {
                    cardEl.textContent = card.displayName || card.name;
                }
            } else {
                cardEl.textContent = card.displayName || card.name;
            }
        }
        cardEl.dataset.faceShown = 'front';
    }
    
    cardEl.dataset.id = card.id;
    cardEl.dataset.name = card.name;
    cardEl.classList.toggle('magnified-card', isMagnifyEnabled);

    // Add counter display if card has counters (including negative counters)
    if (card.counters && card.counters !== 0) {
        const counterEl = document.createElement('div');
        counterEl.className = 'card-counter';
        counterEl.textContent = card.counters;
        counterEl.style.userSelect = 'none';
        
        // Make counter clickable if onCounterClick is provided
        if (options.onCounterClick) {
            counterEl.style.cursor = 'pointer';
            counterEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                options.onCounterClick(e, card, e.shiftKey);
            });
        } else {
            counterEl.style.pointerEvents = 'none';
        }
        
        cardEl.appendChild(counterEl);
    }

    // Magnify on hover logic
    cardEl.addEventListener('mouseenter', (e) => {
        if (!isMagnifyEnabled) return;
        // Remove any existing preview
        const oldPreview = document.getElementById('magnify-preview');
        if (oldPreview) oldPreview.remove();
        
        // Check if side panel is open - improved detection for race conditions
        const sidePanel = document.querySelector('.card-zone-side-panel');
        let isPanelOpen = false;
        
        if (sidePanel) {
            const rect = sidePanel.getBoundingClientRect();
            const transform = sidePanel.style.transform;
            
            // Multiple ways to detect if panel is open (handles race conditions)
            isPanelOpen = (
                // Method 1: Transform is set to translateX(0)
                transform === 'translateX(0)' || 
                transform === 'translateX(0px)' ||
                // Method 2: Panel is visible and positioned at right edge (more reliable)
                (rect.width > 0 && rect.right >= window.innerWidth - 10) ||
                // Method 3: Panel left edge is within viewport (panel is sliding in/open)
                (rect.left < window.innerWidth && rect.left > window.innerWidth - 400)
            );
        }
        
        // Find play zone container and position preview accordingly
        const playZoneContainer = document.getElementById('play-zones-container');
        if (!playZoneContainer) return;
        const rect = playZoneContainer.getBoundingClientRect();
        
        // Calculate position
        // Get dynamic preview size from global variable, fallback to defaults
        const previewSize = window.magnifyPreviewSize || { width: 320, height: 430 };
        const previewWidth = previewSize.width;
        const previewHeight = previewSize.height;
        let left, top;
        
        if (isPanelOpen) {
            // Position to the left of the side panel
            const panelRect = sidePanel.getBoundingClientRect();
            left = panelRect.left - previewWidth - 16;
            top = Math.max(16, panelRect.top + 60); // Align with panel content, add some top margin
            
            // Ensure it doesn't go off the left edge
            if (left < 16) {
                left = 16;
            }
        } else {
            // Original positioning to the right of play zone
            left = rect.right + 32;
            top = rect.top;
            
            // Ensure it stays in viewport (original logic)
            if (left + previewWidth > window.innerWidth) {
                left = window.innerWidth - previewWidth - 16;
            }
        }
        
        // Ensure top positioning stays in viewport
        if (top + previewHeight > window.innerHeight) {
            top = window.innerHeight - previewHeight - 16;
        }
        
        // Create preview container
        const preview = document.createElement('div');
        preview.id = 'magnify-preview';
        preview.className = 'fixed pointer-events-none shadow-2xl rounded-lg border-4 border-blue-600 bg-gray-900';
        preview.style.width = previewWidth + 'px';
        preview.style.height = previewHeight + 'px';
        preview.style.left = left + 'px';
        preview.style.top = top + 'px';
        preview.style.zIndex = '999999'; // Extremely high z-index
        preview.style.position = 'fixed';
        preview.style.pointerEvents = 'none';
        preview.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        
        // Create magnified card element (recursive call but with magnify disabled)
        // Detect the current face being shown
        const currentFaceShown = cardEl.dataset.faceShown || 'front';
        const shouldShowBack = currentFaceShown === 'back';
        
        const magnifiedCard = createCardElement(card, 'magnified', {
            isMagnifyEnabled: false, // Prevent infinite recursion
            isInteractable: false,
            onCardClick: null,
            onCardDblClick: null,
            onCardDragStart: null,
            showBack: shouldShowBack // Show the same face as the original card
        });
        
        // Style the magnified card to fill the preview
        magnifiedCard.style.width = '100%';
        magnifiedCard.style.height = '100%';
        magnifiedCard.style.cursor = 'default';
        magnifiedCard.style.transform = 'none';
        magnifiedCard.style.boxShadow = 'none';
        magnifiedCard.style.border = 'none';
        
        preview.appendChild(magnifiedCard);
        
        // Append to body as the last element to ensure it's on top
        document.body.appendChild(preview);
    });
    cardEl.addEventListener('mouseleave', () => {
        const preview = document.getElementById('magnify-preview');
        if (preview) preview.remove();
    });

    cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onCardClick) {
            onCardClick(e, card, cardEl, location);
        }
    });

    if (isInteractable) {
        cardEl.setAttribute('draggable', 'true');
        
        let dragStartTimeout = null;
        let isDragging = false;
        let doubleClickDetected = false;
        
        cardEl.addEventListener('mousedown', (e) => {
            // Clear any pending drag start
            if (dragStartTimeout) {
                clearTimeout(dragStartTimeout);
                dragStartTimeout = null;
            }
            
            // Delay drag start to allow for double-click detection
            dragStartTimeout = setTimeout(() => {
                if (!doubleClickDetected) {
                    cardEl.setAttribute('draggable', 'true');
                }
            }, 200); // 200ms delay to allow for double-click
        });
        
        cardEl.addEventListener('dragstart', (e) => {
            if (doubleClickDetected) {
                e.preventDefault();
                return;
            }
            isDragging = true;
            if (onCardDragStart) {
                onCardDragStart(e, card, location);
            }
        });
        
        cardEl.addEventListener('dragend', () => {
            isDragging = false;
            setTimeout(() => {
                doubleClickDetected = false;
            }, 100);
        });

        cardEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Mark that double-click was detected to prevent drag
            doubleClickDetected = true;
            cardEl.setAttribute('draggable', 'false');
            
            // Clear any pending drag start
            if (dragStartTimeout) {
                clearTimeout(dragStartTimeout);
                dragStartTimeout = null;
            }
            
            if (onCardDblClick) {
                onCardDblClick(e, card, location);
            }
            
            // Re-enable dragging after a short delay
            setTimeout(() => {
                cardEl.setAttribute('draggable', 'true');
                doubleClickDetected = false;
            }, 300);
        });
    } else {
        cardEl.setAttribute('draggable', 'false');
    }

    return cardEl;
}

// Function to flip a card between front and back
export function flipCard(cardEl) {
    // Check if this is a placeholder card - placeholder cards are not flippable
    const isPlaceholder = cardEl.classList.contains('placeholder-card') || cardEl.classList.contains('placeholder-copy');
    
    if (isPlaceholder) {
        console.log('Placeholder cards cannot be flipped');
        return false;
    }
    
    const cardName = cardEl.dataset.name;
    const currentFace = cardEl.dataset.faceShown;
    
    // Handle regular card flipping
    const img = cardEl.querySelector('img');
    if (!img) return false;
    
    if (currentFace === 'front') {
        // Flip to back - all cards can show a back face
        const backImageSrc = ScryfallCache.getCardBack(cardName);
        img.src = backImageSrc;
        img.alt = `${cardName} (back)`;
        cardEl.dataset.faceShown = 'back';
    } else {
        // Flip to front
        const scryfallData = ScryfallCache.get(cardName);
        if (scryfallData) {
            let frontImageUri = null;
            
            // Get the correct front image URI based on card type
            if (scryfallData.image_uris) {
                // Single-faced cards and adventure cards have top-level image_uris
                frontImageUri = scryfallData.image_uris.normal;
            } else if (scryfallData.card_faces && scryfallData.card_faces.length > 0 && scryfallData.card_faces[0].image_uris) {
                // True double-faced cards have image_uris in each face
                frontImageUri = scryfallData.card_faces[0].image_uris.normal;
            }
            
            if (frontImageUri) {
                img.src = frontImageUri;
                img.alt = cardName;
                cardEl.dataset.faceShown = 'front';
            }
        } else {
            // No Scryfall data, but still flip to front (show card name)
            img.alt = cardName;
            cardEl.dataset.faceShown = 'front';
        }
    }
    
    return true;
}