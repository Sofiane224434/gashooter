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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl p-6 sm:p-8 text-zinc-100 shadow-2xl">
                {/* En-tête */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-wide uppercase">
                        Options
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-400 hover:text-white text-sm font-semibold px-2 py-1 rounded transition"
                    >
                        ✕ Fermer
                    </button>
                </div>

                {/* Contenu */}
                <div className="space-y-5 text-sm">
                    <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                        <div>
                            <div className="font-semibold text-zinc-200">Mode Plein Écran</div>
                            <div className="text-xs text-zinc-400">Basculer l'affichage en plein écran</div>
                        </div>
                        <button
                            onClick={toggleFullscreen}
                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-xs font-semibold uppercase tracking-wider transition"
                        >
                            Basculer
                        </button>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                        <div>
                            <div className="font-semibold text-zinc-200">Langue</div>
                            <div className="text-xs text-zinc-400">Langue de l'interface</div>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1.5 bg-zinc-800 rounded border border-zinc-700">
                            Français (FR)
                        </span>
                    </div>

                    <div className="py-2">
                        <div className="font-semibold text-zinc-200 mb-2">Contrôles clavier</div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                            <div className="bg-zinc-800/60 p-2.5 rounded border border-zinc-800 flex justify-between">
                                <span>Déplacement :</span>
                                <strong className="text-zinc-200">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="bg-zinc-800/60 p-2.5 rounded border border-zinc-800 flex justify-between">
                                <span>Action / Tir :</span>
                                <strong className="text-zinc-200">Espace</strong>
                            </div>
                            <div className="bg-zinc-800/60 p-2.5 rounded border border-zinc-800 flex justify-between">
                                <span>Menu / Pause :</span>
                                <strong className="text-zinc-200">Échap</strong>
                            </div>
                            <div className="bg-zinc-800/60 p-2.5 rounded border border-zinc-800 flex justify-between">
                                <span>Valider :</span>
                                <strong className="text-zinc-200">Entrée</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bouton bas */}
                <div className="mt-8 text-right">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded text-sm transition"
                    >
                        Retour au menu
                    </button>
                </div>
            </div>
        </div>
    );
}
