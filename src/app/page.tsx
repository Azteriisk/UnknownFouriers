// src/app/page.tsx - Web Version (Vercel)
// Ridgeline Audio Visualizer with 3D Tilt & Taper, 3-Band EQ Boosts, Sum Wave Customizer,
// QWERTY Synth, YouTube Video & Playlist Player, Presets, and 4K Snapshots.

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
  Video,
  Activity,
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
      { id: '2', color: '#999999', offset: 0.5 },
      { id: '3', color: '#333333', offset: 1.0 },
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
  const [isEqDrawerOpen, setIsEqDrawerOpen] = useState<boolean>(false);
  const [isInputSelectorOpen, setIsInputSelectorOpen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<PresetTrack>('vocal_arpeggio');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [activeYoutubeUrl, setActiveYoutubeUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');

  const [config, setConfig] = useState<VisualizerConfig>({
    windowSeconds: 0.4,
    minFreq: 25,
    maxFreq: 10000,
    bandCount: 25,
    lineSpacing: 19,
    gain: 1.0,
    showSummedWave: true,
    glowBlur: 60,
    fogDensity: 0.7,
    gradientDirection: 'vertical',
    gradientStops: [
      { id: '1', color: '#ffffff', offset: 0.0 },
      { id: '2', color: '#999999', offset: 0.5 },
      { id: '3', color: '#333333', offset: 1.0 },
    ],
    sumLineColor: '#ffffff',
    bgColor: '#020204',
    is3DTilt: true,
    tiltAngle: 15,
    timeFlowMode: 'right_to_left',
    reversePitchOrder: false,
    eqLow: 15,
    eqMid: -10,
    eqHigh: 10,
    opacity: 0.8,
    sumGain: 1.0,
    sumThickness: 1.0,
    sumYOffset: -60,
    sumMode: 'standard',
    starCount: 80,
    waveSmoothing: 8,
    audioSensitivity: 10,
    widthTaper: 50,
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

  // Synchronize AudioEngine parameters whenever engine or config changes
  useEffect(() => {
    if (!engine) return;
    engine.setAudioSensitivity(config.audioSensitivity ?? 40);
    engine.setWaveSmoothing(config.waveSmoothing ?? 5);
    engine.setEqLow(config.eqLow ?? 0);
    engine.setEqMid(config.eqMid ?? 0);
    engine.setEqHigh(config.eqHigh ?? 0);
  }, [engine, config.audioSensitivity, config.waveSmoothing, config.eqLow, config.eqMid, config.eqHigh]);

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

  // Dynamically calculate bottom reserved height for clean canvas clearance
  let bottomReservedHeight = 85;
  if (isColorDrawerOpen || isSliceDrawerOpen || isEqDrawerOpen) {
    bottomReservedHeight = 240;
  } else if (isInputSelectorOpen || activeInput === 'youtube' || activeInput === 'preset') {
    bottomReservedHeight = 145;
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
        {/* Custom Multi-Stop Gradient, 3D & Atmosphere Drawer */}
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

            {/* 3D Geometry & Taper Controls */}
            <div className="drawer-section">
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

              <label className="color-picker-label slider-label">
                <span>Taper: ({config.widthTaper ?? 0})</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={config.widthTaper ?? 0}
                  onChange={(e) => setConfig((prev) => ({ ...prev, widthTaper: parseInt(e.target.value) }))}
                  className="sub-dock-slider"
                  title="Plane Tapering: negative widens back, positive narrows back"
                />
              </label>
            </div>

            {/* Sum Wave Settings */}
            <div className="drawer-section">
              <label className="color-picker-label">
                <span>Sum Mode:</span>
                <select
                  value={config.sumMode ?? 'standard'}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sumMode: e.target.value as any }))}
                  className="sub-dock-select"
                >
                  <option value="standard">Standard Line</option>
                  <option value="mirrored">Mirrored Wave</option>
                  <option value="none">No Sum Line</option>
                </select>
              </label>

              {config.sumMode !== 'none' && (
                <>
                  <label className="color-picker-label">
                    <span>Sum Color:</span>
                    <input
                      type="color"
                      value={config.sumLineColor}
                      onChange={(e) => setConfig((prev) => ({ ...prev, sumLineColor: e.target.value }))}
                      className="color-input"
                    />
                  </label>

                  <label className="color-picker-label slider-label">
                    <span>Sum Gain: ({(config.sumGain ?? 1.0).toFixed(1)}x)</span>
                    <input
                      type="range"
                      min="0.0"
                      max="5.0"
                      step="0.1"
                      value={config.sumGain ?? 1.0}
                      onChange={(e) => setConfig((prev) => ({ ...prev, sumGain: parseFloat(e.target.value) }))}
                      className="sub-dock-slider"
                    />
                  </label>

                  <label className="color-picker-label slider-label">
                    <span>Thickness: ({(config.sumThickness ?? 1.0).toFixed(1)}px)</span>
                    <input
                      type="range"
                      min="1.0"
                      max="8.0"
                      step="0.5"
                      value={config.sumThickness ?? 1.0}
                      onChange={(e) => setConfig((prev) => ({ ...prev, sumThickness: parseFloat(e.target.value) }))}
                      className="sub-dock-slider"
                    />
                  </label>

                  <label className="color-picker-label slider-label">
                    <span>Offset: ({config.sumYOffset ?? -60}px)</span>
                    <input
                      type="range"
                      min="-150"
                      max="150"
                      step="5"
                      value={config.sumYOffset ?? -60}
                      onChange={(e) => setConfig((prev) => ({ ...prev, sumYOffset: parseInt(e.target.value) }))}
                      className="sub-dock-slider"
                    />
                  </label>
                </>
              )}
            </div>

            {/* Atmosphere & Look Sliders */}
            <div className="drawer-section sliders-section">
              <label className="color-picker-label">
                <span>Background:</span>
                <input
                  type="color"
                  value={config.bgColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, bgColor: e.target.value }))}
                  className="color-input"
                />
              </label>

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
                <span>Dust Density: ({config.starCount ?? 80})</span>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={config.starCount ?? 80}
                  onChange={(e) => setConfig((prev) => ({ ...prev, starCount: parseInt(e.target.value) }))}
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

        {/* EQ & Dynamics Drawer */}
        {isEqDrawerOpen && (
          <div className="sub-dock-row multiline-drawer">
            <div className="drawer-section sliders-section">
              <label className="color-picker-label slider-label">
                <span>Bass (Low): ({config.eqLow !== undefined && config.eqLow > 0 ? `+${config.eqLow}` : config.eqLow ?? 0}%)</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={config.eqLow ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setConfig((prev) => ({ ...prev, eqLow: val }));
                    if (engine) engine.setEqLow(val);
                  }}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Mids (Center): ({config.eqMid !== undefined && config.eqMid > 0 ? `+${config.eqMid}` : config.eqMid ?? 0}%)</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={config.eqMid ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setConfig((prev) => ({ ...prev, eqMid: val }));
                    if (engine) engine.setEqMid(val);
                  }}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Treble (High): ({config.eqHigh !== undefined && config.eqHigh > 0 ? `+${config.eqHigh}` : config.eqHigh ?? 0}%)</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={config.eqHigh ?? 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setConfig((prev) => ({ ...prev, eqHigh: val }));
                    if (engine) engine.setEqHigh(val);
                  }}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Wave Height Gain: ({(config.gain ?? 1.0).toFixed(1)}x)</span>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={config.gain ?? 1.0}
                  onChange={(e) => setConfig((prev) => ({ ...prev, gain: parseFloat(e.target.value) }))}
                  className="sub-dock-slider"
                />
              </label>
            </div>
          </div>
        )}

        {/* Time & Pitch Frequency Slice Controls Drawer */}
        {isSliceDrawerOpen && (
          <div className="sub-dock-row multiline-drawer">
            <div className="drawer-section">
              <button
                className="mini-chip-btn active"
                onClick={() => {
                  const modes: Array<'left_to_right' | 'right_to_left' | 'center_out' | 'edges_in'> = ['left_to_right', 'right_to_left', 'center_out', 'edges_in'];
                  const currentMode = config.timeFlowMode || 'left_to_right';
                  const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length;
                  setConfig((prev) => ({ ...prev, timeFlowMode: modes[nextIndex] }));
                }}
                title="Change Horizontal Wave Flow Direction"
              >
                Flow: {config.timeFlowMode === 'right_to_left' ? 'Right ← Left' : config.timeFlowMode === 'center_out' ? 'Center ↔ Out' : config.timeFlowMode === 'edges_in' ? 'Edges → In' : 'Left → Right'}
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

              <label className="color-picker-label slider-label">
                <span>Smoothing: ({config.waveSmoothing ?? 8})</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={config.waveSmoothing ?? 8}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setConfig((prev) => ({ ...prev, waveSmoothing: val }));
                    if (engine) engine.setWaveSmoothing(val);
                  }}
                  className="sub-dock-slider"
                />
              </label>

              <label className="color-picker-label slider-label">
                <span>Sensitivity: ({config.audioSensitivity ?? 10})</span>
                <input
                  type="range"
                  min="1"
                  max="150"
                  step="1"
                  value={config.audioSensitivity ?? 10}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setConfig((prev) => ({ ...prev, audioSensitivity: val }));
                    if (engine) engine.setAudioSensitivity(val);
                  }}
                  className="sub-dock-slider"
                />
              </label>
            </div>
          </div>
        )}

        {/* Audio Input Selector Sub-dock Drawer */}
        {isInputSelectorOpen && !isColorDrawerOpen && !isSliceDrawerOpen && !isEqDrawerOpen && (
          <div className="sub-dock-row input-selector-drawer">
            <button className={`mini-chip-btn ${activeInput === 'mic' ? 'active' : ''}`} onClick={handleMicClick}>
              <Mic className="tiny-icon" /> Live Mic
            </button>
            
            <button className={`mini-chip-btn ${activeInput === 'system' ? 'active' : ''}`} onClick={handleSystemAudioClick}>
              <Monitor className="tiny-icon" /> Tab / System
            </button>

            <button className={`mini-chip-btn ${activeInput === 'keyboard' ? 'active' : ''}`} onClick={handleKeyboardSynthClick}>
              <Keyboard className="tiny-icon" /> QWERTY / MIDI Piano
            </button>
            
            <label className={`mini-chip-btn ${activeInput === 'file' ? 'active' : ''}`} title="Upload local audio file (100% Client-Side Local Processing Only)">
              <Upload className="tiny-icon" />
              <span>{uploadedFileName ? (uploadedFileName.length > 18 ? uploadedFileName.slice(0, 16) + '…' : uploadedFileName) : 'Local File'}</span>
              <input type="file" accept="audio/*" className="hidden-file-input" onChange={handleFileUpload} />
            </label>

            <button className={`mini-chip-btn ${activeInput === 'youtube' ? 'active' : ''}`} onClick={() => { setActiveInput('youtube'); setIsInputSelectorOpen(false); }}>
              <Video className="tiny-icon text-red-400" /> YouTube
            </button>

            <button className={`mini-chip-btn ${activeInput === 'preset' ? 'active' : ''}`} onClick={() => { setActiveInput('preset'); setIsInputSelectorOpen(false); }}>
              <Music className="tiny-icon" /> Synth Presets
            </button>
          </div>
        )}

        {/* Sub-dock row for YouTube Link Input */}
        {activeInput === 'youtube' && !isColorDrawerOpen && !isSliceDrawerOpen && !isEqDrawerOpen && (
          <div className="sub-dock-row">
            <form onSubmit={handleYoutubeSubmit} className="sub-dock-form">
              <input
                type="url"
                placeholder="Paste YouTube Video or Playlist Link..."
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
        {activeInput === 'preset' && !isColorDrawerOpen && !isSliceDrawerOpen && !isEqDrawerOpen && (
          <div className="sub-dock-row">
            <button className={`mini-chip-btn ${activePreset === 'synth_chords' ? 'active' : ''}`} onClick={() => handlePresetSelect('synth_chords')}>
              Synth
            </button>
            <button className={`mini-chip-btn ${activePreset === 'drum_beat' ? 'active' : ''}`} onClick={() => handlePresetSelect('drum_beat')}>
              Drums
            </button>
            <button className={`mini-chip-btn ${activePreset === 'vocal_arpeggio' ? 'active' : ''}`} onClick={() => handlePresetSelect('vocal_arpeggio')}>
              Arpeggio
            </button>
            <button className={`mini-chip-btn ${activePreset === 'frequency_sweep' ? 'active' : ''}`} onClick={() => handlePresetSelect('frequency_sweep')}>
              Sweep
            </button>
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
              if (isEqDrawerOpen) setIsEqDrawerOpen(false);
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
                : activeInput === 'keyboard'
                ? 'QWERTY Piano'
                : activeInput === 'preset'
                ? 'Presets'
                : activeInput}
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
              if (isEqDrawerOpen) setIsEqDrawerOpen(false);
              if (isInputSelectorOpen) setIsInputSelectorOpen(false);
            }}
            title="Time Window & Frequency Range Slice Controls"
          >
            <SlidersHorizontal className="inline-icon" />
            <span>Slice</span>
          </button>

          {/* EQ & Dynamics Drawer Toggle */}
          <button
            className={`pill-item-btn ${isEqDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              setIsEqDrawerOpen((prev) => !prev);
              if (isColorDrawerOpen) setIsColorDrawerOpen(false);
              if (isSliceDrawerOpen) setIsSliceDrawerOpen(false);
              if (isInputSelectorOpen) setIsInputSelectorOpen(false);
            }}
            title="3-Band EQ & Wave Height Boosts"
          >
            <Activity className="inline-icon" />
            <span>EQ</span>
          </button>

          {/* Gradients, 3D & Atmosphere Drawer Toggle */}
          <button
            className={`pill-item-btn ${isColorDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              setIsColorDrawerOpen((prev) => !prev);
              if (isSliceDrawerOpen) setIsSliceDrawerOpen(false);
              if (isEqDrawerOpen) setIsEqDrawerOpen(false);
              if (isInputSelectorOpen) setIsInputSelectorOpen(false);
            }}
            title="Custom Multi-Stop Gradients, 3D Taper & Atmosphere"
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
