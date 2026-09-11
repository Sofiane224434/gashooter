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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-fadeIn">
            <div className="relative w-full max-w-3xl bg-slate-950/95 border-2 border-emerald-500/80 rounded-2xl p-6 sm:p-10 shadow-[0_0_60px_rgba(16,185,129,0.4)] text-white text-center">
                {status === 'briefing' && (
                    <div className="space-y-6">
                        <div className="inline-block px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-xs font-mono text-emerald-300 animate-pulse">
                            MISSION PRÊTE AU DÉPLOIEMENT
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-emerald-400">
                            SECTEUR : {mode ? mode.toUpperCase() : 'CAMPAGNE 01'}
                        </h2>
                        <p className="text-gray-300 text-sm sm:text-base max-w-lg mx-auto">
                            Les scanners longue portée ont détecté une escadre de croiseurs toxiques en approche. Vos propulseurs sont chargés et les canons à plasma sont armés.
                        </p>
                        
                        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
                            <button
                                onClick={handleStartLaunch}
                                onMouseEnter={() => sound.playHover()}
                                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-slate-950 font-black font-mono text-lg rounded-xl shadow-[0_0_30px_rgba(57,255,20,0.5)] transition-all transform hover:scale-105 cursor-pointer"
                            >
                                ENGAGER LE COMBAT [START]
                            </button>
                            <button
                                onClick={() => {
                                    sound.playBack();
                                    onClose();
                                }}
                                onMouseEnter={() => sound.playHover()}
                                className="px-6 py-3 bg-slate-900 border border-white/20 text-gray-300 hover:text-white font-mono rounded-xl cursor-pointer"
                            >
                                ANNULER
                            </button>
                        </div>
                    </div>
                )}

                {status === 'countdown' && (
                    <div className="py-12 space-y-4">
                        <div className="text-xs font-mono text-emerald-400 tracking-widest uppercase">
                            Initialisation des propulseurs
                        </div>
                        <div className="text-8xl font-black font-mono text-emerald-400 animate-ping">
                            {countdown}
                        </div>
                        <div className="text-sm font-mono text-gray-400">
                            PRÉPAREZ-VOUS AU COMBAT...
                        </div>
                    </div>
                )}

                {status === 'active' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                            <div className="text-left font-mono">
                                <span className="text-xs text-gray-400 block">SCORE TOTAL</span>
                                <span className="text-2xl font-black text-emerald-400">{score} PTS</span>
                            </div>
                            <div className="text-right font-mono">
                                <span className="text-xs text-gray-400 block">ENNEMIS DÉTRUITS</span>
                                <span className="text-2xl font-black text-cyan-400">{enemiesDefeated} 💥</span>
                            </div>
                        </div>

                        {/* Interactive Combat Minigame */}
                        <div className="relative h-64 bg-slate-900/90 border-2 border-dashed border-emerald-500/40 rounded-xl flex flex-col items-center justify-center p-4 overflow-hidden">
                            <div className="text-6xl animate-bounce mb-4">👾</div>
                            <div className="text-sm font-mono text-emerald-300 font-bold mb-3">
                                CIBLE ENNEMIE VERROUILLÉE !
                            </div>
                            <button
                                onClick={handleShoot}
                                onMouseEnter={() => sound.playHover()}
                                className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-black font-mono rounded-lg shadow-[0_0_25px_rgba(239,68,68,0.5)] transform active:scale-95 transition-all cursor-pointer"
                            >
                                🔥 TIRER (CANON PLASMA)
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => {
                                    sound.playBack();
                                    onClose();
                                }}
                                onMouseEnter={() => sound.playHover()}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 font-mono text-sm rounded-lg cursor-pointer"
                            >
                                QUITTER LA MISSION
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
