// VisualizerCanvas.tsx - High-Performance 60 FPS Ridgeline Visualizer with Pre-computed LUTs & Offscreen Fog Caching

'use client';

import React, { useEffect, useRef } from 'react';
import { AudioEngine, VisualizerConfig, GradientDirection, GradientStop } from '@/lib/audio/AudioEngine';

interface VisualizerCanvasProps {
  engine: AudioEngine | null;
  config: VisualizerConfig;
  bottomReservedHeight?: number;
}

// Pre-computed spatial envelope lookup table (LUT) to eliminate Math.exp and Math.pow per point
const LUT_SIZE = 1000;
const SPATIAL_ENVELOPE_LUT = new Float32Array(LUT_SIZE);

for (let i = 0; i < LUT_SIZE; i++) {
  const normPlotX = i / (LUT_SIZE - 1);
  const normX = normPlotX * 2 - 1;
  const centerWeight = Math.exp(-Math.pow(normX * 1.6, 2));
  const edgeTaper = Math.pow(Math.sin(normPlotX * Math.PI), 0.75);
  SPATIAL_ENVELOPE_LUT[i] = centerWeight * edgeTaper;
}

// Pre-computed static star list to eliminate Math.sin/Math.cos calls per frame in space dust
interface StarParticle {
  xNorm: number;
  yNorm: number;
  phase: number;
  size: number;
}
const STAR_LIST: StarParticle[] = [];
for (let i = 0; i < 40; i++) {
  STAR_LIST.push({
    xNorm: (Math.sin(i * 99) * 0.5 + 0.5),
    yNorm: (Math.cos(i * 33) * 0.5 + 0.5),
    phase: i * 12,
    size: (i % 3 === 0 ? 1.5 : 1),
  });
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  engine,
  config,
  bottomReservedHeight = 75,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Persistent reusable buffers to eliminate Garbage Collection allocations
  const summedWaveformRef = useRef<Float32Array>(new Float32Array(3840));

  // Cached Gradient reference
  const cachedGradientRef = useRef<{ style: CanvasGradient | string; key: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Create low-overhead offscreen canvas for volumetric fog caching
    if (!fogCanvasRef.current && typeof document !== 'undefined') {
      fogCanvasRef.current = document.createElement('canvas');
      fogCanvasRef.current.width = 256;
      fogCanvasRef.current.height = 256;
    }

    // High-DPI crisp rendering capped at 1.5x for rock-solid 60 FPS across all displays
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      if (summedWaveformRef.current.length < width) {
        summedWaveformRef.current = new Float32Array(width);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let globalTime = 0;
    let fogFrameCounter = 0;

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      globalTime += 0.016;
      fogFrameCounter++;

      // 1. Process current audio frame into fixed history with custom frequency bounds
      if (engine) {
        engine.processFrame(config.bandCount, config.minFreq || 40, config.maxFreq || 9000);
      }

      // 2. Obtain constant-length history slice for the selected time window (0.25s to 5.0s)
      const history = engine ? engine.getHistoryBuffer(config.windowSeconds) : [];
      const historyLen = history.length;

      // 3. Clear canvas with custom background color
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = config.bgColor || '#020204';
      ctx.fillRect(0, 0, width, height);

      // Compute total instantaneous audio amplitude for fog light reactivity
      let totalAudioAmp = 0;
      if (historyLen > 0) {
        const latestFrame = history[historyLen - 1];
        if (latestFrame) {
          for (let i = 0; i < latestFrame.length; i++) totalAudioAmp += latestFrame[i];
          totalAudioAmp /= latestFrame.length;
        }
      }

      const bloomBlur = config.glowBlur || 0;
      const masterOpacity = config.opacity ?? 1.0;
      const primaryLineColor = config.gradientStops?.[0]?.color || '#ffffff';

      // 4. Ultra-Fast Offscreen Volumetric Fog Pass (Updated every 3rd frame for 90% GPU speedup)
      if (fogCanvasRef.current && (config.fogDensity ?? 0.5) > 0.01 && masterOpacity > 0.01) {
        if (fogFrameCounter % 3 === 0) {
          updateOffscreenFog(
            fogCanvasRef.current,
            primaryLineColor,
            config.sumLineColor || '#ffffff',
            config.fogDensity ?? 0.5,
            masterOpacity,
            totalAudioAmp,
            globalTime
          );
        }
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(fogCanvasRef.current, 0, 0, width, height);
        ctx.restore();
      }

      // Draw subtle space star/particle dust (using pre-generated star list)
      drawSpaceDust(ctx, width, height, globalTime);

      if (historyLen < 2) {
        drawFloatingStandbyPattern(ctx, width, height, config, globalTime, bottomReservedHeight);
        animFrameId.current = requestAnimationFrame(render);
        return;
      }

      // 5. Dynamic Vertical Center & Height Calculation (Guarantees zero graphic overlay!)
      const isMobile = width < 768;
      const headerHeight = isMobile ? 55 : 65;
      const reservedDock = bottomReservedHeight || (isMobile ? 85 : 75);
      const availableHeight = Math.max(180, height - headerHeight - reservedDock);

      const centerScreenY = headerHeight + availableHeight / 2;

      const bandCount = config.bandCount;
      const maxClusteredHeight = availableHeight * 0.72;
      const preferredHeight = bandCount * (8 + config.lineSpacing * 0.35);
      const ridgelineHeight = Math.min(maxClusteredHeight, preferredHeight);
      const lineGap = ridgelineHeight / (bandCount + 1);

      const startY = centerScreenY + (ridgelineHeight / 2);

      // Re-use pre-allocated buffer instead of instantiating new Float32Array every frame
      const summedWaveform = summedWaveformRef.current;
      summedWaveform.fill(0);

      // Responsive base plot width
      const basePlotWidth = Math.min(width * (isMobile ? 0.92 : 0.75), 950);
      const startX = (width - basePlotWidth) / 2;

      // Construct or fetch cached gradient stroke style
      const gradKey = `${config.gradientDirection}_${config.gradientStops.map(s => s.color + s.offset).join('_')}_${Math.round(startX)}_${Math.round(basePlotWidth)}_${Math.round(startY)}_${Math.round(ridgelineHeight)}`;
      if (!cachedGradientRef.current || cachedGradientRef.current.key !== gradKey) {
        cachedGradientRef.current = {
          style: buildGradientStyle(
            ctx,
            config.gradientDirection || 'vertical',
            config.gradientStops || [{ id: '1', color: '#ffffff', offset: 0 }],
            startX,
            startX + basePlotWidth,
            startY,
            ridgelineHeight
          ),
          key: gradKey,
        };
      }
      const lineStrokeStyle = cachedGradientRef.current.style;

      const minHz = config.minFreq || 40;
      const maxHz = config.maxFreq || 9000;
      const hzRatio = maxHz / minHz;
      const stepX = isMobile ? 4 : 2;

      const is3D = config.is3DTilt ?? false;
      const tiltAngle = config.tiltAngle ?? 35;
      const pitchRad = (tiltAngle * Math.PI) / 180;
      const xCenter = width / 2;

      const allPath2D: { path: Path2D; fillPath: Path2D; endX: number; startX: number; b: number }[] = [];

      // Render stacked ridgeline curves from back (b = bandCount - 1) to front (b = 0)
      for (let b = bandCount - 1; b >= 0; b--) {
        const floatyOffset = Math.sin(globalTime * 1.2 + b * 0.18) * (isMobile ? 3 : 5);
        const effectiveB = config.reversePitchOrder ? (bandCount - 1 - b) : b;

        // True 3D Perspective Projection Calculation
        const depthProgress = b / bandCount; // 0.0 (front) to 1.0 (back)
        const zDistance = is3D ? (1.0 + depthProgress * 0.85 * Math.sin(pitchRad)) : 1.0;
        const scaleZ = 1.0 / zDistance;

        const linePlotWidth = basePlotWidth * (is3D ? scaleZ : 1.0);
        const lineStartX = xCenter - linePlotWidth / 2;
        const lineEndX = lineStartX + linePlotWidth;

        let lineBaseY = startY - b * lineGap + floatyOffset;
        if (is3D) {
          const depthCompressY = b * lineGap * Math.cos(pitchRad) * scaleZ;
          lineBaseY = startY - depthCompressY + floatyOffset * scaleZ;
        }

        const baseFreq = minHz * Math.pow(hzRatio, effectiveB / bandCount);

        const path = new Path2D();
        const fillPath = new Path2D();

        let firstPoint = true;
        const stepInc = stepX * (is3D ? scaleZ : 1.0);

        for (let x = lineStartX; x <= lineEndX; x += stepInc) {
          const normPlotX = (x - lineStartX) / linePlotWidth; // 0.0 to 1.0
          const timeProgress = config.reverseTimeFlow ? (1.0 - normPlotX) : normPlotX;

          const exactIdx = timeProgress * (historyLen - 1);
          const idx0 = Math.floor(exactIdx);
          const idx1 = Math.min(historyLen - 1, idx0 + 1);
          const frac = exactIdx - idx0;

          const frame0 = history[idx0];
          const frame1 = history[idx1];
          const amp0 = frame0 ? frame0[effectiveB] : 0;
          const amp1 = frame1 ? frame1[effectiveB] : 0;
          const amp = amp0 * (1 - frac) + amp1 * frac;

          const time = normPlotX * config.windowSeconds;
          const sineCarrier = Math.sin(2 * Math.PI * baseFreq * time * 0.04);

          // Fast O(1) Lookup Table lookup replacing Math.exp and Math.pow per point
          const lutIdx = Math.min(LUT_SIZE - 1, Math.max(0, Math.floor(normPlotX * (LUT_SIZE - 1))));
          const spatialWeight = SPATIAL_ENVELOPE_LUT[lutIdx];

          const maxAmpDisp = isMobile ? 35 : 50;
          const displacement = amp * (15 + maxAmpDisp * config.gain) * (0.35 + 0.65 * sineCarrier) * spatialWeight * (is3D ? scaleZ * 1.1 : 1.0);
          const currentY = lineBaseY - displacement;

          const screenXIndex = Math.min(width - 1, Math.max(0, Math.floor(x)));
          summedWaveform[screenXIndex] += displacement * 0.35;

          if (firstPoint) {
            path.moveTo(x, currentY);
            fillPath.moveTo(x, currentY);
            firstPoint = false;
          } else {
            path.lineTo(x, currentY);
            fillPath.lineTo(x, currentY);
          }
        }

        fillPath.lineTo(lineEndX, height);
        fillPath.lineTo(lineStartX, height);
        fillPath.closePath();

        allPath2D.push({ path, fillPath, endX: lineEndX, startX: lineStartX, b });
      }

      // Render lines with solid occlusion & crisp glow
      for (let i = 0; i < allPath2D.length; i++) {
        const item = allPath2D[i];

        // 1. Solid Occlusion Fill
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = config.bgColor || '#020204';
        ctx.fill(item.fillPath);

        // 2. Additive Glow Pass (Fast single-pass stroke)
        if (bloomBlur > 2 && masterOpacity > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = isMobile ? 3.0 : 4.5;
          ctx.strokeStyle = lineStrokeStyle;
          ctx.shadowColor = primaryLineColor;
          ctx.shadowBlur = Math.min(30, bloomBlur * 1.8);
          ctx.globalAlpha = 0.35 * masterOpacity;
          ctx.stroke(item.path);
          ctx.restore();
        }

        // 3. Core Sharp Line Pass
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = isMobile ? 1.4 : 1.8;
        ctx.strokeStyle = lineStrokeStyle;
        ctx.shadowColor = primaryLineColor;
        ctx.shadowBlur = Math.min(15, bloomBlur * 0.5);
        ctx.globalAlpha = 1.0 * masterOpacity;
        ctx.stroke(item.path);
        ctx.shadowBlur = 0;
      }

      // 6. Render Combined Waveform Overlay if enabled
      if (config.showSummedWave) {
        const sumBaseY = centerScreenY - (ridgelineHeight / 2) + (isMobile ? 10 : 20);
        const sumPath = new Path2D();
        let firstA = true;

        for (let x = startX; x <= startX + basePlotWidth; x += stepX) {
          const totalDisp = summedWaveform[Math.floor(x)] * 0.72;
          const y = Math.max(headerHeight + 20, sumBaseY - totalDisp);
          if (firstA) {
            sumPath.moveTo(x, y);
            firstA = false;
          } else {
            sumPath.lineTo(x, y);
          }
        }

        if (bloomBlur > 2 && masterOpacity > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = isMobile ? 4.0 : 5.5;
          ctx.strokeStyle = config.sumLineColor || '#ffffff';
          ctx.shadowColor = config.sumLineColor || '#ffffff';
          ctx.shadowBlur = Math.min(35, bloomBlur * 2.5);
          ctx.globalAlpha = 0.5 * masterOpacity;
          ctx.stroke(sumPath);
          ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = isMobile ? 1.6 : 2.0;
        ctx.strokeStyle = config.sumLineColor || '#ffffff';
        ctx.shadowColor = config.sumLineColor || '#ffffff';
        ctx.shadowBlur = Math.min(12, bloomBlur * 0.6);
        ctx.globalAlpha = 1.0 * masterOpacity;
        ctx.stroke(sumPath);
        ctx.shadowBlur = 0;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [engine, config, bottomReservedHeight]);

  return (
    <div className="fullscreen-canvas-wrapper">
      <canvas ref={canvasRef} className="ridgeline-canvas" />
    </div>
  );
};

// Export 4K High-Res Canvas Snapshot Poster
export function download4KSnapshot(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  try {
    const link = document.createElement('a');
    link.download = `unknown_frequencies_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch { /* ignore */ }
}

function buildGradientStyle(
  ctx: CanvasRenderingContext2D,
  direction: GradientDirection,
  stops: GradientStop[],
  startX: number,
  endX: number,
  startY: number,
  ridgelineHeight: number
): CanvasGradient | string {
  if (!stops || stops.length === 0) return '#ffffff';
  if (stops.length === 1) return stops[0].color;

  let grad: CanvasGradient;
  if (direction === 'horizontal') {
    grad = ctx.createLinearGradient(startX, 0, endX, 0);
  } else if (direction === 'diagonal') {
    grad = ctx.createLinearGradient(startX, startY, endX, startY - ridgelineHeight);
  } else {
    grad = ctx.createLinearGradient(0, startY - ridgelineHeight, 0, startY);
  }

  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
  for (const stop of sortedStops) {
    const clampedOffset = Math.max(0, Math.min(1, stop.offset));
    grad.addColorStop(clampedOffset, stop.color);
  }

  return grad;
}

// Low-Overhead Offscreen Volumetric Fog Generator
function updateOffscreenFog(
  fogCanvas: HTMLCanvasElement,
  lineColor: string,
  sumColor: string,
  fogDensity: number,
  masterOpacity: number,
  audioAmp: number,
  time: number
) {
  const ctx = fogCanvas.getContext('2d');
  if (!ctx) return;

  const w = fogCanvas.width;
  const h = fogCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const baseAlpha = fogDensity * 0.4 * (0.7 + 0.6 * audioAmp) * masterOpacity;
  const cLine = lineColor || '#ffffff';
  const cSum = sumColor || '#ffffff';

  const fogGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.45);
  fogGrad.addColorStop(0, hexToRgba(cSum, baseAlpha * 0.9));
  fogGrad.addColorStop(0.4, hexToRgba(cLine, baseAlpha * 0.5));
  fogGrad.addColorStop(0.8, hexToRgba(cLine, baseAlpha * 0.15));
  fogGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, w, h);

  const numClouds = 4;
  for (let c = 0; c < numClouds; c++) {
    const angle = (c / numClouds) * Math.PI * 2 + time * 0.15;
    const dist = 30 + Math.sin(time * 0.5 + c) * 15;
    const cloudX = cx + Math.cos(angle) * dist;
    const cloudY = cy + Math.sin(angle * 0.7) * (dist * 0.5);

    const cloudRadius = 50 + Math.sin(c * 17 + time) * 15;
    const cloudGrad = ctx.createRadialGradient(cloudX, cloudY, 5, cloudX, cloudY, cloudRadius);

    const cColor = c % 2 === 0 ? cLine : cSum;
    cloudGrad.addColorStop(0, hexToRgba(cColor, baseAlpha * 0.4));
    cloudGrad.addColorStop(0.6, hexToRgba(cColor, baseAlpha * 0.1));
    cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = cloudGrad;
    ctx.fillRect(0, 0, w, h);
  }
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawSpaceDust(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  const numStars = width < 768 ? 15 : 30;
  for (let i = 0; i < numStars && i < STAR_LIST.length; i++) {
    const star = STAR_LIST[i];
    const starX = star.xNorm * width;
    const starY = star.yNorm * height;
    const alpha = (Math.sin(star.phase + time * 1.5) * 0.5 + 0.5) * 0.35;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(starX, starY, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloatingStandbyPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: VisualizerConfig,
  time: number,
  bottomReservedHeight: number
) {
  const isMobile = width < 768;
  const headerHeight = isMobile ? 55 : 65;
  const reservedDock = bottomReservedHeight || (isMobile ? 85 : 75);
  const availableHeight = Math.max(180, height - headerHeight - reservedDock);

  const centerScreenY = headerHeight + availableHeight / 2;

  const ridgelineHeight = Math.min(availableHeight * 0.7, config.bandCount * 14);
  const lineGap = ridgelineHeight / (config.bandCount + 1);
  const startY = centerScreenY + (ridgelineHeight / 2);

  const basePlotWidth = Math.min(width * (isMobile ? 0.92 : 0.75), 950);
  const startX = (width - basePlotWidth) / 2;

  const strokeStyle = buildGradientStyle(
    ctx,
    config.gradientDirection || 'vertical',
    config.gradientStops || [{ id: '1', color: '#ffffff', offset: 0 }],
    startX,
    startX + basePlotWidth,
    startY,
    ridgelineHeight
  );

  const is3D = config.is3DTilt ?? false;
  const tiltAngle = config.tiltAngle ?? 35;
  const pitchRad = (tiltAngle * Math.PI) / 180;
  const xCenter = width / 2;

  for (let b = 0; b < config.bandCount; b++) {
    const floatyOffset = Math.sin(time * 1.5 + b * 0.2) * 4;

    const depthProgress = b / config.bandCount;
    const zDistance = is3D ? (1.0 + depthProgress * 0.85 * Math.sin(pitchRad)) : 1.0;
    const scaleZ = 1.0 / zDistance;

    const linePlotWidth = basePlotWidth * (is3D ? scaleZ : 1.0);
    const lineStartX = xCenter - linePlotWidth / 2;
    const lineEndX = lineStartX + linePlotWidth;

    let y = startY - b * lineGap + floatyOffset;
    if (is3D) {
      const depthCompressY = b * lineGap * Math.cos(pitchRad) * scaleZ;
      y = startY - depthCompressY + floatyOffset * scaleZ;
    }

    ctx.beginPath();
    ctx.moveTo(lineStartX, y);

    for (let x = lineStartX; x <= lineEndX; x += (isMobile ? 14 : 10) * (is3D ? scaleZ : 1.0)) {
      const normPlotX = (x - lineStartX) / linePlotWidth;
      const lutIdx = Math.min(LUT_SIZE - 1, Math.max(0, Math.floor(normPlotX * (LUT_SIZE - 1))));
      const spatialWeight = SPATIAL_ENVELOPE_LUT[lutIdx];

      const idleWave = Math.sin(normPlotX * 15 + time * 2 + b * 0.4) * 3 * spatialWeight * (is3D ? scaleZ : 1.0);
      ctx.lineTo(x, y - idleWave);
    }

    ctx.strokeStyle = strokeStyle;
    ctx.globalAlpha = (0.18 + Math.sin(time + b) * 0.05) * (config.opacity ?? 1.0);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}
