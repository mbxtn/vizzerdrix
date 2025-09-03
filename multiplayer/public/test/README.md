# ScryfallCache Test Suite

This folder contains all test files for the ScryfallCache functionality used in the card game.

## Test Files Overview

### Core Functionality Tests
- **`testProgress.html`** - Main progress testing with image display
- **`index.html`** - Test suite navigation page

### Adventure Card Tests
- **`testAdventureCards.html`** - Comprehensive adventure card testing
- **`debugTest.html`** - Debug output for adventure card loading
- **`simpleTest.html`** - Simple adventure card validation

### Image Testing
- **`fixValidation.html`** - Validates the image fix for adventure cards
- **`imageDebug.html`** - Debug image URL extraction
- **`directImageTest.html`** - Direct image URL testing
- **`canvasScalingDemo.html`** - Canvas-based high-quality image scaling demo
- **`imageSizeSelectionDemo.html`** - Dynamic image size selection based on card width

### Legacy Tests
- **`testScryfallCache.js`** - Node.js test script (use `node testScryfallCache.js`)
- **`testScript.js`** - Manual browser console test script

## How to Run Tests

1. **Start a local server** from the `multiplayer/public` directory:
   ```bash
   cd multiplayer/public
   python3 -m http.server 8080
   ```

2. **Open the test suite** in your browser:
   ```
   http://localhost:8080/test/
   ```

3. **Run individual tests** by clicking on the test links in the index page.

## What the Tests Validate

### ✅ Adventure Card Support
- Loading adventure cards like "Gumdrop Poisoner"
- Proper image URL extraction for adventure cards
- Correct layout detection (`layout: "adventure"`)
- Cache storage under multiple names

### ✅ Image Display Fixes
- Adventure cards use top-level `image_uris`
- Double-faced cards use `card_faces[].image_uris`
- Proper fallback behavior
- CORS and loading validation

### ✅ Cache Performance
- Progress reporting during loading
- Cache hit/miss behavior
- LocalStorage persistence
- Cache version management

## Recent Bug Fixes

### Adventure Card Image Issue (Fixed)
**Problem**: Adventure cards weren't displaying images because the image extraction logic was incorrect.

**Root Cause**: The code was checking `card_faces[0].image_uris` for adventure cards, but adventure cards have `image_uris` at the top level, not in the faces.

**Solution**: Updated `cardFactory.js` to check top-level `image_uris` first, then fall back to card faces for true double-faced cards.

### Cache Logic Improvements
- Adventure cards are no longer treated as having back faces
- Proper layout-based logic for different card types
- Improved fuzzy search for partial names

## Image Size Selection Feature

### Benefits
- **High-quality downscaling** - Uses canvas with `imageSmoothingQuality: 'high'`
- **Better performance** - Cached scaled images reduce repeated scaling operations
- **Automatic scaling detection** - Only scales when beneficial (cards < 300px width)
- **Memory management** - LRU cache with size limits to prevent memory leaks
- **Backward compatibility** - Gradual migration path from standard image scaling
- **Optimal image sizing** - Automatically selects small/normal/large Scryfall images based on card width

### Image Size Selection

The system automatically chooses the most appropriate Scryfall image size based on the card's display width:

- **Small (146×204px)** - For cards ≤100px width (mobile, small displays)
- **Normal (488×680px)** - For cards 101-200px width (standard desktop)
- **Large (672×936px)** - For cards >200px width (magnified previews, high DPI)

This ensures optimal balance between image quality and loading performance.

## File Structure After Organization

```
multiplayer/public/
├── scryfallCache.js        # Main cache implementation
├── cardFactory.js          # Card display logic (fixed)
├── test/                   # All test files (this folder)
│   ├── index.html         # Test navigation
│   ├── testProgress.html  # Main test page
│   ├── ...other tests...
│   └── README.md          # This file
└── ...other game files...
```
