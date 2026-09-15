import { useState, useEffect } from 'react';
import { sound } from '../../services/sound.js';

export default function MissionLaunchModal({ isOpen, onClose, mode }) {
    const [status, setStatus] = useState('briefing'); // 'briefing', 'countdown', 'active'
    const [countdown, setCountdown] = useState(3);
    const [score, setScore] = useState(0);
    const [enemiesDefeated, setEnemiesDefeated] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setStatus('briefing');
            setCountdown(3);
            setScore(0);
            setEnemiesDefeated(0);
            return;
        }
    }, [isOpen]);

    const handleStartLaunch = () => {
        sound.playLaunch();
        setStatus('countdown');
        let count = 3;
        const timer = setInterval(() => {
            count--;
            if (count > 0) {
                sound.playHover();
                setCountdown(count);
            } else {
                clearInterval(timer);
                setStatus('active');
                sound.playSelect();
            }
        }, 800);
    };

    const handleShoot = () => {
        sound.playSelect();
        setScore((prev) => prev + 250);
        setEnemiesDefeated((prev) => prev + 1);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hud-scanlines p-6 sm:p-10 shadow-[0_0_60px_rgba(6,182,212,0.25)] text-white text-center">
                {/* Crochets d'angle HUD */}
                <div className="absolute -top-[2px] -left-[2px] w-7 h-7 border-t-2 border-l-2 border-cyan-400 rounded-tl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -top-[2px] -right-[2px] w-7 h-7 border-t-2 border-r-2 border-cyan-400 rounded-tr-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -left-[2px] w-7 h-7 border-b-2 border-l-2 border-cyan-400 rounded-bl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -right-[2px] w-7 h-7 border-b-2 border-r-2 border-cyan-400 rounded-br-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-32 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee]"></div>

                {status === 'briefing' && (
                    <div className="space-y-6">
                        <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-400/40 rounded-full text-xs font-bold text-cyan-300 animate-pulse tracking-wider">
                            MISSION PRÊTE AU DÉPLOIEMENT
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black font-orbitron tracking-wider text-cyan-300 uppercase">
                            SECTEUR : {mode ? mode.toUpperCase() : 'CAMPAGNE 01'}
                        </h2>
                        <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto font-sans">
                            Les scanners longue portée ont détecté une escadre en approche. Vos propulseurs sont chargés et vos armes sont prêtes.
                        </p>
                        
                        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                            <button
                                onClick={handleStartLaunch}
                                onMouseEnter={() => sound.playHover()}
                                className="px-8 py-3.5 border-2 border-cyan-400 bg-gradient-to-r from-cyan-950/90 via-cyan-900/60 to-slate-900 text-white font-bold text-lg rounded-xl transition-all btn-glow-cyan transform hover:scale-105 cursor-pointer uppercase tracking-wider"
                            >
                                ENGAGER LE COMBAT [START]
                            </button>
                            <button
                                onClick={() => {
                                    sound.playBack();
                                    onClose();
                                }}
                                onMouseEnter={() => sound.playHover()}
                                className="px-6 py-3.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white rounded-xl font-bold uppercase tracking-wider cursor-pointer"
                            >
                                ANNULER
                            </button>
                        </div>
                    </div>
                )}

                {status === 'countdown' && (
                    <div className="py-12 space-y-4">
                        <div className="text-xs text-cyan-400 tracking-widest uppercase font-bold">
                            Initialisation des propulseurs
                        </div>
                        <div className="text-8xl font-black font-orbitron text-cyan-300 animate-ping">
                            {countdown}
                        </div>
                        <div className="text-sm text-slate-400 font-sans">
                            PRÉPAREZ-VOUS AU COMBAT...
                        </div>
                    </div>
                )}

                {status === 'active' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
                            <div className="text-left">
                                <span className="text-xs text-slate-400 block font-bold">SCORE TOTAL</span>
                                <span className="text-2xl font-black text-cyan-300 font-orbitron">{score} PTS</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-400 block font-bold">ENNEMIS DÉTRUITS</span>
                                <span className="text-2xl font-black text-emerald-400 font-orbitron">{enemiesDefeated} 💥</span>
                            </div>
                        </div>

                        {/* Interactive Combat Minigame */}
                        <div className="relative h-64 bg-slate-950/60 border-2 border-dashed border-cyan-500/40 rounded-2xl flex flex-col items-center justify-center p-4 overflow-hidden">
                            <div className="text-6xl animate-bounce mb-4">👾</div>
                            <div className="text-sm text-cyan-300 font-bold mb-3 uppercase tracking-wider">
                                CIBLE ENNEMIE VERROUILLÉE !
                            </div>
                            <button
                                onClick={handleShoot}
                                onMouseEnter={() => sound.playHover()}
                                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(239,68,68,0.5)] transform active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                            >
                                🔥 TIRER (CANON PLASMA)
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                        >
                            Terminer la Session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
