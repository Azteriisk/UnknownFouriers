# UNKNOWN FREQUENCIES: Ridgeline Audio Visualizer & Fourier Synthesis Engine

> A real-time Web Audio Fourier Transform Ridgeline Visualizer & Spectral Decomposition Engine inspired by Peter Saville's iconic 1979 album cover for Joy Division's *Unknown Pleasures* (transposing signal pulse data recorded from **Pulsar CP 1919**).

---

## Table of Contents
1. [Overview & Artistic Intent](#overview--artistic-intent)
2. [Key Features](#key-features)
3. [Technical Architecture](#technical-architecture)
4. [TOS-Compliant YouTube Player & System Audio Integration](#tos-compliant-youtube-player--system-audio-integration)
5. [Client-Side Privacy & Security Guarantee](#client-side-privacy--security-guarantee)
6. [Comprehensive Deep-Dive: The Science of Fourier Analysis](#comprehensive-deep-dive-the-science-of-fourier-analysis)
   - [1. Historical Origins](#1-historical-origins)
   - [2. Mathematical Foundations](#2-mathematical-foundations)
   - [3. Current Real-World Applications](#3-current-real-world-applications)
   - [4. Future Frontiers of Fourier Science](#4-future-frontiers-of-fourier-science)
7. [Getting Started & Local Installation](#getting-started--local-installation)

---

## Overview & Artistic Intent

**UNKNOWN FREQUENCIES** bridges the gap between mid-20th-century radio astrophysics, iconic post-punk minimalism, and high-performance Web Audio engineering.

In July 1967, astrophysicist **Jocelyn Bell Burnell** discovered the first radio pulsar (**CP 1919** / PSR B1919+21) at the Mullard Radio Astronomy Observatory. The continuous periodic pulses emitted by the dying neutron star were recorded as stacked signal line histograms by the Cambridge University radio telescope. In 1979, graphic designer **Peter Saville** inverted these histograms onto a pitch-black canvas for Joy Division's debut album *Unknown Pleasures*.

This web application recreates that legendary aesthetic in **real-time 60 FPS Canvas 2D rendering**, allowing any live acoustic signal (whether from a microphone, local audio file, YouTube video, or browser tab) to be decomposed into stacked harmonic ridgeline sines.

---

## Key Features

- **Equal-Temperament Logarithmic Octave Pitch Mapping**:
  Re-buckets Web Audio API Fast Fourier Transform (FFT) frequency bins into logarithmic musical octaves ($40\,\text{Hz}$ to $16,000\,\text{Hz}$), ensuring notes ascend physically line-by-line across the canvas.
- **Granular Time Window & Frequency Range Slicing**:
  - Continuous time window slicing from ultra-zoomed micro-slices ($0.25\,\text{s}$) to panoramic macro-slices ($5.0\,\text{s}$) without buffer jump cuts.
  - Frequency spectrum bounds cropping (Min Pitch $20\,\text{Hz} - 1000\,\text{Hz}$, Max Pitch $500\,\text{Hz} - 16,000\,\text{Hz}$).
  - Adjustable sine partials ($8$ to $64$ bands) and vertical line spacing.
- **Multi-Stop Directional Gradient Builder**:
  Custom color stop positions, directionality selector (*Horizontal*, *Vertical*, *Diagonal*), and 1-click presets (*Cyber Sunset*, *Tokyo Neon*, *Pulsar White*, *Deep Emerald*).
- **Blender-Style Volumetric Atmospheric Fog Shader & Additive Bloom**:
  Audio-reactive procedural noise fog clouds combined with multi-pass `'lighter'` compositing for volumetric light bloom scattering.
- **Master Opacity & Night Relaxation Mode**:
  Visual dimming control ($5\%$ to $100\%$) for listening with the visualizer on while sleeping.
- **Zero-Overlay Graphic Clearance & Mobile Responsive**:
  Dynamic viewport calculation automatically shifts canvas ridgelines upwards when control drawers open, ensuring zero visual overlap across desktop and mobile screens.

---

## Technical Architecture

```
                 +-----------------------------------------+
                 |            AUDIO SOURCES                |
                 |  Live Mic | System/Tab | File | YouTube |
                 +--------------------+--------------------+
                                      |
                                      v
                 +-----------------------------------------+
                 |            AudioEngine.ts               |
                 |  Web Audio API AnalyserNode (FFT 2048)  |
                 |  Logarithmic Octave Bin Mapping         |
                 |  Fixed 300-Frame Pre-Allocated History  |
                 +--------------------+--------------------+
                                      |
                                      v
                 +-----------------------------------------+
                 |         VisualizerCanvas.tsx            |
                 |  Canvas 2D Stacked Ridgeline Render     |
                 |  Multi-Pass Additive Bloom ('lighter')  |
                 |  Procedural Noise Volumetric Fog        |
                 |  Dynamic Viewport Center Clearance      |
                 +-----------------------------------------+
```

- **Framework**: Next.js 16 (App Router, Turbopack) & React 19.
- **Languages**: TypeScript, HTML5 Canvas 2D, Vanilla CSS design tokens.
- **Audio Processing**: Native Web Audio API (`AudioContext`, `AnalyserNode`, `MediaStreamAudioSourceNode`, `GainNode`).

---

## TOS-Compliant YouTube Player & System Audio Integration

To play YouTube music videos and playlists without violating YouTube's Terms of Service or hitting rate-limiting IP blocks:

1. **Official YouTube IFrame Player API**:
   Embedded directly via `https://www.youtube.com/iframe_api` inside a sleek picture-in-picture floating card supporting single videos (`watch?v=...`, `youtu.be/...`) and multi-track playlists (`playlist?list=...`).
2. **Browser System / Tab Audio Capture**:
   Utilizes `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` to capture real-time audio streams from any active YouTube tab, Spotify application, or system playback node.

---

## Client-Side Privacy & Security Guarantee

All uploaded local audio files (`.mp3`, `.wav`, `.flac`, `.m4a`, `.ogg`) are processed **100% locally in browser memory** via `URL.createObjectURL(file)`.

- **Zero Server Uploads**: No audio data is ever transmitted across HTTP network requests or stored on any server disk.
- **Memory Safety**: Object URLs are revoked upon file unloading to prevent memory leaks.

---

## Comprehensive Deep-Dive: The Science of Fourier Analysis

### 1. Historical Origins

In 1822, French mathematician and physicist **Jean-Baptiste Joseph Fourier** published his ground-breaking treatise *Théorie Analytique de la Chaleur* (*Analytical Theory of Heat*).

Fourier put forward a revolutionary and initially controversial claim: **Any arbitrary function (no matter how complex or discontinuous) can be represented as an infinite sum of simple, harmonic sinusoidal components (sines and cosines)**.

Though initially met with skepticism by contemporary mathematicians such as Lagrange and Laplace due to convergence questions, Fourier's work laid the foundational bedrock of modern mathematical analysis, differential equations, and signal processing.

```
       Complex Acoustic Waveform (Time Domain)
                      |
                      v   [ Fourier Transform ]
                      |
    +-----------------+-----------------+
    |                 |                 |
 Sine 1 (40Hz)   Sine 2 (120Hz)   Sine 3 (360Hz) ...  (Frequency Domain)
```

---

### 2. Mathematical Foundations

#### The Continuous Fourier Transform (CFT)
For a continuous time-domain function $f(t)$, the continuous Fourier transform maps $f(t)$ into its frequency spectrum $\hat{f}(\xi)$:

$$\hat{f}(\xi) = \int_{-\infty}^{\infty} f(t) \, e^{-2\pi i t \xi} \, dt$$

Where:
- $t$ represents time.
- $\xi$ represents frequency.
- $i = \sqrt{-1}$ is the imaginary unit.
- $e^{-2\pi i t \xi} = \cos(2\pi t \xi) - i \sin(2\pi t \xi)$ via Euler's formula, decomposing the signal into orthogonal basis functions.

#### The Discrete Fourier Transform (DFT)
In digital computers, audio is sampled at discrete time intervals ($f_s = 44.1\,\text{kHz}$ or $48\,\text{kHz}$). The Discrete Fourier Transform maps $N$ sampled complex numbers $x_0, x_1, \dots, x_{N-1}$ into $N$ frequency domain bins $X_0, X_1, \dots, X_{N-1}$:

$$X_k = \sum_{n=0}^{N-1} x_n \cdot e^{-i 2\pi k n / N}, \quad k = 0, 1, \dots, N-1$$

Computing the raw DFT directly requires $O(N^2)$ complex arithmetic operations.

#### The Fast Fourier Transform (FFT)
In 1965, **James Cooley** and **John Tukey** introduced the **Fast Fourier Transform (FFT)** algorithm, reducing the computational complexity from $O(N^2)$ to $O(N \log_2 N)$ through a divide-and-conquer radix-2 factorization:

$$\text{Time Complexity Reduction: } O(N^2) \longrightarrow O(N \log_2 N)$$

For an $N = 2048$ FFT window (as used in this application):
- Raw DFT operations: $2048^2 \approx 4,194,304$ operations per frame.
- Cooley-Tukey FFT operations: $2048 \times 11 \approx 22,528$ operations per frame.

This **$186\times$ speedup** made real-time 60 FPS audio spectral analysis possible on consumer hardware.

---

### 3. Current Real-World Applications

Fourier analysis is arguably the single most impactful mathematical tool in modern technology:

1. **Digital Audio Compression & Perception (MP3, AAC, Opus)**:
   Perceptual audio codecs convert time-domain PCM audio into frequency sub-bands via Modified Discrete Cosine Transforms (MDCT), stripping out frequencies masked by human hearing thresholds.
2. **Image & Video Compression (JPEG, H.264, HEVC, AV1)**:
   JPEG image encoding divides images into $8\times8$ pixel blocks and applies 2D Discrete Cosine Transforms (DCT) to discard high-frequency spatial noise imperceptible to the human eye.
3. **Telecommunications & Wireless Communications (OFDM, 5G, Wi-Fi 6)**:
   Orthogonal Frequency-Division Multiplexing (OFDM) uses inverse FFTs ($IFFT$) to encode data across thousands of closely-spaced orthogonal sub-carrier frequencies simultaneously, powering 4G LTE, 5G cellular networks, and Wi-Fi 6 routers.
4. **Medical Diagnostics & Tomography (MRI, CT Scanners)**:
   Magnetic Resonance Imaging (MRI) machines sample raw spatial frequency signals directly in "K-space". Fast Fourier Transforms reconstruct these spatial frequencies into 3D high-resolution anatomical tissue scans.
5. **Astrophysics & Radio Astronomy (Pulsars, SETI, LIGO)**:
   Radio telescopes apply FFT spectrometers to extract periodic pulsar pulses (such as Pulsar CP 1919) from deep-space radio noise, and LIGO applies Fourier time-frequency analysis to detect gravitational waves from colliding black holes.

---

### 4. Future Frontiers of Fourier Science

Fourier analysis continues to drive cutting-edge breakthroughs at the boundaries of physics, computer science, and artificial intelligence:

1. **Quantum Fourier Transform (QFT)**:
   In quantum computing, the Quantum Fourier Transform performs an FFT on quantum state amplitudes using quantum logic gates. While classical FFT runs in $O(N \log N)$, QFT executes in $O((\log N)^2)$ time, providing the exponential speedup at the heart of **Shor's Algorithm** for factoring large prime numbers and breaking RSA encryption.
2. **Photonic & Optical Computing**:
   Physical lenses naturally perform an instantaneous two-dimensional Fourier transform on coherent laser light passing through them at the speed of light ($O(1)$ constant time complexity). Photonic processors leverage optical Fourier optics to perform ultra-low-power matrix multiplications for AI acceleration.
3. **Fourier Neural Operators (FNO)**:
   In deep learning, Fourier Neural Operators map infinite-dimensional function spaces using spectral domain convolutions. FNOs solve complex non-linear Partial Differential Equations (PDEs), such as Navier-Stokes fluid dynamics, weather forecasting, and climate modeling, up to **1000x faster** than traditional supercomputer numerical solvers.

---

## Getting Started & Local Installation

### Prerequisites
- Node.js 18.0 or higher
- npm, pnpm, or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/Azteriisk/UnknownFouriers.git

# Navigate into project directory
cd UnknownFouriers

# Install dependencies
npm install

# Run local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser to start visualizing audio frequencies in real-time.

---

## License

MIT License: feel free to explore, fork, and build upon this spectral engine!
