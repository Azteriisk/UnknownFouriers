// src/app/page.tsx - Wallpaper Engine Edition
// Full 60/120 FPS Ridgeline Audio Visualizer with 3D Tilt & Taper, 3-Band EQ,
// Sum Wave, and 100% Wallpaper Engine Native Property Listener Control.

'use client';

import React, { useState, useEffect } from 'react';
import {
  AudioEngine,
  VisualizerConfig,
  GradientDirection,
  GradientStop,
} from '@/lib/audio/AudioEngine';
import { VisualizerCanvas } from '@/components/VisualizerCanvas';

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

  // Initialize AudioEngine for Wallpaper Engine
  useEffect(() => {
    const audioEng = new AudioEngine();
    setEngine(audioEng);

    return () => {
      audioEng.stopAllSources();
    };
  }, []);

  // Synchronize AudioEngine parameters whenever engine or config changes
  useEffect(() => {
    if (!engine) return;
    engine.setAudioSensitivity(config.audioSensitivity ?? 10);
    engine.setWaveSmoothing(config.waveSmoothing ?? 8);
    engine.setEqLow(config.eqLow ?? 15);
    engine.setEqMid(config.eqMid ?? -10);
    engine.setEqHigh(config.eqHigh ?? 10);
  }, [engine, config.audioSensitivity, config.waveSmoothing, config.eqLow, config.eqMid, config.eqHigh]);

  // Wallpaper Engine Property & Audio Listener setup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Define Property Listener immediately so WE can send settings on load
    (window as any).wallpaperPropertyListener = {
      applyUserProperties: (properties: any) => {
        if (properties.theme) {
          const themeVal = properties.theme.value;
          if (themeVal !== 'custom') {
            const found = PRESET_GRADIENTS.find((p) => p.name.toLowerCase().replace(' ', '_') === themeVal);
            if (found) {
              setConfig((prev) => ({
                ...prev,
                gradientDirection: found.direction,
                gradientStops: found.stops.map((s) => ({ ...s })),
              }));
            }
          }
        }

        if (properties.primary_color || properties.mid_color || properties.secondary_color) {
          setConfig((prev) => {
            const newStops = [...prev.gradientStops];
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

    // Initialize Wallpaper Engine Audio
    if (engine) {
      engine.startWallpaperEngine();
    }
  }, [engine]);

  return (
    <main className="app-viewport">
      {/* Fullscreen Dedicated Wallpaper Engine Canvas with 0 Clearance */}
      <VisualizerCanvas engine={engine} config={config} bottomReservedHeight={0} />
    </main>
  );
}
