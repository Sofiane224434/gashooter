import { sound } from '../../services/sound.js';

export default function LeaderboardModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const scores = [
        { rank: 1, name: 'NOVA_VIPER', score: '1,450,200', wave: 'Vague 48', badge: '👑 LÉGENDE' },
        { rank: 2, name: 'CYBER_KHERARFA', score: '1,280,950', wave: 'Vague 42', badge: '🥈 MAÎTRE' },
        { rank: 3, name: 'AZIM_404', score: '994,100', wave: 'Vague 35', badge: '🥉 ÉLITE' },
        { rank: 4, name: 'GAS_DESTROYER', score: '840,300', wave: 'Vague 29', badge: 'DIAMANT' },
        { rank: 5, name: 'NEBULA_PILOT', score: '720,000', wave: 'Vague 25', badge: 'PLATINE' },
        { rank: 6, name: 'STAR_STRIKER', score: '610,500', wave: 'Vague 21', badge: 'OR' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-3xl bg-slate-950/95 border-2 border-amber-500/60 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-white">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-400 font-mono">
                            // CLASSEMENT GALACTIQUE
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

                <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase">
                                <th className="pb-3">RANG</th>
                                <th className="pb-3">PILOTE</th>
                                <th className="pb-3">SCORE</th>
                                <th className="pb-3">PERFORMANCE</th>
                                <th className="pb-3 text-right">DISTINCTION</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {scores.map((s) => (
                                <tr key={s.rank} className="hover:bg-amber-500/10 transition-colors">
                                    <td className="py-3 font-bold text-amber-400">
                                        #{s.rank}
                                    </td>
                                    <td className="py-3 font-bold text-white flex items-center gap-2">
                                        {s.name}
                                    </td>
                                    <td className="py-3 text-emerald-400 font-bold">
                                        {s.score} PTS
                                    </td>
                                    <td className="py-3 text-gray-300">
                                        {s.wave}
                                    </td>
                                    <td className="py-3 text-right">
                                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            {s.badge}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs font-mono text-gray-400">
                    Saison 1 en cours • Réinitialisation du classement dans 14 jours
                </div>
            </div>
        </div>
    );
}
