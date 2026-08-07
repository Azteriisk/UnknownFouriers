// AudioEngine.ts - Real-time Web Audio API & Fourier Analysis Engine

export type AudioInputType = 'mic' | 'system' | 'file' | 'youtube' | 'preset';

export interface GradientStop {
  id: string;
  color: string;
  offset: number; // 0.0 to 1.0
}

export type GradientDirection = 'vertical' | 'horizontal' | 'diagonal';

export interface VisualizerConfig {
  windowSeconds: number; // 0.25s to 5.0s continuous time window slice
  minFreq: number; // 20Hz to 1000Hz min frequency bound (default 40)
  maxFreq: number; // 500Hz to 16000Hz max frequency bound (default 9000)
  bandCount: number; // 8 to 64 sines
  lineSpacing: number; // pixels spacing
  gain: number; // amplitude multiplier
  showSummedWave: boolean; // toggle sum overlay
  glowBlur: number; // 0 to 60 bloom glow
  fogDensity: number; // 0.0 to 1.0 atmospheric fog volume
  opacity: number; // 0.0 to 1.0 master visual opacity (default 1.0)
  gradientDirection: GradientDirection;
  gradientStops: GradientStop[];
  sumLineColor: string; // hex color for master sum (default #ffffff)
  bgColor: string; // hex color for background (default #020204)
}

export type PresetTrack = 'synth_chords' | 'drum_beat' | 'vocal_arpeggio' | 'frequency_sweep';

export interface AudioEngineCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (msg: string) => void;
  onStateChange?: (isPlaying: boolean) => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private mediaElementNode: MediaElementAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private presetOscillators: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private presetIntervals: ReturnType<typeof setInterval>[] = [];
  private currentPreset: PresetTrack | null = null;
  private gainNode: GainNode | null = null;

  private activeInput: AudioInputType = 'preset';
  private isPlaying: boolean = false;
  private historyBuffer: Float32Array[] = []; // Fixed 300 frame buffer (5s at 60fps)
  private maxHistoryFrames: number = 300; // Fixed 5 sec capacity
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevBandValues: Float32Array = new Float32Array(0);

  private callbacks: AudioEngineCallbacks = {};

  constructor(callbacks?: AudioEngineCallbacks) {
    if (callbacks) this.callbacks = callbacks;
    this.resetHistoryBuffer(32);
  }

  public async initContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.ctx.destination);
      
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
    return this.ctx;
  }

  public async startMic(): Promise<void> {
    await this.initContext();
    this.stopAllSources();
    this.activeInput = 'mic';

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!this.ctx || !this.analyser) return;

      this.micNode = this.ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.analyser);

      this.isPlaying = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied or unavailable.';
      if (this.callbacks.onError) this.callbacks.onError(msg);
      throw err;
    }
  }

  public async startSystemAudio(): Promise<void> {
    await this.initContext();
    this.stopAllSources();
    this.activeInput = 'system';

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No audio stream captured. Make sure to check "Share Audio" when picking a Tab or System window.');
      }

      // Stop video track as we only analyze audio
      stream.getVideoTracks().forEach((t) => t.stop());

      const audioStream = new MediaStream([audioTrack]);

      if (!this.ctx || !this.analyser) return;

      this.micNode = this.ctx.createMediaStreamSource(audioStream);
      this.micStream = audioStream;

      this.micNode.connect(this.analyser);

      this.isPlaying = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'System/Tab audio capture canceled or unsupported.';
      if (this.callbacks.onError) this.callbacks.onError(msg);
      throw err;
    }
  }

  public async loadAudioFile(file: File): Promise<void> {
    await this.initContext();
    this.stopAllSources();
    this.activeInput = 'file';

    const url = URL.createObjectURL(file);
    this.setupAudioElement(url);
  }

  public async loadAudioUrl(url: string): Promise<void> {
    await this.initContext();
    this.stopAllSources();
    this.activeInput = 'youtube';

    this.setupAudioElement(url);
  }

  private setupAudioElement(url: string) {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';

      this.audioElement.addEventListener('timeupdate', () => {
        if (this.callbacks.onTimeUpdate && this.audioElement) {
          this.callbacks.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
        }
      });

      this.audioElement.addEventListener('ended', () => {
        this.isPlaying = false;
        if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
        if (this.callbacks.onEnded) this.callbacks.onEnded();
      });
    }

    this.audioElement.src = url;
    
    if (!this.mediaElementNode && this.audioElement) {
      this.mediaElementNode = this.ctx.createMediaElementSource(this.audioElement);
      this.mediaElementNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
    }

    this.audioElement.play().then(() => {
      this.isPlaying = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    }).catch(err => {
      if (this.callbacks.onError) this.callbacks.onError(`Audio playback error: ${err.message}`);
    });
  }

  public async playPreset(preset: PresetTrack): Promise<void> {
    await this.initContext();
    this.stopAllSources();
    this.activeInput = 'preset';
    this.currentPreset = preset;

    if (!this.ctx || !this.analyser || !this.gainNode) return;

    if (preset === 'synth_chords') {
      this.generateSynthChords();
    } else if (preset === 'drum_beat') {
      this.generateDrumBeat();
    } else if (preset === 'vocal_arpeggio') {
      this.generateVocalArpeggio();
    } else if (preset === 'frequency_sweep') {
      this.generateFrequencySweep();
    }

    this.isPlaying = true;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
  }

  private generateSynthChords(): void {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const notes = [
      [130.81, 164.81, 196.00, 246.94], // C maj7
      [110.00, 130.81, 164.81, 196.00], // A min7
      [146.83, 174.61, 220.00, 261.63], // D min7
      [97.99, 123.47, 146.83, 196.00],  // G7
    ];

    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(this.analyser);
    this.analyser.connect(this.gainNode);

    let chordIdx = 0;
    const playChord = () => {
      if (!this.ctx || this.activeInput !== 'preset' || this.currentPreset !== 'synth_chords') return;
      const currentNotes = notes[chordIdx % notes.length];
      chordIdx++;

      currentNotes.forEach(freq => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const env = this.ctx.createGain();

        osc.type = 'sawtooth';
        subOsc.type = 'sine';

        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        subOsc.frequency.setValueAtTime(freq / 2, this.ctx.currentTime);

        env.gain.setValueAtTime(0.001, this.ctx.currentTime);
        env.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);
        env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

        osc.connect(env);
        subOsc.connect(env);
        env.connect(masterGain);

        osc.start();
        subOsc.start();
        osc.stop(this.ctx.currentTime + 2.0);
        subOsc.stop(this.ctx.currentTime + 2.0);

        this.presetOscillators.push(osc, subOsc);
      });
    };

    playChord();
    const interval = setInterval(() => {
      if (this.activeInput !== 'preset' || !this.isPlaying || this.currentPreset !== 'synth_chords') {
        clearInterval(interval);
        return;
      }
      playChord();
    }, 2000);
    this.presetIntervals.push(interval);
  }

  private generateDrumBeat(): void {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(this.analyser);
    this.analyser.connect(this.gainNode);

    let step = 0;
    const playStep = () => {
      if (!this.ctx || this.activeInput !== 'preset' || this.currentPreset !== 'drum_beat') return;

      const t = this.ctx.currentTime;

      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(150, t);
        kickOsc.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
        kickGain.gain.setValueAtTime(1, t);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        kickOsc.connect(kickGain);
        kickGain.connect(masterGain);
        kickOsc.start(t);
        kickOsc.stop(t + 0.3);
        this.presetOscillators.push(kickOsc);
      }

      if (step % 8 === 4) {
        const snareNoise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        snareNoise.buffer = buffer;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        snareNoise.connect(noiseGain);
        noiseGain.connect(masterGain);
        snareNoise.start(t);
        this.presetOscillators.push(snareNoise);
      }

      const hatOsc = this.ctx.createOscillator();
      const hatGain = this.ctx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(7000 + Math.random() * 2000, t);
      hatGain.gain.setValueAtTime(step % 2 === 0 ? 0.15 : 0.08, t);
      hatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      hatOsc.connect(hatGain);
      hatGain.connect(masterGain);
      hatOsc.start(t);
      hatOsc.stop(t + 0.05);
      this.presetOscillators.push(hatOsc);

      step = (step + 1) % 16;
    };

    playStep();
    const interval = setInterval(() => {
      if (this.activeInput !== 'preset' || !this.isPlaying || this.currentPreset !== 'drum_beat') {
        clearInterval(interval);
        return;
      }
      playStep();
    }, 150);
    this.presetIntervals.push(interval);
  }

  private generateVocalArpeggio(): void {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(this.analyser);
    this.analyser.connect(this.gainNode);

    let idx = 0;
    const playNote = () => {
      if (!this.ctx || this.activeInput !== 'preset' || this.currentPreset !== 'vocal_arpeggio') return;
      const t = this.ctx.currentTime;
      const freq = scale[idx % scale.length];
      idx++;

      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc2.type = 'sine';

      osc.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 2, t);

      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.2, t + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(env);
      osc2.connect(env);
      env.connect(masterGain);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + 0.4);
      osc2.stop(t + 0.4);

      this.presetOscillators.push(osc, osc2);
    };

    playNote();
    const interval = setInterval(() => {
      if (this.activeInput !== 'preset' || !this.isPlaying || this.currentPreset !== 'vocal_arpeggio') {
        clearInterval(interval);
        return;
      }
      playNote();
    }, 200);
    this.presetIntervals.push(interval);
  }

  private generateFrequencySweep(): void {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(this.analyser);
    this.analyser.connect(this.gainNode);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const t = this.ctx.currentTime;

    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(8000, t + 4.0);

    osc.connect(masterGain);
    osc.start(t);
    osc.stop(t + 4.0);

    this.presetOscillators.push(osc);

    const interval = setInterval(() => {
      if (this.activeInput !== 'preset' || !this.isPlaying || !this.ctx || this.currentPreset !== 'frequency_sweep') {
        clearInterval(interval);
        return;
      }
      const now = this.ctx.currentTime;
      const nextOsc = this.ctx.createOscillator();
      nextOsc.type = 'sine';
      nextOsc.frequency.setValueAtTime(50, now);
      nextOsc.frequency.exponentialRampToValueAtTime(8000, now + 4.0);
      nextOsc.connect(masterGain);
      nextOsc.start(now);
      nextOsc.stop(now + 4.0);
      this.presetOscillators.push(nextOsc);
    }, 4000);
    this.presetIntervals.push(interval);
  }

  public pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.isPlaying = false;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
  }

  public resume(): void {
    if (this.audioElement && this.activeInput !== 'mic') {
      this.audioElement.play();
      this.isPlaying = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    }
  }

  public seek(seconds: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = seconds;
    }
  }

  public setVolume(vol: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  public stopAllSources(): void {
    this.isPlaying = false;

    this.presetIntervals.forEach(id => clearInterval(id));
    this.presetIntervals = [];
    this.currentPreset = null;

    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micNode) {
      this.micNode.disconnect();
      this.micNode = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    this.presetOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch { /* ignore */ }
    });
    this.presetOscillators = [];

    // Reset history buffer to full 180 blank zero frames
    this.resetHistoryBuffer(32);

    if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
  }

  public resetHistoryBuffer(bandCount: number): void {
    this.historyBuffer = [];
    this.prevBandValues = new Float32Array(bandCount);
    for (let i = 0; i < this.maxHistoryFrames; i++) {
      this.historyBuffer.push(new Float32Array(bandCount));
    }
  }

  /**
   * Called every animation frame (60fps) to sample frequency data into the rolling window
   */
  public processFrame(bandCount: number, minFreq: number = 40, maxFreq: number = 9000): Float32Array {
    if (!this.analyser) {
      return new Float32Array(bandCount);
    }

    if (this.prevBandValues.length !== bandCount) {
      this.prevBandValues = new Float32Array(bandCount);
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    // Sample rate (default 44100Hz) & FFT bin width
    const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
    const binHz = sampleRate / (this.analyser.fftSize || 2048);
    const totalBins = this.freqData.length;
    const bandValues = new Float32Array(bandCount);

    const minHz = Math.max(20, minFreq);
    const maxHz = Math.min(18000, Math.max(minHz + 100, maxFreq));
    const hzRatio = maxHz / minHz;

    // Group frequency bins into logarithmically spaced musical octave pitch buckets
    for (let i = 0; i < bandCount; i++) {
      const fStart = minHz * Math.pow(hzRatio, i / bandCount);
      const fEnd = minHz * Math.pow(hzRatio, (i + 1) / bandCount);

      const binStart = Math.min(totalBins - 1, Math.max(0, Math.floor(fStart / binHz)));
      const binEnd = Math.min(totalBins, Math.max(binStart + 1, Math.floor(fEnd / binHz)));

      let sum = 0;
      let count = 0;
      for (let b = binStart; b < binEnd && b < totalBins; b++) {
        sum += this.freqData[b];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      const rawVal = avg / 255.0; // Normalized 0.0 - 1.0

      // Smooth temporal attack/decay filter
      const smoothed = this.prevBandValues[i] * 0.3 + rawVal * 0.7;
      this.prevBandValues[i] = smoothed;
      bandValues[i] = smoothed;
    }

    // Always maintain fixed 180 frame rolling history
    this.historyBuffer.push(bandValues);
    while (this.historyBuffer.length > this.maxHistoryFrames) {
      this.historyBuffer.shift();
    }

    return bandValues;
  }

  /**
   * Returns exact slice of frames corresponding to requested windowSeconds (1s, 2s, or 3s)
   */
  public getHistoryBuffer(windowSeconds: number = 3): Float32Array[] {
    const requestedLength = Math.min(this.maxHistoryFrames, Math.round(60 * windowSeconds));
    if (this.historyBuffer.length <= requestedLength) {
      return this.historyBuffer;
    }
    return this.historyBuffer.slice(this.historyBuffer.length - requestedLength);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getActiveInput(): AudioInputType {
    return this.activeInput;
  }
}
