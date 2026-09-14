// Moteur sonore haute-fidélité pour armes à feu, interfaces et impacts
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.volume = 0.5;
        this.noiseBuffer = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
                this._createNoiseBuffer();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    _createNoiseBuffer() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
    }

    setMuted(muted) {
        this.muted = muted;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    // SON D'ARME À FEU RÉALISTE (Multi-couches : Détonation + Basse + Mécanique + Reverb)
    playGunshot() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            // 1. Couche Détonation Explosive (Noise Burst filtré passe-bas rapide)
            if (this.noiseBuffer) {
                const noiseSrc = this.ctx.createBufferSource();
                noiseSrc.buffer = this.noiseBuffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(4500, now);
                filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);

                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(this.volume * 0.8, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                noiseSrc.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(this.ctx.destination);

                noiseSrc.start(now);
                noiseSrc.stop(now + 0.18);
            }

            // 2. Couche Déflagration Sourde / Basse Fréquence (Punch au thorax)
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(140, now);
            subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.22);

            subGain.gain.setValueAtTime(this.volume * 0.9, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);

            subOsc.start(now);
            subOsc.stop(now + 0.25);

            // 3. Couche Métallique (Culasse / Percuteur)
            const metalOsc = this.ctx.createOscillator();
            const metalGain = this.ctx.createGain();
            metalOsc.type = 'sawtooth';
            metalOsc.frequency.setValueAtTime(950, now);
            metalOsc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

            metalGain.gain.setValueAtTime(this.volume * 0.35, now);
            metalGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            metalOsc.connect(metalGain);
            metalGain.connect(this.ctx.destination);

            metalOsc.start(now);
            metalOsc.stop(now + 0.04);
        } catch (e) {}
    }

    // SON D'IMPACT / HITMARKER SATISFAISANT (Tink métallique net)
    playHitmarker() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1600, now);
            osc.frequency.setValueAtTime(2200, now + 0.02);

            gain.gain.setValueAtTime(this.volume * 0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.08);
        } catch (e) {}
    }

    // Son de survol de bouton
    playHover() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(580, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

            gain.gain.setValueAtTime(this.volume * 0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (e) {}
    }

    // Son de sélection
    playSelect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1);

            gain.gain.setValueAtTime(this.volume * 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }

    // Son de retour
    playBack() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

            gain.gain.setValueAtTime(this.volume * 0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {}
    }
}

export const sound = new SoundEngine();
