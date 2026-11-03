# OmniTrans

OmniTrans is an installable, offline-first Progressive Web App (PWA) designed for multimodal translation across text, images, and voice. Built to run directly on-device in modern web browsers, OmniTrans executes client-side inference via WebGPU using Google's **LiteRT-LM** runtime and the **Gemma 4 E2B** model with zero server dependencies after initial installation.

---

## Key Features

- **100% Client-Side Offline Inference:** Runs Gemma 4 E2B locally in the browser utilizing WebGPU acceleration.
- **Multimodal Translation Input:**
  - **Text:** Free-form multilingual text translation.
  - **Vision:** Camera snapshot and image file upload translation.
  - **Audio:** Microphone recording with local audio feature extraction.
- **Configurable Thinking Mode:** Reasoning mode is configurable in Settings and disabled by default for low-latency translation.
- **Zero-Footprint Offline Speech Synthesis:** Uses platform-native OS speech synthesis (`window.speechSynthesis`) for audio playback without extra voice model downloads.
- **Persistent Translation History:** Stores translations, input media snapshots, audio metadata, and timestamps locally in IndexedDB with search and playback controls.
- **Resilient Cache Management:** Employs the LiteRT-LM Cache API streaming pipeline with persistent storage requests (`navigator.storage.persist()`), quota tracking, and manual cache eviction.
- **Internationalization (i18n) & Theming:** Supports English and Traditional Chinese (`zh-TW`) locales alongside Light and Dark color themes.
- **PWA Ready:** Installable as a standalone app on desktop and mobile platforms with offline Service Worker support.

---

## Architecture Overview

```text
+-------------------------------------------------------------------------+
|                               UI Layer                                  |
|   - Tabs: Translate | History | Settings                                |
|   - Media Capture: Camera (OffscreenCanvas) | Mic (AudioContext)        |
|   - Native Speech Synthesis: window.speechSynthesis                     |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         Inference Engine (WebGPU)                       |
|   - Runtime: @litert-lm/core (LiteRT-LM)                                |
|   - Model: Gemma 4 E2B (gemma-4-E2B-it-gpu.litertlm)                    |
|   - Modalities: GPU Text & Vision, CPU Audio                            |
+-------------------+---------------------------------+-------------------+
                    |                                 |
                    v                                 v
+-----------------------------------+ +-----------------------------------+
|         Cache Storage API         | |             IndexedDB             |
|   - Model Weights (litertlm-models)| |   - Translation History           |
|   - Byte-level stream caching     | |   - Media Blobs & Metadata        |
+-----------------------------------+ +-----------------------------------+
```

---

## Tab Structure

1. **Translate Tab:**
   - Source and target language selectors with quick-swap.
   - Recency-aware language pills with one-click selection and removal (`×`).
   - Unified input field with camera and microphone triggers.
   - Streaming translated output card with Copy and TTS Speaker buttons.
2. **History Tab:**
   - Searchable timeline of past translations.
   - Filter by keyword or language pair.
   - Playback translated audio and preview image/audio inputs.
   - Per-item deletion and bulk history purge.
3. **Settings Tab:**
   - Model installation status, file size, download progress, and cache eviction.
   - Thinking mode toggle (default: OFF).
   - Sampling parameters (Temperature, Top-P, Max output tokens).
   - Theme toggle (Light / Dark) and UI locale switcher (`en` / `zh-TW`).
   - Storage persistence status and System TTS readiness check.

---

## Getting Started

### Prerequisites

- A browser with **WebGPU** support enabled (e.g., Chrome 121+, Edge 121+, or compatible Chromium-based browser).
- GPU hardware meeting WebGPU requirements (Apple Silicon, Snapdragon 8 Gen 2/3, modern discrete or integrated GPU).

### Local Development

Serve the repository root over a local HTTP server:

```bash
# Using Python
python3 -m http.server 8000

# Or using Node.js
npx serve .
```

Open `http://localhost:8000` in your WebGPU-enabled browser.

---

## Deployment to GitHub Pages

OmniTrans is structured to deploy statically to GitHub Pages:

1. Push this repository to GitHub.
2. Navigate to **Settings** $\rightarrow$ **Pages**.
3. Under **Build and deployment**, select **Source: Deploy from a branch**.
4. Set branch to `main` and directory to `/ (root)` or `dist/`.
5. Save and access the deployed PWA URL.

---

## License

Apache-2.0
