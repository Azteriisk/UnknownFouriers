// src/app/page.tsx - Ridgeline Audio Visualizer with 3D Tilt, QWERTY Virtual Synth, 4K Snapshots & URL Theme Sharing

'use client';

import React, { useState, useEffect } from 'react';
import {
  AudioEngine,
  AudioInputType,
  PresetTrack,
  VisualizerConfig,
  GradientDirection,
  GradientStop,
  KEY_TO_NOTE_MAP,
} from '@/lib/audio/AudioEngine';
import { VisualizerCanvas, download4KSnapshot } from '@/components/VisualizerCanvas';
import { ExplanationModal } from '@/components/ExplanationModal';
import { YouTubePlayer } from '@/components/YouTubePlayer';
import {
  Waves,
  HelpCircle,
  Mic,
  Monitor,
  Upload,
  Video,
  Music,
  Play,
  Pause,
  Square,
  Palette,
  SlidersHorizontal,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  Camera,
  Share2,
  Box,
  Keyboard,
  Check,
} from 'lucide-react';

const PRESET_GRADIENTS: { name: string; direction: GradientDirection; stops: GradientStop[] }[] = [
  {
    name: 'Cyber Sunset',
    direction: 'horizontal',
    stops: [
      { id: '1', color: '#ff512f', offset: 0.0 },
      { id: '2', color: '#f09819', offset: 0.5 },
      { id: '3', color: '#e74c3c', offset: 1.0 },
    ],
  },
  {
    name: 'Tokyo Neon',
    direction: 'vertical',
    stops: [
      { id: '1', color: '#ff0077', offset: 0.0 },
      { id: '2', color: '#a855f7', offset: 0.5 },
      { id: '3', color: '#00f2fe', offset: 1.0 },
    ],
  },
  {
    name: 'Pulsar White',
    direction: 'vertical',
    stops: [
      { id: '1', color: '#ffffff', offset: 0.0 },
      { id: '2', color: '#666666', offset: 1.0 },
    ],
  },
  {
    name: 'Deep Emerald',
    direction: 'diagonal',
    stops: [
      { id: '1', color: '#10b981', offset: 0.0 },
      { id: '2', color: '#047857', offset: 0.5 },
      { id: '3', color: '#064e3b', offset: 1.0 },
    ],
  },
];

export default function Home() {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [activeInput, setActiveInput] = useState<AudioInputType>('preset');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isColorDrawerOpen, setIsColorDrawerOpen] = useState<boolean>(false);
  const [isSliceDrawerOpen, setIsSliceDrawerOpen] = useState<boolean>(false);
  const [isInputSelectorOpen, setIsInputSelectorOpen] = useState<boolean>(false);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<PresetTrack>('vocal_arpeggio');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [config, setConfig] = useState<VisualizerConfig>({
    windowSeconds: 2,
    minFreq: 40,
    maxFreq: 9000,
    bandCount: 32,
    lineSpacing: 12,
    gain: 1.0,
    showSummedWave: true,
    glowBlur: 20,
    fogDensity: 0.5,
    opacity: 0.45,
    gradientDirection: 'vertical',
    gradientStops: [
      { id: '1', color: '#ffffff', offset: 0.0 },
      { id: '2', color: '#666666', offset: 1.0 },
    ],
    sumLineColor: '#ffffff',
    bgColor: '#020204',
    is3DTilt: true,
    tiltAngle: 20,
  });

  useEffect(() => {
    const audioEng = new AudioEngine({
      onStateChange: (playing) => setIsPlaying(playing),
      onError: (msg) => setErrorMessage(msg),
    });

    setEngine(audioEng);

    return () => {
      audioEng.stopAllSources();
    };
  }, []);

  // Synchronize URL Hash for 0ms shared theme loading
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const parseHashTheme = () => {
      try {
        const hash = window.location.hash.substring(1);
        if (!hash) return;

        const params = new URLSearchParams(hash);
        const dir = params.get('dir') as GradientDirection | null;
        const stopsRaw = params.get('stops');

        if (stopsRaw) {
          const stops = JSON.parse(decodeURIComponent(stopsRaw)) as GradientStop[];
          if (Array.isArray(stops) && stops.length > 0) {
            setConfig((prev) => ({
              ...prev,
              gradientDirection: dir || prev.gradientDirection,
              gradientStops: stops,
            }));
          }
        }
      } catch { /* ignore invalid hash */ }
    };

    parseHashTheme();
    window.addEventListener('hashchange', parseHashTheme);
    return () => window.removeEventListener('hashchange', parseHashTheme);
  }, []);

  // Listen for QWERTY computer keyboard notes when in Keyboard Synth Mode
  useEffect(() => {
    if (activeInput !== 'keyboard' || !engine) return;

    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_TO_NOTE_MAP[key] && !pressedKeys.has(key)) {
        pressedKeys.add(key);
        const { freq } = KEY_TO_NOTE_MAP[key];
        engine.noteOn(freq, key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (pressedKeys.has(key)) {
        pressedKeys.delete(key);
        engine.noteOff(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeInput, engine]);

  const handleMicClick = async () => {
    if (!engine) return;
    try {
      if (activeInput === 'mic' && isPlaying) {
        engine.stopAllSources();
      } else {
        await engine.startMic();
        setActiveInput('mic');
        setIsInputSelectorOpen(false);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to access microphone.');
    }
  };

  const handleSystemAudioClick = async () => {
    if (!engine) return;
    try {
      if (activeInput === 'system' && isPlaying) {
        engine.stopAllSources();
      } else {
        if (typeof engine.startSystemAudio === 'function') {
          await engine.startSystemAudio();
          setActiveInput('system');
          setIsInputSelectorOpen(false);
        } else {
          throw new Error('Please refresh the page (F5) to initialize the system audio capture feature.');
        }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'System audio capture canceled.');
    }
  };

  const handleKeyboardSynthClick = async () => {
    if (!engine) return;
    try {
      await engine.startKeyboardSynth();
      setActiveInput('keyboard');
      setIsInputSelectorOpen(false);
      setToastMessage('Keyboard Synth Active! Play QWERTY keys (A S D F G H J K / W E T Y U) or MIDI keyboard!');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Keyboard synth error.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engine) return;
    try {
      setUploadedFileName(file.name);
      await engine.loadAudioFile(file);
      setActiveInput('file');
      setIsInputSelectorOpen(false);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error loading file.');
    }
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    const urlToLoad = youtubeUrl.trim();
    setActiveYoutubeUrl(urlToLoad);
    setActiveInput('youtube');
    setIsInputSelectorOpen(false);
    setErrorMessage(null);

    if (engine && activeInput !== 'system') {
      engine.startSystemAudio().then(() => {
        setActiveInput('system');
      }).catch(() => {
        /* Canceled by user */
      });
    }
  };

  const handlePresetSelect = async (preset: PresetTrack) => {
    if (!engine) return;
    try {
      setActivePreset(preset);
      await engine.playPreset(preset);
      setActiveInput('preset');
      setIsInputSelectorOpen(false);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Preset playback error.');
    }
  };

  const handleTogglePlay = () => {
    if (!engine) return;
    if (isPlaying) {
      engine.pause();
    } else {
      if (activeInput === 'preset') {
        engine.playPreset(activePreset);
      } else {
        engine.resume();
      }
    }
  };

  const handleStop = () => {
    if (engine) engine.stopAllSources();
  };

  const handleSnapshotClick = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      download4KSnapshot(canvas);
      setToastMessage('Snapshot downloaded to your device!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleShareThemeClick = () => {
    try {
      const themeData = encodeURIComponent(JSON.stringify(config.gradientStops));
      const shareUrl = `${window.location.origin}${window.location.pathname}#dir=${config.gradientDirection}&stops=${themeData}`;
      navigator.clipboard.writeText(shareUrl);
      setToastMessage('Theme link copied to clipboard!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setErrorMessage('Failed to copy share link.');
    }
  };

  // Gradient Stops Management
  const handleUpdateStopColor = (id: string, color: string) => {
    setConfig((prev) => ({
      ...prev,
      gradientStops: prev.gradientStops.map((s) => (s.id === id ? { ...s, color } : s)),
    }));
  };

  const handleUpdateStopOffset = (id: string, offset: number) => {
    setConfig((prev) => ({
      ...prev,
      gradientStops: prev.gradientStops.map((s) => (s.id === id ? { ...s, offset } : s)),
    }));
  };

  const handleAddGradientStop = () => {
    setConfig((prev) => {
      const newId = Date.now().toString();
      const lastStop = prev.gradientStops[prev.gradientStops.length - 1];
      const newOffset = lastStop ? Math.min(1.0, lastStop.offset + 0.25) : 0.5;
      return {
        ...prev,
        gradientStops: [...prev.gradientStops, { id: newId, color: '#00f2fe', offset: newOffset }],
      };
    });
  };

  const handleRemoveGradientStop = (id: string) => {
    setConfig((prev) => {
      if (prev.gradientStops.length <= 1) return prev;
      return {
        ...prev,
        gradientStops: prev.gradientStops.filter((s) => s.id !== id),
      };
    });
  };

  const handleApplyPresetGradient = (preset: typeof PRESET_GRADIENTS[0]) => {
    setConfig((prev) => ({
      ...prev,
      gradientDirection: preset.direction,
      gradientStops: preset.stops.map((s) => ({ ...s })),
    }));
  };

  // Dynamically calculate bottom reserved height to guarantee ZERO graphic overlay!
  let bottomReservedHeight = 85;
  if (isColorDrawerOpen || isSliceDrawerOpen) {
    bottomReservedHeight = 240;
  } else if (activeInput === 'youtube' || activeInput === 'preset' || isInputSelectorOpen) {
    bottomReservedHeight = 135;
  }

  return (
    <main className="app-viewport">
      {/* Fullscreen Dynamic Ridgeline Canvas with Dynamic Non-Overlay Clearance */}
      <VisualizerCanvas engine={engine} config={config} bottomReservedHeight={bottomReservedHeight} />

      {/* Floating Header */}
      <header className="floating-header">
        <div className="brand-group">
          <Waves className="brand-icon" />
          <span className="brand-title">UNKNOWN FREQUENCIES</span>
        </div>

        <button className="science-btn" onClick={() => setIsInfoOpen(true)}>
          <HelpCircle className="inline-icon" /> Fourier Science
        </button>
      </header>

      {/* Floating TOS-Compliant YouTube Player & Playlist Card */}
      {activeYoutubeUrl && (
        <YouTubePlayer
          url={activeYoutubeUrl}
          onClose={() => setActiveYoutubeUrl(null)}
          onRequireAudioCapture={handleSystemAudioClick}
        />
      )}

      {/* Notification Toast */}
      {toastMessage && (
        <div className="floating-toast success-toast">
          <Check className="inline-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="floating-error-toast">
          <AlertCircle className="inline-icon" />
          <span>{errorMessage}</span>
          <button className="dismiss-toast-btn" onClick={() => setErrorMessage(null)}>
            ×
          </button>
        </div>
      )}

      {/* Minimal Space Control Dock */}
      <div className="floating-dock">
        {/* Custom Multi-Stop Gradient & Atmosphere Drawer */}
        {isColorDrawerOpen && (
          <div className="sub-dock-row color-picker-row multiline-drawer">
            {/* Direction Selector & Presets */}
            <div className="drawer-section">
              <label className="color-picker-label">
                <span>Direction:</span>
                <select
                  value={config.gradientDirection}
                  onChange={(e) => setConfig((prev) => ({ ...prev, gradientDirection: e.target.value as GradientDirection }))}
                  className="sub-dock-select"
                >
                  <option value="horizontal">Horizontal (Time)</option>
                  <option value="vertical">Vertical (Pitch)</option>
                  <option value="diagonal">Diagonal (45°)</option>
                </select>
              </label>

              <div className="gradient-presets-group">
                {PRESET_GRADIENTS.map((p) => (
                  <button key={p.name} className="mini-chip-btn" onClick={() => handleApplyPresetGradient(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Gradient Stops Bar */}
            <div className="drawer-section stops-section">
              <span className="section-title-mono">STOPS:</span>
              {config.gradientStops.map((stop, idx) => (
                <div key={stop.id} className="stop-item">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => handleUpdateStopColor(stop.id, e.target.value)}
                    className="color-input"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.05"
                    value={stop.offset}
                    onChange={(e) => handleUpdateStopOffset(stop.id, parseFloat(e.target.value))}
                    className="mini-slider"
                    title={`Stop ${idx + 1} position: ${Math.round(stop.offset * 100)}%`}
                  />
                  {config.gradientStops.length > 1 && (
                    <button className="remove-stop-btn" onClick={() => handleRemoveGradientStop(stop.id)}>
                      <Trash2 className="tiny-icon" />
                    </button>
                  )}
                </div>
              ))}
              <button className="mini-chip-btn add-stop-btn" onClick={handleAddGradientStop}>
                <Plus className="tiny-icon" /> Add Stop
              </button>
            </div>

            {/* Other Color Controls */}
            <div className="drawer-section">
              <label className="color-picker-label">
                <span>Sum Wave:</span>
                <input
                  type="color"
                  value={config.sumLineColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sumLineColor: e.target.value }))}
                  className="color-input"
                />
              </label>

              <label className="color-picker-label">
                <span>Background:</span>
                <input
                  type="color"
                  value={config.bgColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bgColor: e.target.value }))}
                  className="color-input"
                />
              </label>

              <button
                className={`mini-chip-btn ${config.is3DTilt ? 'active' : ''}`}
                onClick={() => setConfig((prev) => ({ ...prev, is3DTilt: !prev.is3DTilt }))}
              >
                <Box className="tiny-icon" /> 3D Tilt ({config.is3DTilt ? 'ON' : 'OFF'})
              </button>

              {config.is3DTilt && (
                <label className="color-picker-label slider-label">
                  <span>Tilt Pitch: ({config.tiltAngle ?? 35}°)</span>
                  <input
                    type="range"
                    min="15"
                    max="75"
                    step="1"
                    value={config.tiltAngle ?? 35}
                    onChange={(e) => setConfig((prev) => ({ ...prev, tiltAngle: parseInt(e.target.value) }))}
                    className="sub-dock-slider"
                  />
                </label>
              )}
            </div>

            {/* Sliders */}
            <div className="drawer-section sliders-section">
              <label className="color-picker-label slider-label">
                <span>Bloom: ({config.glowBlur}px)</span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={config.glowBlur}
                  onChange={(e) => setConfig((prev) => ({ ...prev, glowBlur: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Fog Vol: ({Math.round(config.fogDensity * 100)}%)</span>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={config.fogDensity}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fogDensity: parseFloat(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Opacity: ({Math.round((config.opacity ?? 1.0) * 100)}%)</span>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={config.opacity ?? 1.0}
                  onChange={(e) => setConfig((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <button className="mini-chip-btn" onClick={handleShareThemeClick}>
                <Share2 className="tiny-icon" /> Share Theme
              </button>
            </div>
          </div>
        )}

        {/* Time & Pitch Frequency Slice Controls Drawer */}
        {isSliceDrawerOpen && (
          <div className="sub-dock-row multiline-drawer">
            <div className="drawer-section">
              <span className="section-title-mono">SLICE PRESETS:</span>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 2.0, minFreq: 40, maxFreq: 9000, bandCount: 32, lineSpacing: 12 }))}
              >
                Default (Full Range)
              </button>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 1.5, minFreq: 20, maxFreq: 250, bandCount: 24, lineSpacing: 16 }))}
              >
                Sub-Bass & Kicks (20-250Hz)
              </button>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 2.0, minFreq: 250, maxFreq: 3500, bandCount: 36, lineSpacing: 12 }))}
              >
                Vocal & Lead Mids (250-3500Hz)
              </button>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 1.0, minFreq: 3500, maxFreq: 16000, bandCount: 32, lineSpacing: 10 }))}
              >
                Air Treble (3.5-16kHz)
              </button>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 0.35, minFreq: 40, maxFreq: 12000, bandCount: 48, lineSpacing: 8 }))}
              >
                Micro Transients (0.35s)
              </button>
              <button
                className="mini-chip-btn"
                onClick={() => setConfig((prev) => ({ ...prev, windowSeconds: 4.5, minFreq: 40, maxFreq: 9000, bandCount: 32, lineSpacing: 14 }))}
              >
                Panoramic Wave (4.5s)
              </button>

              <button
                className={`mini-chip-btn ${config.reverseTimeFlow ? 'active' : ''}`}
                onClick={() => setConfig((prev) => ({ ...prev, reverseTimeFlow: !prev.reverseTimeFlow }))}
                title="Reverse Horizontal Wave Flow Direction (Left-to-Right vs Right-to-Left)"
              >
                Flow: {config.reverseTimeFlow ? 'Right ← Left' : 'Left → Right'}
              </button>

              <button
                className={`mini-chip-btn ${config.reversePitchOrder ? 'active' : ''}`}
                onClick={() => setConfig((prev) => ({ ...prev, reversePitchOrder: !prev.reversePitchOrder }))}
                title="Reverse Vertical Octave Pitch Order (Low-to-High vs High-to-Low)"
              >
                Stack: {config.reversePitchOrder ? 'High → Low' : 'Low → High'}
              </button>
            </div>

            <div className="drawer-section sliders-section">
              <label className="color-picker-label slider-label">
                <span>Window: ({config.windowSeconds.toFixed(2)}s)</span>
                <input
                  type="range"
                  min="0.25"
                  max="5.0"
                  step="0.05"
                  value={config.windowSeconds}
                  onChange={(e) => setConfig((prev) => ({ ...prev, windowSeconds: parseFloat(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Min Pitch: ({config.minFreq ?? 40} Hz)</span>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={config.minFreq ?? 40}
                  onChange={(e) => setConfig((prev) => ({ ...prev, minFreq: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Max Pitch: ({config.maxFreq ?? 9000} Hz)</span>
                <input
                  type="range"
                  min="500"
                  max="16000"
                  step="100"
                  value={config.maxFreq ?? 9000}
                  onChange={(e) => setConfig((prev) => ({ ...prev, maxFreq: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Partials: ({config.bandCount} sines)</span>
                <input
                  type="range"
                  min="8"
                  max="64"
                  step="2"
                  value={config.bandCount}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bandCount: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Spacing: ({config.lineSpacing}px)</span>
                <input
                  type="range"
                  min="4"
                  max="30"
                  step="1"
                  value={config.lineSpacing}
                  onChange={(e) => setConfig((prev) => ({ ...prev, lineSpacing: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>
            </div>
          </div>
        )}

        {/* Audio Input Selector Sub-dock Drawer */}
        {isInputSelectorOpen && !isColorDrawerOpen && !isSliceDrawerOpen && (
          <div className="sub-dock-row input-selector-drawer">
            {activeInput !== 'mic' && (
              <button className="mini-chip-btn" onClick={handleMicClick}>
                <Mic className="tiny-icon" /> Live Mic
              </button>
            )}
            {activeInput !== 'system' && (
              <button className="mini-chip-btn" onClick={handleSystemAudioClick}>
                <Monitor className="tiny-icon" /> Tab / System
              </button>
            )}
            {activeInput !== 'keyboard' && (
              <button className="mini-chip-btn" onClick={handleKeyboardSynthClick}>
                <Keyboard className="tiny-icon" /> QWERTY / MIDI Piano
              </button>
            )}
            {activeInput !== 'file' && (
              <label className="mini-chip-btn" title="Upload local audio file (100% Client-Side Local Processing Only)">
                <Upload className="tiny-icon" />
                <span>{uploadedFileName ? (uploadedFileName.length > 18 ? uploadedFileName.slice(0, 16) + '…' : uploadedFileName) : 'Local File'}</span>
                <input type="file" accept="audio/*" className="hidden-file-input" onChange={handleFileUpload} />
              </label>
            )}
            {activeInput !== 'youtube' && (
              <button className="mini-chip-btn" onClick={() => { setActiveInput('youtube'); setIsInputSelectorOpen(false); }}>
                <Video className="tiny-icon text-red-400" /> YouTube
              </button>
            )}
            {activeInput !== 'preset' && (
              <button className="mini-chip-btn" onClick={() => { setActiveInput('preset'); setIsInputSelectorOpen(false); }}>
                <Music className="tiny-icon" /> Synth Presets
              </button>
            )}
          </div>
        )}

        {/* Sub-dock row for YouTube Link Input */}
        {activeInput === 'youtube' && !isColorDrawerOpen && !isSliceDrawerOpen && (
          <div className="sub-dock-row">
            <form onSubmit={handleYoutubeSubmit} className="sub-dock-form">
              <input
                type="url"
                placeholder="Paste Video or Playlist Link..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="sub-dock-input wide-input"
                required
              />
              <button type="submit" className="mini-chip-btn active">
                Load Player
              </button>
            </form>
          </div>
        )}

        {/* Sub-dock row for Demo Audio Presets */}
        {activeInput === 'preset' && !isColorDrawerOpen && !isSliceDrawerOpen && (
          <div className="sub-dock-row">
            {activePreset !== 'synth_chords' && (
              <button className="mini-chip-btn" onClick={() => handlePresetSelect('synth_chords')}>
                Synth
              </button>
            )}
            {activePreset !== 'drum_beat' && (
              <button className="mini-chip-btn" onClick={() => handlePresetSelect('drum_beat')}>
                Drums
              </button>
            )}
            {activePreset !== 'vocal_arpeggio' && (
              <button className="mini-chip-btn" onClick={() => handlePresetSelect('vocal_arpeggio')}>
                Arpeggio
              </button>
            )}
            {activePreset !== 'frequency_sweep' && (
              <button className="mini-chip-btn" onClick={() => handlePresetSelect('frequency_sweep')}>
                Sweep
              </button>
            )}
          </div>
        )}

        {/* Main Floating Pill Dock */}
        <div className="dock-pill">
          {/* Audio Input Selector Toggle Button */}
          <button
            className={`pill-item-btn ${isInputSelectorOpen ? 'active' : ''}`}
            onClick={() => {
              setIsInputSelectorOpen((prev) => !prev);
              if (isColorDrawerOpen) setIsColorDrawerOpen(false);
              if (isSliceDrawerOpen) setIsSliceDrawerOpen(false);
            }}
          >
            {activeInput === 'mic' && <Mic className="inline-icon" />}
            {activeInput === 'system' && <Monitor className="inline-icon" />}
            {activeInput === 'keyboard' && <Keyboard className="inline-icon" />}
            {activeInput === 'file' && <Upload className="inline-icon" />}
            {activeInput === 'youtube' && <Video className="inline-icon text-red-400" />}
            {activeInput === 'preset' && <Music className="inline-icon" />}
            <span className="capitalize-text">
              {activeInput === 'file' && uploadedFileName
                ? (uploadedFileName.length > 12 ? uploadedFileName.slice(0, 10) + '…' : uploadedFileName)
                : activeInput === 'keyboard' ? 'QWERTY Piano' : activeInput}
            </span>
            <ChevronUp className={`tiny-icon transition-transform ${isInputSelectorOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className="pill-divider" />

          {/* Playback Transport Controls */}
          <button className="pill-icon-btn" onClick={handleTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause className="inline-icon" /> : <Play className="inline-icon" />}
          </button>

          <button className="pill-icon-btn" onClick={handleStop} title="Stop">
            <Square className="inline-icon" />
          </button>

          {/* 4K High-Res Snapshot Export Button */}
          <button className="pill-icon-btn" onClick={handleSnapshotClick} title="Download 4K Canvas Snapshot PNG">
            <Camera className="inline-icon" />
          </button>

          <div className="pill-divider" />

          {/* Slice Controls Drawer Toggle */}
          <button
            className={`pill-item-btn ${isSliceDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              setIsSliceDrawerOpen((prev) => !prev);
              if (isColorDrawerOpen) setIsColorDrawerOpen(false);
              if (isInputSelectorOpen) setIsInputSelectorOpen(false);
            }}
            title="Time Window & Frequency Range Slice Controls"
          >
            <SlidersHorizontal className="inline-icon" />
            <span>Slice</span>
          </button>

          {/* Gradients & Atmosphere Drawer Toggle */}
          <button
            className={`pill-item-btn ${isColorDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              setIsColorDrawerOpen((prev) => !prev);
              if (isSliceDrawerOpen) setIsSliceDrawerOpen(false);
              if (isInputSelectorOpen) setIsInputSelectorOpen(false);
            }}
            title="Custom Multi-Stop Gradients & Atmosphere"
          >
            <Palette className="inline-icon" />
            <span>Style</span>
          </button>
        </div>
      </div>

      {/* Educational Modal */}
      <ExplanationModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </main>
  );
}
