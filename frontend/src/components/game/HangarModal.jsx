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
            color: 'emerald'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-4xl bg-slate-950/95 border-2 border-cyan-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.3)] text-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-cyan-400 font-mono">
                            // HANGAR & ARSENAL
                        </h2>
                    </div>
                    <button
                        onClick={() => {
                            sound.playBack();
                            onClose();
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 rounded-lg text-sm font-mono transition-all cursor-pointer"
                    >
                        FERMER [ESC]
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Ship Selection List */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-mono text-cyan-300 uppercase tracking-wider mb-2">
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
                                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                    selectedShipIndex === idx
                                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                        : 'bg-slate-900/60 border-white/10 text-gray-400 hover:border-cyan-500/40 hover:text-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{s.icon}</span>
                                    <div>
                                        <div className="text-sm font-bold font-mono">{s.name.split(' ')[0]}</div>
                                        <div className="text-xs opacity-70">{s.class}</div>
                                    </div>
                                </div>
                                {selectedShipIndex === idx && (
                                    <span className="text-xs font-mono text-cyan-400 font-bold">ACTIF</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Ship Viewer & Stats */}
                    <div className="md:col-span-2 bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                        {current.class}
                                    </span>
                                    <h3 className="text-2xl font-black font-mono text-white mt-1">
                                        {current.name}
                                    </h3>
                                </div>
                                <div className="text-5xl animate-bounce">{current.icon}</div>
                            </div>
                            <p className="text-sm text-gray-300 mb-6">{current.desc}</p>

                            {/* Stat Bars */}
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                                        <span>VITESSE D'ESQUIVE</span>
                                        <span className="text-cyan-400 font-bold">{current.speed}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${current.speed}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                                        <span>PUISSANCE DE FEU (DPS)</span>
                                        <span className="text-emerald-400 font-bold">{current.damage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${current.damage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-xs font-mono text-gray-300 mb-1">
                                        <span>CAPACITÉ DU BOUCLIER</span>
                                        <span className="text-purple-400 font-bold">{current.shield}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-purple-400 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${current.shield}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Special Weapon & Action */}
                        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                            <div className="text-xs font-mono">
                                <span className="text-gray-400">Arme Spéciale : </span>
                                <span className="text-emerald-400 font-bold">{current.special}</span>
                            </div>
                            <button
                                onMouseEnter={() => sound.playHover()}
                                onClick={() => {
                                    sound.playLaunch();
                                    onClose();
                                }}
                                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-mono font-black rounded-lg hover:opacity-90 transition-all cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                            >
                                ÉQUIPER CE VAISSEAU
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
