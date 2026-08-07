// ExplanationModal.tsx - High-End Minimalist Fourier & Pulsar Science Overlay

'use client';

import React from 'react';
import { X, Activity, Radio, Cpu, ExternalLink } from 'lucide-react';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Activity className="modal-icon" />
            <div className="title-stack">
              <h2>SPECTRAL DECOMPOSITION</h2>
              <span className="subtitle-mono">FOURIER HARMONIC SYNTHESIS MANUAL</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="modal-body">
          <div className="tech-card">
            <div className="tech-card-header">
              <Cpu className="inline-icon" />
              <span>01 / FOURIER SPECTRAL ANALYSIS</span>
            </div>
            <p>
              In 1822, mathematician <strong>Joseph Fourier</strong> established that any acoustic signal (from acoustic instruments to complex synthesized sound) is composed of individual pure sinusoidal wave partials combined across time.
            </p>
          </div>

          <div className="tech-card">
            <div className="tech-card-header">
              <Activity className="inline-icon" />
              <span>02 / REAL-TIME FFT OCTAVE BANDS</span>
            </div>
            <p>
              The Web Audio API <strong>Fast Fourier Transform (FFT)</strong> separates incoming audio frequencies into discrete logarithmic octave partials:
            </p>
            <div className="spec-grid">
              <div className="spec-item">
                <span className="spec-label">BASS (40–250 Hz)</span>
                <span className="spec-desc">Sub-harmonic foundations rendered at the base.</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">MID (250–2000 Hz)</span>
                <span className="spec-desc">Vocal & instrument fundamentals in center spectrum.</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">TREBLE (2000–9000 Hz)</span>
                <span className="spec-desc">Upper air & overtone partials stacked at the apex.</span>
              </div>
            </div>
          </div>

          <div className="tech-card">
            <div className="tech-card-header">
              <Radio className="inline-icon" />
              <span>03 / PULSAR CP 1919 HISTOGRAM</span>
            </div>
            <p>
              Peter Saville&apos;s 1979 cover for Joy Division&apos;s <em>Unknown Pleasures</em> acted as the inspiration for this deep dive and ultimate website. He transposed signal pulse data recorded from <strong>Pulsar CP 1919</strong> (the first radio pulsar discovered by Jocelyn Bell Burnell in 1967).
            </p>
            <p className="secondary-note">
              This engine plots continuous 1 to 3 second spectral ridgeline slices. Enabling the <strong>Combined Wave Sum</strong> reveals how stacked partials recombine into the master acoustic waveform.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <a
            href="https://github.com/Azteriisk/UnknownFouriers"
            target="_blank"
            rel="noopener noreferrer"
            className="github-repo-link"
            title="Explore source code and Fourier mathematics documentation on GitHub"
          >
            <ExternalLink className="tiny-icon" /> View Source & Fourier Research →
          </a>

          <button className="primary-modal-btn" onClick={onClose}>
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
