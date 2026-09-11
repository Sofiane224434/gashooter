// Moteur sonore synthétique via Web Audio API (aucun fichier externe requis)
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.volume = 0.4;
        this.musicPlaying = false;
        this.musicInterval = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMuted(muted) {
        this.muted = muted;
        if (muted && this.musicPlaying) {
            this.stopBgm();
        }
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
    }

    // Son de survol de bouton (bip futuriste doux)
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
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

            gain.gain.setValueAtTime(this.volume * 0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        } catch (e) {}
    }

    // Son de sélection / validation (laser d'arcade percutant)
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
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);

            gain.gain.setValueAtTime(this.volume * 0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.15);
        } catch (e) {}
    }

    // Son de retour / fermeture
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
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

            gain.gain.setValueAtTime(this.volume * 0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }

    // Lancement de partie (effet warp/laser puissant)
    playLaunch() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;
            
            // Oscillateur 1 (Laser descendant rapide)
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(1200, now);
            osc1.frequency.exponentialRampToValueAtTime(150, now + 0.4);
            gain1.gain.setValueAtTime(this.volume * 0.4, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);

            // Oscillateur 2 (Impact basse fréquence)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(160, now + 0.1);
            osc2.frequency.exponentialRampToValueAtTime(40, now + 0.6);
            gain2.gain.setValueAtTime(this.volume * 0.5, now + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);
            osc2.start(now + 0.1);
            osc2.stop(now + 0.6);
        } catch (e) {}
    }

    // Musique d'ambiance synthwave générative rétro
    toggleBgm() {
        if (this.musicPlaying) {
            this.stopBgm();
            return false;
        } else {
            this.startBgm();
            return true;
        }
    }

    startBgm() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        this.musicPlaying = true;

        const bassline = [110, 110, 130.81, 146.83, 110, 110, 98, 123.47];
        let step = 0;

        this.musicInterval = setInterval(() => {
            if (!this.musicPlaying || this.muted) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                const freq = bassline[step % bassline.length];
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(this.volume * 0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.22);

                step++;
            } catch (e) {}
        }, 220);
    }

    stopBgm() {
        this.musicPlaying = false;
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

export const sound = new SoundEngine();
