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
      { id: '2', color: '#888888', offset: 0.5 },
      { id: '3', color: '#222222', offset: 1.0 },
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
  const [activeInput, setActiveInput] = useState<AudioInputType>('system');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isColorDrawerOpen, setIsColorDrawerOpen] = useState<boolean>(false);
  const [isSliceDrawerOpen, setIsSliceDrawerOpen] = useState<boolean>(false);
  const [isInputSelectorOpen, setIsInputSelectorOpen] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<PresetTrack>('vocal_arpeggio');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isWallpaperMode, setIsWallpaperMode] = useState<boolean>(false);
  const [isUiVisible, setIsUiVisible] = useState<boolean>(true);
  const [forceHideUi, setForceHideUi] = useState<boolean>(true);
  const [uiYOffset, setUiYOffset] = useState<number>(12);

  const [config, setConfig] = useState<VisualizerConfig>({
    windowSeconds: 1.0,
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
    tiltAngle: 20,
    timeFlowMode: 'right_to_left',
    reversePitchOrder: false,
    eqLow: 10,
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
    widthTaper: 0,
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

  // Auto-hide UI in Wallpaper Mode
  useEffect(() => {
    if (!isWallpaperMode || forceHideUi) {
      if (forceHideUi) setIsUiVisible(false);
      else setIsUiVisible(true);
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setIsUiVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setIsUiVisible(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    timeout = setTimeout(() => setIsUiVisible(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeout);
    };
  }, [isWallpaperMode, forceHideUi]);

  // Wallpaper Engine Property & Audio Listener setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Define Property Listener immediately so WE can send settings on load
    (window as any).wallpaperPropertyListener = {
      applyUserProperties: (properties: any) => {
        if (properties.hide_ui) {
          setForceHideUi(properties.hide_ui.value);
        }
        if (properties.ui_y_offset !== undefined) {
          setUiYOffset(properties.ui_y_offset.value);
        }
        const themeSelected = properties.theme && properties.theme.value !== 'custom';
        if (themeSelected) {
          const themeVal = properties.theme.value;
          const preset = PRESET_GRADIENTS.find(p => p.name.toLowerCase().replace(' ', '_') === themeVal);
          if (preset) {
            setConfig(prev => ({
              ...prev,
              gradientDirection: preset.direction,
              gradientStops: preset.stops.map(s => ({ ...s }))
            }));
          }
        } else if (properties.primary_color || properties.mid_color || properties.secondary_color) {
          setConfig((prev) => {
            const newStops = prev.gradientStops.length === 3 ? [...prev.gradientStops.map(s => ({ ...s }))] : [
              { id: '1', color: '#ffffff', offset: 0.0 },
              { id: '2', color: '#888888', offset: 0.5 },
              { id: '3', color: '#222222', offset: 1.0 },
            ];
            if (properties.primary_color) {
              const c = properties.primary_color.value.split(' ').map((v: string) => Math.round(parseFloat(v) * 255));
              if (newStops[0]) newStops[0].color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            }
            if (properties.mid_color) {
              const c = properties.mid_color.value.split(' ').map((v: string) => Math.round(parseFloat(v) * 255));
              if (newStops[1]) newStops[1].color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            }
            if (properties.secondary_color) {
              const c = properties.secondary_color.value.split(' ').map((v: string) => Math.round(parseFloat(v) * 255));
              if (newStops[2]) newStops[2].color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            }
            return { ...prev, gradientStops: newStops };
          });
        }

        if (properties.audio_sensitivity) {
          const val = properties.audio_sensitivity.value;
          setConfig((prev) => ({ ...prev, audioSensitivity: val }));
          if (engine) engine.setAudioSensitivity(val);
        }
        if (properties.master_gain) setConfig((prev) => ({ ...prev, gain: properties.master_gain.value }));
        if (properties.bloom) setConfig((prev) => ({ ...prev, glowBlur: properties.bloom.value }));
        if (properties.fog_density) setConfig((prev) => ({ ...prev, fogDensity: properties.fog_density.value / 100 }));
        if (properties.band_count) setConfig((prev) => ({ ...prev, bandCount: properties.band_count.value }));
        if (properties.tilt_angle) setConfig((prev) => ({ ...prev, tiltAngle: properties.tilt_angle.value }));
        
        if (properties.bg_color) {
           const c = properties.bg_color.value.split(' ').map((v: string) => Math.round(parseFloat(v) * 255));
           setConfig((prev) => ({ ...prev, bgColor: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }));
        }
        if (properties.sum_color) {
           const c = properties.sum_color.value.split(' ').map((v: string) => Math.round(parseFloat(v) * 255));
           setConfig((prev) => ({ ...prev, sumLineColor: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }));
        }

        if (properties.gradient_direction) setConfig((prev) => ({ ...prev, gradientDirection: properties.gradient_direction.value }));
        if (properties.opacity !== undefined) setConfig((prev) => ({ ...prev, opacity: properties.opacity.value / 100 }));
        if (properties.star_count !== undefined) setConfig((prev) => ({ ...prev, starCount: properties.star_count.value }));
        if (properties.width_taper !== undefined) setConfig((prev) => ({ ...prev, widthTaper: properties.width_taper.value }));
        if (properties.wave_smoothing !== undefined) {
          const val = properties.wave_smoothing.value;
          setConfig((prev) => ({ ...prev, waveSmoothing: val }));
          if (engine) engine.setWaveSmoothing(val);
        }
        if (properties.time_flow_mode) setConfig((prev) => ({ ...prev, timeFlowMode: properties.time_flow_mode.value }));
        if (properties.reverse_pitch_order) setConfig((prev) => ({ ...prev, reversePitchOrder: properties.reverse_pitch_order.value }));
        if (properties.window_seconds) setConfig((prev) => ({ ...prev, windowSeconds: properties.window_seconds.value }));
        if (properties.min_freq !== undefined) setConfig((prev) => ({ ...prev, minFreq: properties.min_freq.value }));
        if (properties.max_freq) setConfig((prev) => ({ ...prev, maxFreq: properties.max_freq.value }));
        if (properties.line_spacing) setConfig((prev) => ({ ...prev, lineSpacing: properties.line_spacing.value }));
        if (properties.sum_gain !== undefined) setConfig((prev) => ({ ...prev, sumGain: properties.sum_gain.value }));
        if (properties.sum_thickness !== undefined) setConfig((prev) => ({ ...prev, sumThickness: properties.sum_thickness.value }));
        if (properties.sum_y_offset !== undefined) setConfig((prev) => ({ ...prev, sumYOffset: properties.sum_y_offset.value }));
        if (properties.sum_mode !== undefined) setConfig((prev) => ({ ...prev, sumMode: properties.sum_mode.value }));

        if (properties.eq_low !== undefined) {
          const val = properties.eq_low.value;
          setConfig((prev) => ({ ...prev, eqLow: val }));
          if (engine) engine.setEqLow(val);
        }
        if (properties.eq_mid !== undefined) {
          const val = properties.eq_mid.value;
          setConfig((prev) => ({ ...prev, eqMid: val }));
          if (engine) engine.setEqMid(val);
        }
        if (properties.eq_high !== undefined) {
          const val = properties.eq_high.value;
          setConfig((prev) => ({ ...prev, eqHigh: val }));
          if (engine) engine.setEqHigh(val);
        }
      }
    };

    // Poll until Wallpaper Engine API is ready
    let started = false;
    const initWEAudio = () => {
      const isWE = (window as any).wallpaperPropertyListener || (window as any).wallpaperRegisterAudioListener;
      if (isWE) {
        setIsWallpaperMode(true);
        if (engine && !started) {
          started = true;
          engine.startWallpaperEngine();
          setActiveInput('wallpaper');
        }
      }
    };

    initWEAudio();
    const interval = setInterval(initWEAudio, 200);
    return () => clearInterval(interval);
  }, [engine]);

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
  if (isWallpaperMode) {
    bottomReservedHeight = 0;
  } else if (isColorDrawerOpen || isSliceDrawerOpen) {
    bottomReservedHeight = 240;
  } else if (isInputSelectorOpen) {
    bottomReservedHeight = 135;
  }

  return (
    <main className="app-viewport">
      {/* Fullscreen Dynamic Ridgeline Canvas with Dynamic Non-Overlay Clearance */}
      <VisualizerCanvas engine={engine} config={config} bottomReservedHeight={bottomReservedHeight} />

      {/* Floating Header */}
      <header className={`floating-header ui-layer ${isUiVisible ? 'ui-visible' : 'ui-hidden'}`}>
        <div className="brand-group">
          <Waves className="brand-icon" />
          <span className="brand-title">UNKNOWN FREQUENCIES</span>
        </div>

        <button className="science-btn" onClick={() => setIsInfoOpen(true)}>
          <HelpCircle className="inline-icon" /> Fourier Science
        </button>
      </header>

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
      <div 
        className={`floating-dock ui-layer ${isUiVisible ? 'ui-visible' : 'ui-hidden'}`}
        style={{ bottom: isWallpaperMode ? `${uiYOffset}%` : '2rem' }}
      >
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
            </div>
          </div>
        )}

        {/* Audio Input Selector Sub-dock Drawer */}
        {!isWallpaperMode && isInputSelectorOpen && !isColorDrawerOpen && !isSliceDrawerOpen && (
          <div className="sub-dock-row input-selector-drawer">
            <button className={`mini-chip-btn ${activeInput === 'mic' ? 'active' : ''}`} onClick={handleMicClick}>
              <Mic className="tiny-icon" /> Live Mic
            </button>
            
            <button className={`mini-chip-btn ${activeInput === 'system' ? 'active' : ''}`} onClick={handleSystemAudioClick}>
              <Monitor className="tiny-icon" /> Tab / System
            </button>
            
            <label className={`mini-chip-btn ${activeInput === 'file' ? 'active' : ''}`} title="Upload local audio file (100% Client-Side Local Processing Only)">
              <Upload className="tiny-icon" />
              <span>{uploadedFileName ? (uploadedFileName.length > 18 ? uploadedFileName.slice(0, 16) + '…' : uploadedFileName) : 'Local File'}</span>
              <input type="file" accept="audio/*" className="hidden-file-input" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {/* Main Floating Pill Dock */}
        {!isWallpaperMode && (
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
            {activeInput === 'wallpaper' && <Monitor className="inline-icon" />}
            {activeInput === 'file' && <Upload className="inline-icon" />}
            <span className="capitalize-text">
              {activeInput === 'file' && uploadedFileName
                ? (uploadedFileName.length > 12 ? uploadedFileName.slice(0, 10) + '…' : uploadedFileName)
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
        )}
      </div>

      {/* Educational Modal */}
      <ExplanationModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </main>
  );
}
