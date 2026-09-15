import { useState } from 'react';
import { sound } from '../../services/sound.js';

export default function HangarModal({ isOpen, onClose }) {
    const [selectedShipIndex, setSelectedShipIndex] = useState(0);

    if (!isOpen) return null;

    const ships = [
        {
            name: 'VIPER-GS1 « PROTO-TOXIC »',
            class: 'Intercepteur Léger',
            speed: 92,
            damage: 75,
            shield: 60,
            special: 'Nuage Corrosif V1',
            desc: 'Chasseur rapide et maniable équipé de propulseurs à injection de plasma vert.',
            icon: '🚀',
            color: 'cyan'
        },
        {
            name: 'TITAN-GX « OBLIVION »',
            class: 'Cuirassé Lourd',
            speed: 55,
            damage: 98,
            shield: 95,
            special: 'Rayon Gravitationnel',
            desc: 'Forteresse volante capable de résister aux tempêtes stellaires et de détruire des météores massifs.',
            icon: '🛸',
            color: 'cyan'
        },
        {
            name: 'SPECTRE-VX « NEBULA »',
            class: 'Furtif Tactique',
            speed: 85,
            damage: 88,
            shield: 70,
            special: 'Camouflage Toxique',
            desc: 'Équipé de boucliers de diffraction optique pour surprendre les convois ennemis.',
            icon: '⚡',
            color: 'purple'
        }
    ];

    const current = ships[selectedShipIndex];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hud-scanlines p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-white">
                {/* Crochets d'angle HUD */}
                <div className="absolute -top-[2px] -left-[2px] w-7 h-7 border-t-2 border-l-2 border-cyan-400 rounded-tl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -top-[2px] -right-[2px] w-7 h-7 border-t-2 border-r-2 border-cyan-400 rounded-tr-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -left-[2px] w-7 h-7 border-b-2 border-l-2 border-cyan-400 rounded-bl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -right-[2px] w-7 h-7 border-b-2 border-r-2 border-cyan-400 rounded-br-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-32 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee]"></div>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-cyan-300 font-orbitron uppercase">
                            Hangar & Arsenal
                        </h2>
                    </div>
                    <button
                        onClick={() => {
                            sound.playBack();
                            onClose();
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="px-4 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer"
                    >
                        FERMER [ÉCHAP]
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Ship Selection List */}
                    <div className="space-y-3">
                        <h3 className="text-xs text-cyan-300 uppercase font-bold tracking-wider mb-2">
                            Flotte disponible
                        </h3>
                        {ships.map((s, idx) => (
                            <button
                                key={s.name}
                                onMouseEnter={() => sound.playHover()}
                                onClick={() => {
                                    sound.playSelect();
                                    setSelectedShipIndex(idx);
                                }}
                                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedShipIndex === idx
                                        ? 'bg-gradient-to-r from-cyan-950/80 to-slate-900 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                        : 'bg-slate-950/50 border-white/10 text-slate-400 hover:border-cyan-500/40 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{s.icon}</span>
                                    <div>
                                        <div className="text-sm font-bold font-orbitron">{s.name.split(' ')[0]}</div>
                                        <div className="text-xs text-slate-400">{s.class}</div>
                                    </div>
                                </div>
                                {selectedShipIndex === idx && (
                                    <span className="text-xs text-cyan-400 font-bold">ACTIF</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Ship Details Card */}
                    <div className="md:col-span-2 bg-slate-950/60 border border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold uppercase tracking-wider">
                                        {current.class}
                                    </span>
                                    <h3 className="text-2xl font-black font-orbitron tracking-wider text-white mt-2">
                                        {current.name}
                                    </h3>
                                </div>
                                <span className="text-5xl">{current.icon}</span>
                            </div>

                            <p className="text-sm text-slate-300 mb-6 font-sans">
                                {current.desc}
                            </p>

                            {/* Stats */}
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                                        <span className="text-slate-400">Vitesse :</span>
                                        <span className="text-cyan-400 font-bold">{current.speed}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" style={{ width: `${current.speed}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                                        <span className="text-slate-400">Puissance de Feu :</span>
                                        <span className="text-cyan-400 font-bold">{current.damage}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" style={{ width: `${current.damage}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                                        <span className="text-slate-400">Bouclier :</span>
                                        <span className="text-cyan-400 font-bold">{current.shield}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" style={{ width: `${current.shield}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 border-2 border-cyan-400 bg-gradient-to-r from-cyan-950/90 via-cyan-900/60 to-slate-900 text-white font-bold rounded-xl text-sm uppercase tracking-wider transition btn-glow-cyan cursor-pointer"
                            >
                                Équiper et Déployer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
