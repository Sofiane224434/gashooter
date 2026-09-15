export default function CreditsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-md bg-slate-950/95 border border-cyan-500/40 rounded-2xl p-6 sm:p-8 text-zinc-100 shadow-[0_0_40px_rgba(6,182,212,0.2)] text-center">
                {/* Crochets d'angle HUD */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-xl"></div>
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-xl"></div>
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-2 border-l-2 border-cyan-400 rounded-bl-xl"></div>
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-2 border-r-2 border-cyan-400 rounded-br-xl"></div>

                <h2 className="font-orbitron text-xl sm:text-2xl font-bold uppercase tracking-wider text-cyan-300 mb-6">
                    Crédits
                </h2>

                <div className="space-y-4 text-base text-zinc-300">
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div className="text-xs text-cyan-400 uppercase tracking-widest font-bold mb-1">
                            Développement & Conception
                        </div>
                        <div className="font-extrabold text-lg text-white font-orbitron">Sofiane Kherarfa</div>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div className="text-xs text-cyan-400 uppercase tracking-widest font-bold mb-1">
                            Projet & Infrastructure
                        </div>
                        <div className="font-bold text-base text-zinc-200">Gashooter • AZIM404</div>
                    </div>

                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                        <div className="text-xs text-cyan-400 uppercase tracking-widest font-bold mb-1">
                            Technologies & Moteur
                        </div>
                        <div className="text-sm text-slate-400 font-sans">
                            React, Three.js, WebGL, Vite, Node.js, WebSocket
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm uppercase tracking-wider transition shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}
