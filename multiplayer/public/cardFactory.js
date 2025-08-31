import ScryfallCache from './scryfallCache.js';

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
        // Show card front (existing logic)
        const scryfallData = ScryfallCache.get(card.name);
        if (scryfallData) {
            let imageUri = null;
            
            // For double-faced cards, get image from the first face
            if (scryfallData.card_faces && scryfallData.card_faces.length > 0) {
                imageUri = scryfallData.card_faces[0].image_uris?.normal;
            } 
            // For single-faced cards, get image from main object
            else if (scryfallData.image_uris) {
                imageUri = scryfallData.image_uris.normal;
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
        cardEl.dataset.faceShown = 'front';
    }
    
    cardEl.dataset.id = card.id;
    cardEl.dataset.name = card.name;
    cardEl.classList.toggle('magnified-card', isMagnifyEnabled);

    // Add counter display if card has counters
    if (card.counters && card.counters > 0) {
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
        const previewWidth = 240;
        const previewHeight = 320;
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
        preview.className = 'fixed pointer-events-none shadow-2xl rounded-lg border-4 border-blue-600 bg-gray-900 p-4';
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
    const cardName = cardEl.dataset.name;
    const currentFace = cardEl.dataset.faceShown;
    const hasBackFace = ScryfallCache.hasBackFace(cardName);
    
    if (!hasBackFace) {
        console.log('Card has no back face to flip to');
        return false;
    }
    
    const img = cardEl.querySelector('img');
    if (!img) return false;
    
    if (currentFace === 'front') {
        // Flip to back
        const backImageSrc = ScryfallCache.getCardBack(cardName);
        img.src = backImageSrc;
        img.alt = `${cardName} (back)`;
        cardEl.dataset.faceShown = 'back';
    } else {
        // Flip to front
        const scryfallData = ScryfallCache.get(cardName);
        if (scryfallData) {
            let frontImageUri = null;
            
            // For double-faced cards, get front face image
            if (scryfallData.card_faces && scryfallData.card_faces.length > 0) {
                frontImageUri = scryfallData.card_faces[0].image_uris?.normal;
            } 
            // For single-faced cards, get image from main object
            else if (scryfallData.image_uris) {
                frontImageUri = scryfallData.image_uris.normal;
            }
            
            if (frontImageUri) {
                img.src = frontImageUri;
                img.alt = cardName;
                cardEl.dataset.faceShown = 'front';
            }
        }
    }
    
    return true;
}