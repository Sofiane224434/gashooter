import { sound } from '../../services/sound.js';

export default function CreditsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-xl bg-slate-950/95 border-2 border-purple-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(168,85,247,0.3)] text-white text-center">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-purple-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></span>
                        <h2 className="text-2xl font-black tracking-wider text-purple-400 font-mono">
                            // CRÉDITS & ÉQUIPE
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

                <div className="space-y-4 font-mono text-sm">
                    <div className="p-4 bg-slate-900/80 rounded-xl border border-white/10">
                        <div className="text-xs text-purple-300 font-bold uppercase mb-1">CONCEPTION & DÉVELOPPEMENT</div>
                        <div className="text-lg font-black text-white">Sofiane Kherarfa</div>
                        <div className="text-xs text-gray-400">Architecture Fullstack & Game Design</div>
                    </div>

                    <div className="p-4 bg-slate-900/80 rounded-xl border border-white/10">
                        <div className="text-xs text-cyan-300 font-bold uppercase mb-1">PLATEFORME & PRODUCTION</div>
                        <div className="text-lg font-black text-white">AZIM404</div>
                        <div className="text-xs text-gray-400">Infrastructure Cloud, Reverse Proxy & Sécurité HTTPS</div>
                    </div>

                    <div className="p-4 bg-slate-900/80 rounded-xl border border-white/10">
                        <div className="text-xs text-emerald-300 font-bold uppercase mb-1">MOTEUR AUDIO & GRAPHIQUE</div>
                        <div className="text-base font-bold text-white">Web Audio Synth & HTML5 Canvas Parallax</div>
                    </div>
                </div>

                <div className="mt-6 text-xs font-mono text-gray-400">
                    © 2026 GASHOOTER • Tous droits réservés.
                </div>
            </div>
        </div>
    );
}
