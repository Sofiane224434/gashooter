export default function CreditsModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-6 sm:p-8 text-zinc-100 shadow-2xl text-center">
                <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider mb-6">
                    Crédits
                </h2>

                <div className="space-y-4 text-sm text-zinc-300">
                    <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">
                            Développement & Conception
                        </div>
                        <div className="font-bold text-base text-white">Sofiane Kherarfa</div>
                    </div>

                    <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">
                            Projet & Infrastructure
                        </div>
                        <div className="font-semibold text-zinc-200">Gashooter • AZIM404</div>
                    </div>

                    <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">
                            Technologies
                        </div>
                        <div className="text-xs text-zinc-400">
                            React, Vite, Node.js, Docker, Nginx
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold rounded text-sm transition"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}
