export default function SettingsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-lg bg-slate-950/95 border border-cyan-500/40 rounded-2xl p-6 sm:p-8 text-zinc-100 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                {/* Crochets d'angle HUD */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-xl"></div>
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-xl"></div>
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-2 border-l-2 border-cyan-400 rounded-bl-xl"></div>
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-2 border-r-2 border-cyan-400 rounded-br-xl"></div>

                {/* En-tête */}
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4 mb-6">
                    <h2 className="font-orbitron text-xl sm:text-2xl font-bold tracking-wider uppercase text-cyan-300">
                        Options
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-cyan-300 text-sm font-semibold px-3 py-1 rounded transition border border-transparent hover:border-cyan-500/30 cursor-pointer"
                    >
                        ✕ Fermer
                    </button>
                </div>

                {/* Contenu */}
                <div className="space-y-5 text-base">
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                        <div>
                            <div className="font-bold text-slate-200 text-lg">Mode Plein Écran</div>
                            <div className="text-xs text-slate-400 font-sans">Basculer l'affichage en plein écran</div>
                        </div>
                        <button
                            onClick={toggleFullscreen}
                            className="px-4 py-2 bg-slate-900 hover:bg-cyan-950/60 border border-cyan-500/40 hover:border-cyan-400 rounded-lg text-xs font-bold uppercase tracking-wider text-cyan-300 transition cursor-pointer"
                        >
                            Basculer
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                        <div>
                            <div className="font-bold text-slate-200 text-lg">Langue</div>
                            <div className="text-xs text-slate-400 font-sans">Langue de l'interface</div>
                        </div>
                        <span className="text-xs font-bold px-3 py-1.5 bg-slate-900 rounded-md border border-cyan-500/30 text-cyan-300">
                            Français (FR)
                        </span>
                    </div>

                    <div className="py-2">
                        <div className="font-bold text-slate-200 text-lg mb-2">Contrôles clavier</div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                                <span className="text-slate-400">Déplacement :</span>
                                <strong className="text-cyan-300 font-bold">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                                <span className="text-slate-400">Action / Tir :</span>
                                <strong className="text-cyan-300 font-bold">Espace / Clic Gauche</strong>
                            </div>
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                                <span className="text-slate-400">Glissade tactique :</span>
                                <strong className="text-cyan-300 font-bold">C ou Ctrl</strong>
                            </div>
                            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex justify-between">
                                <span className="text-slate-400">Saut / Escalade :</span>
                                <strong className="text-cyan-300 font-bold">Espace</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bouton bas */}
                <div className="mt-8 text-right">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm uppercase tracking-wider transition shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                    >
                        Retour au menu
                    </button>
                </div>
            </div>
        </div>
    );
}
