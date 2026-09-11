import { useState } from 'react';
import { sound } from '../../services/sound.js';

export default function SettingsModal({ isOpen, onClose, crtEnabled, onToggleCrt }) {
    const [volume, setVolume] = useState(40);
    const [muted, setMuted] = useState(false);
    const [bgmActive, setBgmActive] = useState(false);

    if (!isOpen) return null;

    const handleVolumeChange = (e) => {
        const val = Number(e.target.value);
        setVolume(val);
        sound.setVolume(val / 100);
    };

    const toggleMute = () => {
        const next = !muted;
        setMuted(next);
        sound.setMuted(next);
    };

    const toggleBgm = () => {
        const active = sound.toggleBgm();
        setBgmActive(active);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-2xl bg-slate-950/95 border-2 border-emerald-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-emerald-400 font-mono">
                            // CONFIGURATION SYSTÈME
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

                <div className="space-y-6">
                    {/* Audio section */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-mono text-emerald-300 font-bold uppercase mb-4">
                            🔊 Audio & Synthétiseur Rétro
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-mono text-gray-300 mb-2">
                                    <span>VOLUME GLOBAL DES BRUITAGES</span>
                                    <span className="text-emerald-400 font-bold">{volume}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-full accent-emerald-400 cursor-pointer"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                <button
                                    onClick={toggleMute}
                                    onMouseEnter={() => sound.playHover()}
                                    className={`px-4 py-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                                        muted
                                            ? 'bg-red-500/20 border-red-400 text-red-300'
                                            : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                    }`}
                                >
                                    {muted ? '🔇 AUDIO COUPÉ' : '🔊 AUDIO ACTIF'}
                                </button>

                                <button
                                    onClick={toggleBgm}
                                    onMouseEnter={() => sound.playHover()}
                                    className={`px-4 py-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                                        bgmActive
                                            ? 'bg-purple-500/30 border-purple-400 text-purple-200 animate-pulse'
                                            : 'bg-slate-800 border-white/20 text-gray-300 hover:text-white'
                                    }`}
                                >
                                    {bgmActive ? '🎵 SYNTH-WAVE : ACTIF' : '🎵 SYNTH-WAVE : EN PAUSE'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Affichage & Effets */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-mono text-emerald-300 font-bold uppercase mb-3">
                            🖥️ Graphismes & Affichage Rétro
                        </h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold font-mono">Filtre Écran CRT / Scanlines</div>
                                <div className="text-xs text-gray-400">Ajoute les lignes de balayage et le grain des bornes d'arcade</div>
                            </div>
                            <button
                                onClick={() => {
                                    sound.playSelect();
                                    onToggleCrt();
                                }}
                                onMouseEnter={() => sound.playHover()}
                                className={`px-4 py-2 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                                    crtEnabled
                                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                                        : 'bg-slate-800 border-white/20 text-gray-400'
                                }`}
                            >
                                {crtEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                            </button>
                        </div>
                    </div>

                    {/* Contrôles */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                        <h3 className="text-sm font-mono text-emerald-300 font-bold uppercase mb-3">
                            🎮 Configuration des Touches
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs text-center">
                            <div className="p-2 bg-slate-950 rounded border border-white/10">
                                <span className="text-emerald-400 block font-bold text-sm">Z / ↑</span>
                                <span className="text-gray-400">Avancer</span>
                            </div>
                            <div className="p-2 bg-slate-950 rounded border border-white/10">
                                <span className="text-emerald-400 block font-bold text-sm">Q / S / D</span>
                                <span className="text-gray-400">Esquive</span>
                            </div>
                            <div className="p-2 bg-slate-950 rounded border border-white/10">
                                <span className="text-emerald-400 block font-bold text-sm">ESPACE</span>
                                <span className="text-gray-400">Tir Principal</span>
                            </div>
                            <div className="p-2 bg-slate-950 rounded border border-white/10">
                                <span className="text-emerald-400 block font-bold text-sm">SHIFT</span>
                                <span className="text-gray-400">Bombe à Gaz</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
