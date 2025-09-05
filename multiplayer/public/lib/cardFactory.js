import ScryfallCache from './scryfallCache.js';
import Pica from 'pica';

// Initialize Pica instance
const pica = new Pica();

var smallCutoff = 146; // Cards <= 146px wide use 'small' images
var mediumCutoff = 488; // Cards <= 488px wide use 'normal' images

// Function to update the cutoffs (called from client.js when settings change)
export function updateImageQualityCutoffs(enhanced = false) {
    if (enhanced) {
        smallCutoff = 488; // Use normal quality images more aggressively
        mediumCutoff = 672; // Use large quality images more aggressively
    } else {
        smallCutoff = 146; // Default small cutoff
        mediumCutoff = 488; // Default medium cutoff
    }
}

// Helper function to get optimal image size based on card width
function getOptimalImageSize(cardWidth) {
        return 'large';  // For large cards (full-size previews, high DPI displays)
}

// Helper function to get current card width from CSS or default
function getCurrentCardWidth() {
    const computedStyle = getComputedStyle(document.documentElement);
    return parseInt(computedStyle.getPropertyValue('--card-width')) || 80;
}

// Helper function to get image URI with optimal size
function getImageUriWithOptimalSize(imageUris, targetSize = 'normal') {
    if (!imageUris) return null;

    // Try to get the requested size, fallback to available sizes
    return imageUris[targetSize] ||
        imageUris.normal ||
        imageUris.large ||
        imageUris.small ||
        imageUris.png ||
        null;
}

// Helper function to find the correct face of a double-faced card
function findMatchingFace(scryfallData, requestedName, targetImageSize = 'normal') {
    // If it's not a multi-faced card, return the main card data
    if (!scryfallData.card_faces || scryfallData.card_faces.length <= 1) {
        return {
            imageUri: getImageUriWithOptimalSize(scryfallData.image_uris, targetImageSize),
            faceName: scryfallData.name
        };
    }

    // For adventure cards, always use the top-level image (they only have one image for both parts)
    if (scryfallData.layout === 'adventure') {
        return {
            imageUri: getImageUriWithOptimalSize(scryfallData.image_uris, targetImageSize),
            faceName: scryfallData.name
        };
    }

    // For true double-faced cards, try to match the requested name to a specific face
    const requestedLower = requestedName.toLowerCase().trim();

    // First, try exact face name matches
    for (const face of scryfallData.card_faces) {
        if (face.name.toLowerCase() === requestedLower) {
            return {
                imageUri: getImageUriWithOptimalSize(face.image_uris, targetImageSize),
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
                imageUri: getImageUriWithOptimalSize(face.image_uris, targetImageSize),
                faceName: face.name,
                isSpecificFace: true
            };
        }
    }

    // If no specific face matches, default to the first face
    return {
        imageUri: getImageUriWithOptimalSize(scryfallData.card_faces[0].image_uris, targetImageSize),
        faceName: scryfallData.card_faces[0].name,
        isSpecificFace: false
    };
}

function loadCardImage(card, imageUri, targetCardWidth) {
    // 1. Create a new Image object
    const img = document.createElement('img');
    img.src = imageUri;
    img.crossOrigin = 'anonymous'; // Handle CORS for Scryfall images
    img.alt = card.displayName || card.name;
    img.className = 'w-full h-full object-cover';
    // Improve loading performance
    img.loading = 'lazy';
    img.decoding = 'async';

    // 4. Listen for the image to load
    img.onload = () => {
        // Calculate the target height based on card aspect ratio (Magic cards are roughly 5:7)
        const cardAspectRatio = 7 / 5; // height / width
        const newHeight = Math.round(targetCardWidth * cardAspectRatio);
        
        // 5. Create a source canvas and draw the image onto it
        const fromCanvas = document.createElement('canvas');
        fromCanvas.width = img.naturalWidth;
        fromCanvas.height = img.naturalHeight;
        const fromCtx = fromCanvas.getContext('2d');
        fromCtx.drawImage(img, 0, 0);

        // 6. Create a destination canvas for the resized image
        const toCanvas = document.createElement('canvas');
        toCanvas.width = targetCardWidth;
        toCanvas.height = newHeight;

        // --- Ensure canvas fits container like the original image ---
        toCanvas.className = img.className;
        toCanvas.style.width = '100%';
        toCanvas.style.height = '100%';
        toCanvas.setAttribute('alt', img.alt); // for accessibility, though not standard for canvas
        toCanvas.setAttribute('role', 'img');
        // Optionally, add loading/decoding as data attributes for debugging
        toCanvas.setAttribute('data-loading', img.loading);
        toCanvas.setAttribute('data-decoding', img.decoding);
        // -----------------------------------------------------------

        // 7. Create Pica instance and resize the image
        const pica = new Pica();
        pica.resize(fromCanvas, toCanvas, {
            unsharpAmount: 0, // Sharper for text
            unsharpRadius: 0, // Slightly larger radius
            unsharpThreshold: 0.255 // Sharpen even faint edges
        }).then(result => {
            console.log('Resize complete!');
            // Replace the original img element with the resized canvas
            const parent = img.parentNode;
            if (parent) {
                parent.replaceChild(result, img);
            }
        }).catch(error => {
            console.error('Pica resize failed:', error);
            // Keep the original image if resize fails
        });
    };

    img.onerror = (ev) => {
        console.error("Failed to load image. Check the server's CORS configuration.", ev);
    };
    return img;
}

export function createCardElement(card, location, options) {
    const { isMagnifyEnabled, isInteractable, onCardClick, onCardDblClick, onCardDragStart, showBack = false, playerSelections = {}, playerColors = {} } = options;

    const cardEl = document.createElement('div');
    cardEl.className = 'card flex-shrink-0 cursor-grab';

    // Determine optimal image size based on context and card width
    let targetCardWidth = getCurrentCardWidth();
    let optimalImageSize;

    // Adjust target width based on location context
    if (location === 'magnified') {
        // For magnified hover previews, always use large image for best quality
        // This ensures the hover zoom always shows the highest resolution available
        optimalImageSize = 'large';
    } else {
        if (isMagnifyEnabled && location !== 'hand') {
            targetCardWidth = Math.max(targetCardWidth, 120); // Slightly larger for hover-enabled cards
        }
        optimalImageSize = getOptimalImageSize(targetCardWidth);
    }

    // Determine which image to show
    if (showBack) {
        // Show card back - for library cards, always use default cardback.png
        const forceDefault = location === 'library' || location === 'popped' || location === 'panel';
        const backImageSrc = ScryfallCache.getCardBack(card.name, forceDefault);
        const img = document.createElement('img');
        img.src = backImageSrc;
        img.alt = `${card.displayName || card.name} (back)`;
        img.className = 'w-full h-full object-cover';
        // Improve loading performance
        img.loading = 'lazy';
        img.decoding = 'async';
        cardEl.appendChild(img);
        cardEl.classList.add('has-image'); // Add black border for card backs
        cardEl.dataset.faceShown = 'back';
    } else {
        // Show card front
        if (card.isPlaceholder) {
            // Handle placeholder cards specially - try to show Scryfall image if available
            // For related cards, prefer lookup by Scryfall ID for precise matching
            let scryfallData = null;
            if (card.scryfallId) {
                // Try to get by specific Scryfall ID first (for related cards)
                scryfallData = ScryfallCache.getById(card.scryfallId);
                console.log(`Looking up related card by ID ${card.scryfallId}:`, scryfallData);
            }

            // Fallback to name-based lookup
            if (!scryfallData) {
                scryfallData = ScryfallCache.get(card.name);
                console.log(`Fallback lookup by name ${card.name}:`, scryfallData);
            }

            if (scryfallData) {
                // Placeholder has Scryfall data, find the correct face to display
                const faceData = findMatchingFace(scryfallData, card.name, optimalImageSize);

                if (faceData.imageUri) {
                    const img = document.createElement('img');
                    img.src = faceData.imageUri;
                    img.alt = card.displayName || card.name;
                    img.className = 'w-full h-full object-cover';
                    // Improve loading performance
                    img.loading = 'lazy';
                    img.decoding = 'async';
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
                        indicator.textContent = card.isRelatedCard ? 'RELATED' : 'TEMP';
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
            // For related cards, prefer lookup by Scryfall ID for precise matching
            let scryfallData = null;
            if (card.scryfallId) {
                // Try to get by specific Scryfall ID first (for related cards)
                scryfallData = ScryfallCache.getById(card.scryfallId);
            }

            // Fallback to name-based lookup
            if (!scryfallData) {
                scryfallData = ScryfallCache.get(card.name);
            }

            if (scryfallData) {
                // Use the optimal image size based on card width
                let imageUri = null;

                // Get the correct image URI based on card type with optimal sizing
                if (scryfallData.image_uris) {
                    // Single-faced cards and adventure cards have top-level image_uris
                    imageUri = getImageUriWithOptimalSize(scryfallData.image_uris, optimalImageSize);
                } else if (scryfallData.card_faces && scryfallData.card_faces.length > 0 && scryfallData.card_faces[0].image_uris) {
                    // True double-faced cards have image_uris in each face
                    imageUri = getImageUriWithOptimalSize(scryfallData.card_faces[0].image_uris, optimalImageSize);
                }

                if (imageUri) {
                    const img = loadCardImage(card, imageUri, targetCardWidth);
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
            // Prevent double-click events from bubbling up to the card
            counterEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        } else {
            counterEl.style.pointerEvents = 'none';
        }

        cardEl.appendChild(counterEl);
    }

    // Magnify on hover logic
    cardEl.addEventListener('mouseenter', (e) => {
        // Set global hover state for keyboard shortcuts
        if (window.setHoveredCard) {
            window.setHoveredCard(card, cardEl);
        }

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
        // Clear global hover state for keyboard shortcuts
        if (window.clearHoveredCard) {
            window.clearHoveredCard();
        }

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

            // Create custom drag image with current card size
            // Get the current card width from CSS variable or default
            const computedStyle = getComputedStyle(document.documentElement);
            const currentCardWidth = parseInt(computedStyle.getPropertyValue('--card-width')) || 80;

            const customDragImage = createCustomDragImage(cardEl, currentCardWidth);

            // Set the custom drag image
            e.dataTransfer.setDragImage(customDragImage, currentCardWidth / 2, (currentCardWidth * (107 / 80)) / 2);

            // Clean up the temporary drag image after drag operation starts
            setTimeout(() => {
                if (customDragImage && customDragImage.parentNode) {
                    customDragImage.parentNode.removeChild(customDragImage);
                }
            }, 10);

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

            // Check if the double-click originated from a counter element
            if (e.target.classList.contains('card-counter') ||
                e.target.closest('.card-counter')) {
                return; // Ignore double-clicks on counters
            }

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

    // Add selection labels if other players have this card selected
    if (playerSelections && playerColors && card.id) {
        const playersWithThisCardSelected = [];
        for (const [playerId, selectedCards] of Object.entries(playerSelections)) {
            // Skip the current player's own selections
            if (playerId === window.playerId) continue;

            if (selectedCards && selectedCards.includes(card.id)) {
                playersWithThisCardSelected.push(playerId);
            }
        }

        if (playersWithThisCardSelected.length > 0) {
            // Create a wrapper div to hold both card and labels without overflow constraints
            const cardWrapper = document.createElement('div');
            cardWrapper.style.position = 'relative';
            cardWrapper.style.display = 'inline-block';

            // Move the card element into the wrapper (we'll return the wrapper instead)
            const originalParent = cardEl.parentNode;

            const selectionLabelsContainer = document.createElement('div');
            selectionLabelsContainer.className = 'selection-labels absolute pointer-events-none';

            // Position the container to the right side of the card
            selectionLabelsContainer.style.left = '100%';
            selectionLabelsContainer.style.top = '0';
            selectionLabelsContainer.style.bottom = '0';
            selectionLabelsContainer.style.paddingLeft = '4px';
            selectionLabelsContainer.style.zIndex = '1000';
            selectionLabelsContainer.style.minWidth = '80px'; // Ensure enough space for labels

            // Create a flexbox layout that stacks vertically
            selectionLabelsContainer.style.display = 'flex';
            selectionLabelsContainer.style.flexDirection = 'column';
            selectionLabelsContainer.style.gap = '2px';
            selectionLabelsContainer.style.justifyContent = 'flex-start';
            selectionLabelsContainer.style.alignItems = 'flex-start';

            playersWithThisCardSelected.forEach(playerId => {
                // Get player display name from gameState if available
                let playerName = playerId;
                if (window.gameState && window.gameState.players && window.gameState.players[playerId]) {
                    playerName = window.gameState.players[playerId].displayName || playerId;
                }

                const label = document.createElement('div');
                label.className = 'selection-label text-xs font-bold px-1 py-0.5 rounded text-white shadow-sm';
                label.style.backgroundColor = playerColors[playerId] || '#6b7280';
                label.style.fontSize = '10px';
                label.style.lineHeight = '1.2';
                label.style.textAlign = 'center';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
                label.style.flexShrink = '0'; // Prevent shrinking
                label.style.maxWidth = '80px'; // Max width for labels
                label.style.minHeight = '16px'; // Ensure minimum height
                label.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                label.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
                label.style.padding = '2px 4px';
                label.textContent = playerName;

                selectionLabelsContainer.appendChild(label);
            });

            cardWrapper.appendChild(cardEl);
            cardWrapper.appendChild(selectionLabelsContainer);

            return cardWrapper;
        }
    }

    return cardEl;
}

// Helper function to create a custom drag image with the current card size
function createCustomDragImage(originalCard, currentCardWidth) {
    // Create a clone of the card element
    const dragImage = originalCard.cloneNode(true);

    // Force the drag image to use the current card width
    dragImage.style.width = `${currentCardWidth}px`;
    dragImage.style.height = `${currentCardWidth * (107 / 80)}px`;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px'; // Hide it off-screen
    dragImage.style.left = '-9999px';
    dragImage.style.pointerEvents = 'none';
    dragImage.style.opacity = '0.8'; // Make it slightly transparent
    dragImage.style.transform = 'none'; // Remove any transforms
    dragImage.style.zIndex = '999999';

    // Override CSS variables for this specific element
    dragImage.style.setProperty('--card-width', `${currentCardWidth}px`);

    // Add to document temporarily
    document.body.appendChild(dragImage);

    return dragImage;
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
            // Determine optimal image size for the current card
            const targetCardWidth = getCurrentCardWidth();
            const optimalImageSize = getOptimalImageSize(targetCardWidth);
            let frontImageUri = null;

            // Get the correct front image URI based on card type with optimal sizing
            if (scryfallData.image_uris) {
                // Single-faced cards and adventure cards have top-level image_uris
                frontImageUri = getImageUriWithOptimalSize(scryfallData.image_uris, optimalImageSize);
            } else if (scryfallData.card_faces && scryfallData.card_faces.length > 0 && scryfallData.card_faces[0].image_uris) {
                // True double-faced cards have image_uris in each face
                frontImageUri = getImageUriWithOptimalSize(scryfallData.card_faces[0].image_uris, optimalImageSize);
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

// Export helper functions for external use and debugging
export { getOptimalImageSize, getCurrentCardWidth, getImageUriWithOptimalSize };

// Utility function for debugging - shows what image size would be selected
export function analyzeImageSelection(cardWidth) {
    const size = getOptimalImageSize(cardWidth);
    const resolutions = {
        small: '146×204',
        normal: '488×680',
        large: '672×936'
    };

    return {
        cardWidth,
        selectedSize: size,
        resolution: resolutions[size],
        reasoning: cardWidth <= 100 ? 'Small cards need less detail' :
            cardWidth <= 200 ? 'Medium cards benefit from normal resolution' :
                'Large cards need high resolution for crisp display'
    };
}