// VisualizerCanvas.tsx - Responsive Ridgeline Visualizer with 3D Isometric Tilt & Offscreen Fog Caching

'use client';

import React, { useEffect, useRef } from 'react';
import { AudioEngine, VisualizerConfig, GradientDirection, GradientStop } from '@/lib/audio/AudioEngine';

interface VisualizerCanvasProps {
  engine: AudioEngine | null;
  config: VisualizerConfig;
  bottomReservedHeight?: number;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
  engine,
  config,
  bottomReservedHeight = 75,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI crisp rendering capped at 2x for optimal mobile/desktop GPU performance
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let globalTime = 0;

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      globalTime += 0.016;

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

      // 4. Blender-style Volumetric Atmosphere Fog Pass
      drawVolumetricNoiseFog(
        ctx,
        width,
        height,
        primaryLineColor,
        config.sumLineColor || '#ffffff',
        config.fogDensity ?? 0.5,
        masterOpacity,
        totalAudioAmp,
        globalTime
      );

      // Draw subtle space star/particle dust
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

      // Array to store summed displacement across time for the combined waveform overlay
      const summedWaveform = new Float32Array(width);

      // Responsive plot width for mobile vs desktop
      const plotWidth = Math.min(width * (isMobile ? 0.92 : 0.75), 950);
      const startX = (width - plotWidth) / 2;
      const endX = startX + plotWidth;

      // Construct dynamic multi-stop gradient stroke style (cached once per frame)
      const lineStrokeStyle = buildGradientStyle(
        ctx,
        config.gradientDirection || 'vertical',
        config.gradientStops || [{ id: '1', color: '#ffffff', offset: 0 }],
        startX,
        endX,
        startY,
        ridgelineHeight
      );

      const allLinePoints: { points: { x: number; y: number }[]; bandIdx: number }[] = [];

      const minHz = config.minFreq || 40;
      const maxHz = config.maxFreq || 9000;
      const hzRatio = maxHz / minHz;
      const stepX = isMobile && bandCount > 32 ? 3 : 2;

      const is3D = config.is3DTilt ?? false;
      const tiltAngle = config.tiltAngle ?? 35;
      const tiltScaleY = is3D ? Math.cos((tiltAngle * Math.PI) / 180) : 1.0;

      // Render stacked ridgeline curves from top (highest Y, b = bandCount - 1) to bottom (lowest Y, b = 0)
      for (let b = bandCount - 1; b >= 0; b--) {
        const floatyOffset = Math.sin(globalTime * 1.2 + b * 0.18) * (isMobile ? 3 : 5);
        let lineBaseY = startY - b * lineGap + floatyOffset;

        if (is3D) {
          const depthProgress = b / bandCount; // 0 (front) to 1 (back)
          lineBaseY = startY - (b * lineGap * tiltScaleY) + floatyOffset * 0.5;
        }

        const baseFreq = minHz * Math.pow(hzRatio, b / bandCount);
        const points: { x: number; y: number }[] = [];

        for (let x = startX; x <= endX; x += stepX) {
          const normPlotX = (x - startX) / plotWidth; // 0.0 to 1.0

          const exactIdx = normPlotX * (historyLen - 1);
          const idx0 = Math.floor(exactIdx);
          const idx1 = Math.min(historyLen - 1, idx0 + 1);
          const frac = exactIdx - idx0;

          const frame0 = history[idx0];
          const frame1 = history[idx1];
          const amp0 = frame0 ? frame0[b] : 0;
          const amp1 = frame1 ? frame1[b] : 0;
          const amp = amp0 * (1 - frac) + amp1 * frac;

          const time = normPlotX * config.windowSeconds;
          const sineCarrier = Math.sin(2 * Math.PI * baseFreq * time * 0.04);

          const normX = normPlotX * 2 - 1;
          const centerWeight = Math.exp(-Math.pow(normX * 1.6, 2));
          const edgeTaper = Math.pow(Math.sin(normPlotX * Math.PI), 0.75);

          const maxAmpDisp = isMobile ? 35 : 50;
          const displacement = amp * (15 + maxAmpDisp * config.gain) * (0.35 + 0.65 * sineCarrier) * centerWeight * edgeTaper * (is3D ? 0.8 : 1.0);
          const currentY = lineBaseY - displacement;

          summedWaveform[Math.floor(x)] += displacement * 0.35;
          points.push({ x, y: currentY });
        }

        if (points.length === 0) continue;
        allLinePoints.push({ points, bandIdx: b });

        // 1. Solid Occlusion Fill
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(endX, height);
        ctx.lineTo(startX, height);
        ctx.closePath();
        ctx.fillStyle = config.bgColor || '#020204';
        ctx.fill();

        // 2. Core Sharp Line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineWidth = isMobile ? 1.3 : 1.6;
        ctx.strokeStyle = lineStrokeStyle;
        ctx.shadowColor = primaryLineColor;
        ctx.shadowBlur = Math.min(20, bloomBlur * 0.6);
        ctx.globalAlpha = 1.0 * masterOpacity;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 6. Additive Volumetric Light Bloom Pass
      if (bloomBlur > 2 && masterOpacity > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const bloomStep = isMobile ? 3 : 2;
        for (let l = 0; l < allLinePoints.length; l += bloomStep) {
          const line = allLinePoints[l];
          ctx.beginPath();
          ctx.moveTo(line.points[0].x, line.points[0].y);
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
          }
          ctx.lineWidth = isMobile ? 4.0 : 6.0;
          ctx.strokeStyle = lineStrokeStyle;
          ctx.shadowColor = primaryLineColor;
          ctx.shadowBlur = bloomBlur * 2.5;
          ctx.globalAlpha = 0.25 * masterOpacity;
          ctx.stroke();
        }

        for (let l = 0; l < allLinePoints.length; l += (isMobile ? 2 : 1)) {
          const line = allLinePoints[l];
          ctx.beginPath();
          ctx.moveTo(line.points[0].x, line.points[0].y);
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
          }
          ctx.lineWidth = isMobile ? 2.0 : 2.5;
          ctx.strokeStyle = lineStrokeStyle;
          ctx.shadowColor = primaryLineColor;
          ctx.shadowBlur = bloomBlur * 1.2;
          ctx.globalAlpha = 0.45 * masterOpacity;
          ctx.stroke();
        }

        ctx.restore();
      }

      // 7. Render Combined Waveform Overlay if enabled
      if (config.showSummedWave) {
        const sumBaseY = centerScreenY - (ridgelineHeight / 2) - (isMobile ? 25 : 40);

        if (bloomBlur > 2 && masterOpacity > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          let firstA = true;
          for (let x = startX; x <= endX; x += stepX) {
            const totalDisp = summedWaveform[Math.floor(x)];
            const y = sumBaseY - totalDisp;
            if (firstA) { ctx.moveTo(x, y); firstA = false; }
            else { ctx.lineTo(x, y); }
          }
          ctx.lineWidth = isMobile ? 4.0 : 6.0;
          ctx.strokeStyle = config.sumLineColor || '#ffffff';
          ctx.shadowColor = config.sumLineColor || '#ffffff';
          ctx.shadowBlur = bloomBlur * 3.5;
          ctx.globalAlpha = 0.5 * masterOpacity;
          ctx.stroke();
          ctx.restore();
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        let first = true;
        for (let x = startX; x <= endX; x += stepX) {
          const totalDisp = summedWaveform[Math.floor(x)];
          const y = sumBaseY - totalDisp;
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineWidth = isMobile ? 1.6 : 2.0;
        ctx.strokeStyle = config.sumLineColor || '#ffffff';
        ctx.shadowColor = config.sumLineColor || '#ffffff';
        ctx.shadowBlur = bloomBlur * 0.8;
        ctx.globalAlpha = 1.0 * masterOpacity;
        ctx.stroke();
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

function drawVolumetricNoiseFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineColor: string,
  sumColor: string,
  fogDensity: number,
  masterOpacity: number,
  audioAmp: number,
  time: number
) {
  if (fogDensity <= 0.01 || masterOpacity <= 0.01) return;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const centerX = width / 2;
  const centerY = height / 2;

  const fogRadius = Math.min(width, height) * (0.45 + 0.25 * fogDensity);
  const fogGrad = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, fogRadius);

  const cLine = lineColor || '#ffffff';
  const cSum = sumColor || '#ffffff';

  const baseAlpha = (fogDensity * 0.35) * (0.7 + 0.6 * audioAmp) * masterOpacity;

  fogGrad.addColorStop(0, hexToRgba(cSum, baseAlpha * 0.9));
  fogGrad.addColorStop(0.4, hexToRgba(cLine, baseAlpha * 0.5));
  fogGrad.addColorStop(0.8, hexToRgba(cLine, baseAlpha * 0.15));
  fogGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 0, width, height);

  const numClouds = Math.floor((width < 768 ? 3 : 6) * fogDensity);
  for (let c = 0; c < numClouds; c++) {
    const cloudAngle = (c / numClouds) * Math.PI * 2 + time * 0.1;
    const cloudDist = (120 + Math.sin(time * 0.5 + c) * 60) * (c % 2 === 0 ? 1 : 1.5);
    const cloudX = centerX + Math.cos(cloudAngle) * cloudDist;
    const cloudY = centerY + Math.sin(cloudAngle * 0.7) * (cloudDist * 0.5);

    const cloudRadius = 180 + Math.sin(c * 17 + time) * 60;
    const cloudGrad = ctx.createRadialGradient(cloudX, cloudY, 10, cloudX, cloudY, cloudRadius);

    const cColor = c % 2 === 0 ? cLine : cSum;
    cloudGrad.addColorStop(0, hexToRgba(cColor, baseAlpha * 0.4));
    cloudGrad.addColorStop(0.6, hexToRgba(cColor, baseAlpha * 0.1));
    cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = cloudGrad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
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
  const numStars = width < 768 ? 20 : 40;
  for (let i = 0; i < numStars; i++) {
    const starX = (Math.sin(i * 99 + time * 0.02) * 0.5 + 0.5) * width;
    const starY = (Math.cos(i * 33 + time * 0.03) * 0.5 + 0.5) * height;
    const alpha = (Math.sin(i * 12 + time * 1.5) * 0.5 + 0.5) * 0.35;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(starX, starY, (i % 3 === 0 ? 1.5 : 1), 0, Math.PI * 2);
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

  const plotWidth = Math.min(width * (isMobile ? 0.92 : 0.75), 950);
  const startX = (width - plotWidth) / 2;
  const endX = startX + plotWidth;

  const strokeStyle = buildGradientStyle(
    ctx,
    config.gradientDirection || 'vertical',
    config.gradientStops || [{ id: '1', color: '#ffffff', offset: 0 }],
    startX,
    endX,
    startY,
    ridgelineHeight
  );

  for (let b = 0; b < config.bandCount; b++) {
    const floatyOffset = Math.sin(time * 1.5 + b * 0.2) * 4;
    const y = startY - b * lineGap + floatyOffset;

    ctx.beginPath();
    ctx.moveTo(startX, y);

    for (let x = startX; x <= endX; x += (isMobile ? 12 : 10)) {
      const normPlotX = (x - startX) / plotWidth;
      const normX = normPlotX * 2 - 1;
      const centerWeight = Math.exp(-Math.pow(normX * 1.8, 2));

      const idleWave = Math.sin(normPlotX * 15 + time * 2 + b * 0.4) * 3 * centerWeight;
      ctx.lineTo(x, y - idleWave);
    }

    ctx.strokeStyle = strokeStyle;
    ctx.globalAlpha = (0.18 + Math.sin(time + b) * 0.05) * (config.opacity ?? 1.0);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}
