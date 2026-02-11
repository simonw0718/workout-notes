# Release Notes - February 11, 2026

## 🎯 Overview
This release significantly expands the HIIT exercise library with 22 new exercises and enhances the workout player with improved media fallback support.

## ✨ New Features

### 📚 Exercise Library Expansion
Added **22 new exercises** to `seed_exercises.json`, covering:
- **Core exercises**: Brace Marches, Heel Touch, Bicycle Crunch, Dead Bug, Reverse Crunches, Russian Twist, etc.
- **Lower body**: Alternating Lunge, Squat Reach, Squat Kicks, Split Jump, Step Up, Skater Jump, etc.
- **Upper body**: Push-up variations
- **Stretches & Warm-ups**: 90-90 Hip Switches, Knees to Chest, etc.

Total exercise count increased from ~25 to **47 exercises**.

### 🎵 Audio & Animation Assets
- Added corresponding **MP3 audio files** for voice guidance (exercise names)
- Added **MP4/WebM video animations** for visual demonstration (180x180px)
- Implemented case-insensitive file loading (all slugs converted to lowercase)

### 🖼️ WebP Image Fallback Support
Enhanced the HIIT player to support **static image fallback**:

#### Player Page (`app/(hiit)/hiit/play/page.tsx`)
- Added `<img>` tag displaying `.webp` images when video is loading or unavailable
- Serves dual purpose:
  - **Loading placeholder**: Shows image while video buffers
  - **Fallback**: Shows image if video fails to load (404, unsupported format)
- Smooth transition with fade effect when video loads

#### Preview Page (`app/(hiit)/hiit/preview/page.tsx`)
- Added WebP image preloading using `new Image()`
- Ensures images are cached before workout starts
- Reduces pop-in and loading delays

## 🔧 Technical Details

### File Naming Convention
- **Slug generation**: Exercise names converted to lowercase, special characters removed, spaces replaced with `-`
- **Example**: "Jumping Jack" → `jumping-jack.mp4`, `jumping-jack.webm`, `jumping-jack.webp`
- **Case sensitivity**: All file paths are lowercase to ensure compatibility with case-sensitive file systems (Linux servers)

### Media Loading Priority
1. **MP4** (primary)
2. **WebM** (fallback for video)
3. **WebP** (fallback for static image)

### Asset Specifications
- **Video dimensions**: 180×180 pixels
- **Image dimensions**: 180×180 pixels (recommended)
- **Video formats**: MP4, WebM
- **Image format**: WebP (for optimal file size and quality)

## 📝 Modified Files
- `public/hiit/seed_exercises.json` - Added 22 new exercises
- `app/(hiit)/hiit/play/page.tsx` - WebP fallback implementation
- `app/(hiit)/hiit/preview/page.tsx` - WebP preloading
- `public/hiit/media/` - New audio and video assets

## 🐛 Bug Fixes
- Fixed exercise name "90/90 Hip Switches" → "90-90 Hip Switches" for proper slug generation

## 📦 Assets Summary
- **New exercises**: 22
- **New audio files**: ~22 MP3 files
- **New video files**: ~44 files (MP4 + WebM pairs)
- **New image files**: Variable (WebP fallbacks)

---

**Release Date**: February 11, 2026  
**Version**: HIIT Library v2.0
