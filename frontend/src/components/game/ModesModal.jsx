import { sound } from '../../services/sound.js';

export default function ModesModal({ isOpen, onClose, onSelectMode }) {
    if (!isOpen) return null;

    const modes = [
        {
            id: 'campaign',
            name: 'CAMPAGNE GALACTIQUE',
            desc: '12 missions scénarisées à travers les nébuleuses toxiques pour anéantir le Syndicat du Gaz.',
            difficulty: 'Normal',
            reward: '+1000 XP',
            badge: 'HISTOIRE',
            color: 'from-emerald-500/20 to-green-600/30 border-emerald-500/50 hover:border-emerald-400'
        },
        {
            id: 'survival',
            name: 'SURVIE INFINIE',
            desc: 'Affrontez des vagues incessantes de chasseurs ennemis. Jusqu’où tiendront vos boucliers ?',
            difficulty: 'Difficile',
            reward: 'Multiplicateur x2',
            badge: 'ARCADE',
            color: 'from-cyan-500/20 to-blue-600/30 border-cyan-500/50 hover:border-cyan-400'
        },
        {
            id: 'boss_rush',
            name: 'BOSS RUSH',
            desc: 'Enchaînez sans répit les 5 Léviathans interstellaires lourdement blindés.',
            difficulty: 'Extrême',
            reward: 'Vaisseau Légendaire',
            badge: 'DÉFI',
            color: 'from-purple-500/20 to-pink-600/30 border-purple-500/50 hover:border-purple-400'
        },
        {
            id: 'pvp',
            name: 'ARÈNE MULTIJOUEUR',
            desc: 'Duels en temps réel à grande vitesse en 1v1 ou 2v2 dans des champs d’astéroïdes.',
            difficulty: 'Compétitif',
            reward: 'Rang Galactique',
            badge: 'BÊTA',
            color: 'from-amber-500/20 to-orange-600/30 border-amber-500/50 hover:border-amber-400'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-4xl bg-slate-950/90 border-2 border-emerald-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-white overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-emerald-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-emerald-400 font-mono">
                            // SÉLECTION DU MODE
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

                {/* Grid of modes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modes.map((mode) => (
                        <div
                            key={mode.id}
                            onMouseEnter={() => sound.playHover()}
                            onClick={() => {
                                sound.playLaunch();
                                onSelectMode(mode.id);
                            }}
                            className={`group relative p-5 rounded-xl border bg-gradient-to-br ${mode.color} transition-all duration-300 hover:scale-[1.02] cursor-pointer hover:shadow-[0_0_25px_rgba(57,255,20,0.25)] flex flex-col justify-between`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                                        {mode.badge}
                                    </span>
                                    <span className="text-xs font-mono text-gray-400">
                                        Difficulté: <span className="text-white font-bold">{mode.difficulty}</span>
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold font-mono tracking-wide text-white group-hover:text-emerald-300 transition-colors">
                                    {mode.name}
                                </h3>
                                <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                                    {mode.desc}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                <span className="text-xs font-mono text-emerald-400">
                                    Récompense : {mode.reward}
                                </span>
                                <span className="text-sm font-mono text-emerald-300 font-bold group-hover:translate-x-1 transition-transform">
                                    DÉPLOYER →
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
