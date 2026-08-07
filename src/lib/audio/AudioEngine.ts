// AudioEngine.ts - Web Audio API Engine with Zero-GC Buffer Pool, MIDI & Computer QWERTY Synth

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
  is3DTilt?: boolean; // 3D Isometric tilt perspective toggle
  tiltAngle?: number; // 0 to 60 degrees tilt angle
  reverseTimeFlow?: boolean; // Toggle left-to-right vs right-to-left time flow
  reversePitchOrder?: boolean; // Toggle bass-to-treble vs treble-to-bass vertical stack
}

export type PresetTrack = 'synth_chords' | 'drum_beat' | 'vocal_arpeggio' | 'frequency_sweep';

export type AudioInputType = 'mic' | 'file' | 'youtube' | 'preset' | 'system' | 'keyboard';

export interface AudioEngineCallbacks {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (msg: string) => void;
  onStateChange?: (isPlaying: boolean) => void;
}

// QWERTY Computer Keyboard Note Mapping (2 Octaves)
export const KEY_TO_NOTE_MAP: Record<string, { note: string; freq: number }> = {
  // Lower Octave (Octave 3)
  z: { note: 'C3', freq: 130.81 },
  s: { note: 'C#3', freq: 138.59 },
  x: { note: 'D3', freq: 146.83 },
  d: { note: 'D#3', freq: 155.56 },
  c: { note: 'E3', freq: 164.81 },
  v: { note: 'F3', freq: 174.61 },
  g: { note: 'F#3', freq: 185.0 },
  b: { note: 'G3', freq: 196.0 },
  h: { note: 'G#3', freq: 207.65 },
  n: { note: 'A3', freq: 220.0 },
  j: { note: 'A#3', freq: 233.08 },
  m: { note: 'B3', freq: 246.94 },

  // Upper Octave (Octave 4)
  q: { note: 'C4', freq: 261.63 },
  2: { note: 'C#4', freq: 277.18 },
  w: { note: 'D4', freq: 293.66 },
  3: { note: 'D#4', freq: 311.13 },
  e: { note: 'E4', freq: 329.63 },
  r: { note: 'F4', freq: 349.23 },
  5: { note: 'F#4', freq: 369.99 },
  t: { note: 'G4', freq: 392.0 },
  6: { note: 'G#4', freq: 415.3 },
  y: { note: 'A4', freq: 440.0 },
  7: { note: 'A#4', freq: 466.16 },
  u: { note: 'B4', freq: 493.88 },
  i: { note: 'C5', freq: 523.25 },
};

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

  // Polyphonic Keyboard/MIDI Synthesizer active voices
  private activeVoices: Map<string, { osc1: OscillatorNode; osc2: OscillatorNode; vGain: GainNode }> = new Map();

  private activeInput: AudioInputType = 'preset';
  private isPlaying: boolean = false;

  // Zero-GC Pre-allocated Reusable Buffer Pool
  private historyBuffer: Float32Array[] = [];
  private maxHistoryFrames: number = 300; // Fixed 5 sec capacity
  private bufferPool: Float32Array[] = []; // Pool of reusable arrays
  private poolPointer: number = 0;

  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private prevBandValues: Float32Array = new Float32Array(0);

  private callbacks: AudioEngineCallbacks = {};

  constructor(callbacks?: AudioEngineCallbacks) {
    if (callbacks) this.callbacks = callbacks;
    this.initBufferPool(32, 400);
    this.resetHistoryBuffer(32);
    this.setupVisibilityListeners();
  }

  // Pre-allocate buffer pool to eliminate Garbage Collection allocations in render loop
  private initBufferPool(bandCount: number, poolSize: number) {
    this.bufferPool = [];
    for (let i = 0; i < poolSize; i++) {
      this.bufferPool.push(new Float32Array(bandCount));
    }
    this.poolPointer = 0;
  }

  private getPooledBuffer(bandCount: number): Float32Array {
    if (this.bufferPool.length === 0 || this.bufferPool[0].length !== bandCount) {
      this.initBufferPool(bandCount, 400);
    }
    const buf = this.bufferPool[this.poolPointer];
    this.poolPointer = (this.poolPointer + 1) % this.bufferPool.length;
    return buf;
  }

  private setupVisibilityListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => { /* ignore */ });
        }
      } else {
        if (this.ctx && this.ctx.state === 'suspended' && this.isPlaying) {
          this.ctx.resume().catch(() => { /* ignore */ });
        }
      }
    });
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

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    });
    if (!this.ctx || !this.analyser) return;

    this.micNode = this.ctx.createMediaStreamSource(this.micStream);
    this.micNode.connect(this.analyser);
    this.activeInput = 'mic';
    this.isPlaying = true;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
  }

  public async startSystemAudio(): Promise<void> {
    await this.initContext();
    this.stopAllSources();

    let displayStream: MediaStream;
    try {
      // Optimize getDisplayMedia constraints to request minimal 1px 1fps video stream
      // to prevent heavy OS GPU video capture and encoding overhead
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: {
          width: { max: 1 },
          height: { max: 1 },
          frameRate: { max: 1 },
        },
      } as DisplayMediaStreamOptions);
    } catch (err) {
      // Fallback for Firefox/Zen/Safari which often reject strict video constraints
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: true,
      });
    }

    displayStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
      track.stop();
    });

    const audioTracks = displayStream.getAudioTracks();
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw new Error('No audio track selected. Make sure to check "Share audio". (Note: Firefox/Zen often lack system audio capture support depending on your OS. Try Chrome/Edge if this persists).');
    }

    if (!this.ctx || !this.analyser) return;

    this.micStream = displayStream;
    this.micNode = this.ctx.createMediaStreamSource(displayStream);
    this.micNode.connect(this.analyser);

    audioTracks[0].onended = () => {
      this.stopAllSources();
    };

    this.activeInput = 'system';
    this.isPlaying = true;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
  }

  public async loadAudioFile(file: File): Promise<void> {
    await this.initContext();
    this.stopAllSources();

    const url = URL.createObjectURL(file);

    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.crossOrigin = 'anonymous';

      this.audioElement.ontimeupdate = () => {
        if (this.audioElement && this.callbacks.onTimeUpdate) {
          this.callbacks.onTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
        }
      };

      this.audioElement.onended = () => {
        this.isPlaying = false;
        if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
        if (this.callbacks.onEnded) this.callbacks.onEnded();
      };
    }

    this.audioElement.src = url;

    if (!this.mediaElementNode && this.ctx && this.analyser && this.gainNode) {
      this.mediaElementNode = this.ctx.createMediaElementSource(this.audioElement);
      this.mediaElementNode.connect(this.analyser);
      this.mediaElementNode.connect(this.gainNode);
    }

    await this.audioElement.play();
    this.activeInput = 'file';
    this.isPlaying = true;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
  }

  // Start Keyboard / MIDI Virtual Synth Mode
  public async startKeyboardSynth(): Promise<void> {
    await this.initContext();
    this.stopAllSources();

    this.activeInput = 'keyboard';
    this.isPlaying = true;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);

    // Request Web MIDI access if available
    if (navigator.requestMIDIAccess) {
      try {
        const midiAccess = await navigator.requestMIDIAccess();
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = (e) => this.handleMIDIMessage(e);
        });
      } catch { /* ignore MIDI access deny */ }
    }
  }

  private handleMIDIMessage(event: { data?: Uint8Array | null }) {
    if (!event.data) return;
    const [status, noteNumber, velocity] = event.data;
    const command = status >> 4;

    if (command === 9 && velocity > 0) {
      const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
      this.noteOn(freq, `midi_${noteNumber}`);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      this.noteOff(`midi_${noteNumber}`);
    }
  }

  // Play polyphonic note with 1 pure sine wave oscillator
  public noteOn(frequency: number, noteKey: string) {
    if (!this.ctx || !this.analyser || !this.gainNode) return;
    if (this.activeVoices.has(noteKey)) return;

    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const vGain = this.ctx.createGain();

    // 1 Perfect Pure Sine Wave
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, now);

    // Smooth Attack Envelope
    vGain.gain.setValueAtTime(0.0001, now);
    vGain.gain.linearRampToValueAtTime(0.25, now + 0.03);

    osc1.connect(vGain);
    vGain.connect(this.analyser);
    vGain.connect(this.gainNode);

    osc1.start(now);

    this.activeVoices.set(noteKey, { osc1, osc2: osc1, vGain });
  }

  public noteOff(noteKey: string) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(noteKey);
    if (!voice) return;

    const now = this.ctx.currentTime;
    // Release envelope
    voice.vGain.gain.cancelScheduledValues(now);
    voice.vGain.gain.setValueAtTime(voice.vGain.gain.value, now);
    voice.vGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    setTimeout(() => {
      try {
        voice.osc1.stop();
        voice.osc1.disconnect();
        if (voice.osc2 && voice.osc2 !== voice.osc1) {
          voice.osc2.stop();
          voice.osc2.disconnect();
        }
        voice.vGain.disconnect();
      } catch { /* ignore */ }
    }, 180);

    this.activeVoices.delete(noteKey);
  }

  public async playPreset(preset: PresetTrack): Promise<void> {
    await this.initContext();
    this.stopAllSources();

    this.currentPreset = preset;
    this.activeInput = 'preset';
    this.isPlaying = true;

    if (preset === 'synth_chords') {
      this.playSynthChordsSequence();
    } else if (preset === 'drum_beat') {
      this.playDrumBeatSequence();
    } else if (preset === 'vocal_arpeggio') {
      this.playArpeggioSequence();
    } else if (preset === 'frequency_sweep') {
      this.playFrequencySweepSequence();
    }

    if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
  }

  private playSynthChordsSequence() {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const chords = [
      [261.63, 329.63, 392.0, 523.25], // C Major
      [220.0, 261.63, 329.63, 440.0],  // A Minor
      [174.61, 220.0, 261.63, 349.23], // F Major
      [196.0, 246.94, 293.66, 392.0],  // G Major
    ];

    let chordIdx = 0;

    const triggerChord = () => {
      if (!this.ctx || !this.analyser || !this.gainNode) return;
      const now = this.ctx.currentTime;
      const currentChord = chords[chordIdx];
      chordIdx = (chordIdx + 1) % chords.length;

      currentChord.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const subOsc = this.ctx!.createOscillator();
        const noteGain = this.ctx!.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freq / 2, now);

        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.12, now + 0.1);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(noteGain);
        subOsc.connect(noteGain);
        noteGain.connect(this.analyser!);
        noteGain.connect(this.gainNode!);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 1.9);
        subOsc.stop(now + 1.9);

        this.presetOscillators.push(osc, subOsc);
      });
    };

    triggerChord();
    const interval = setInterval(triggerChord, 2000);
    this.presetIntervals.push(interval);
  }

  private playDrumBeatSequence() {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    let step = 0;
    const bpm = 120;
    const stepTime = (60 / bpm) / 4 * 1000;

    const triggerStep = () => {
      if (!this.ctx || !this.analyser || !this.gainNode) return;
      const now = this.ctx.currentTime;

      // Kick drum on 0, 4, 8, 12
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();

        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

        kickGain.gain.setValueAtTime(0.5, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        kickOsc.connect(kickGain);
        kickGain.connect(this.analyser);
        kickGain.connect(this.gainNode);

        kickOsc.start(now);
        kickOsc.stop(now + 0.35);
        this.presetOscillators.push(kickOsc);
      }

      // Snare on 4, 12
      if (step % 8 === 4) {
        const snareOsc = this.ctx.createOscillator();
        const snareGain = this.ctx.createGain();

        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(250, now);
        snareOsc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

        snareGain.gain.setValueAtTime(0.35, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        snareOsc.connect(snareGain);
        snareGain.connect(this.analyser);
        snareGain.connect(this.gainNode);

        snareOsc.start(now);
        snareOsc.stop(now + 0.22);
        this.presetOscillators.push(snareOsc);
      }

      step = (step + 1) % 16;
    };

    triggerStep();
    const interval = setInterval(triggerStep, stepTime);
    this.presetIntervals.push(interval);
  }

  private playArpeggioSequence() {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25, 392.0, 329.63];
    let noteIdx = 0;

    const triggerNote = () => {
      if (!this.ctx || !this.analyser || !this.gainNode) return;
      const now = this.ctx.currentTime;
      const freq = notes[noteIdx];
      noteIdx = (noteIdx + 1) % notes.length;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(noteGain);
      noteGain.connect(this.analyser);
      noteGain.connect(this.gainNode);

      osc.start(now);
      osc.stop(now + 0.28);
      this.presetOscillators.push(osc);
    };

    triggerNote();
    const interval = setInterval(triggerNote, 160);
    this.presetIntervals.push(interval);
  }

  private playFrequencySweepSequence() {
    if (!this.ctx || !this.analyser || !this.gainNode) return;

    const triggerSweep = () => {
      if (!this.ctx || !this.analyser || !this.gainNode) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(50, now);
      osc.frequency.exponentialRampToValueAtTime(6000, now + 3.0);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.2, now + 0.2);
      noteGain.gain.setValueAtTime(0.2, now + 2.8);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

      osc.connect(noteGain);
      noteGain.connect(this.analyser);
      noteGain.connect(this.gainNode);

      osc.start(now);
      osc.stop(now + 3.3);
      this.presetOscillators.push(osc);
    };

    triggerSweep();
    const interval = setInterval(triggerSweep, 3500);
    this.presetIntervals.push(interval);
  }

  public pause(): void {
    if (this.audioElement && this.activeInput === 'file') {
      this.audioElement.pause();
    } else {
      this.stopAllSources();
    }
    this.isPlaying = false;
    if (this.callbacks.onStateChange) this.callbacks.onStateChange(false);
  }

  public resume(): void {
    if (this.audioElement && this.activeInput === 'file') {
      this.audioElement.play();
      this.isPlaying = true;
      if (this.callbacks.onStateChange) this.callbacks.onStateChange(true);
    }
  }

  public stopAllSources(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
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

    this.activeVoices.forEach((voice) => {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
        voice.osc1.disconnect();
        voice.osc2.disconnect();
        voice.vGain.disconnect();
      } catch { /* ignore */ }
    });
    this.activeVoices.clear();

    this.presetIntervals.forEach((interval) => clearInterval(interval));
    this.presetIntervals = [];

    this.presetOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch { /* ignore */ }
    });
    this.presetOscillators = [];

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

  // Zero-GC Frame Processing Loop (Uses Pooled Reusable Float32Array Buffers)
  public processFrame(bandCount: number, minFreq: number = 40, maxFreq: number = 9000): Float32Array {
    if (!this.analyser) {
      return this.getPooledBuffer(bandCount);
    }

    if (this.prevBandValues.length !== bandCount) {
      this.prevBandValues = new Float32Array(bandCount);
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
    const binHz = sampleRate / (this.analyser.fftSize || 2048);
    const totalBins = this.freqData.length;

    // Fetch zero-GC pooled array instead of instantiating new Float32Array
    const bandValues = this.getPooledBuffer(bandCount);

    const minHz = Math.max(20, minFreq);
    const maxHz = Math.min(18000, Math.max(minHz + 100, maxFreq));
    const hzRatio = maxHz / minHz;

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
      const rawVal = avg / 255.0;

      const smoothed = this.prevBandValues[i] * 0.3 + rawVal * 0.7;
      this.prevBandValues[i] = smoothed;
      bandValues[i] = smoothed;
    }

    this.historyBuffer.push(bandValues);
    while (this.historyBuffer.length > this.maxHistoryFrames) {
      this.historyBuffer.shift();
    }

    return bandValues;
  }

  public getHistoryBuffer(windowSeconds: number): Float32Array[] {
    const requestedFrames = Math.max(10, Math.min(this.maxHistoryFrames, Math.round(60 * windowSeconds)));
    if (this.historyBuffer.length <= requestedFrames) {
      return this.historyBuffer;
    }
    return this.historyBuffer.slice(this.historyBuffer.length - requestedFrames);
  }
}
