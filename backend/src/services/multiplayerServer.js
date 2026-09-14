import { WebSocketServer, WebSocket } from 'ws';

// Gestionnaire de Salons Multijoueur Temps Réel (Jusqu'à 4 joueurs par salon)
export function setupMultiplayerServer(httpServer) {
    const wss = new WebSocketServer({ noServer: true });

    // Salons actifs : Map<roomId, Room>
    const rooms = new Map();

    const COLORS = [
        { name: 'Cyan', hex: 0x06b6d4, spawn: [0, 1.7, 22] },
        { name: 'Rouge', hex: 0xdc2626, spawn: [-18, 1.7, -15] },
        { name: 'Violet', hex: 0x9333ea, spawn: [18, 1.7, -15] },
        { name: 'Ambre', hex: 0xd97706, spawn: [0, 1.7, -22] }
    ];

    function getOrCreateRoom(roomId = 'global_arena') {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                id: roomId,
                players: new Map(), // playerId -> playerObj
                maxPlayers: 4
            });
        }
        return rooms.get(roomId);
    }

    function broadcastToRoom(room, message, excludeSocket = null) {
        const payload = JSON.stringify(message);
        for (const player of room.players.values()) {
            if (player.ws !== excludeSocket && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(payload);
            }
        }
    }

    httpServer.on('upgrade', (request, socket, head) => {
        const { pathname } = new URL(request.url, `http://${request.headers.host}`);
        if (pathname === '/api/ws' || pathname === '/ws') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    wss.on('connection', (ws) => {
        let currentRoom = null;
        let currentPlayerId = null;

        ws.on('message', (raw) => {
            try {
                const data = JSON.parse(raw.toString());

                switch (data.type) {
                    case 'join': {
                        const roomId = data.roomId || 'global_arena';
                        currentRoom = getOrCreateRoom(roomId);

                        if (currentRoom.players.size >= currentRoom.maxPlayers) {
                            ws.send(JSON.stringify({ type: 'room_full', message: 'Le salon est complet (4/4 joueurs).' }));
                            return;
                        }

                        // Déterminer le slot de couleur disponible
                        const takenSlots = Array.from(currentRoom.players.values()).map(p => p.slotIndex);
                        let slotIndex = 0;
                        while (takenSlots.includes(slotIndex) && slotIndex < 4) slotIndex++;

                        currentPlayerId = `player_${Math.random().toString(36).substring(2, 9)}`;
                        const playerInfo = {
                            id: currentPlayerId,
                            name: data.playerName || `Combattant ${slotIndex + 1}`,
                            slotIndex,
                            color: COLORS[slotIndex].hex,
                            colorName: COLORS[slotIndex].name,
                            spawnPos: COLORS[slotIndex].spawn,
                            pos: COLORS[slotIndex].spawn,
                            rotY: 0,
                            pitch: 0,
                            isAiming: false,
                            hp: 100,
                            kills: 0,
                            deaths: 0,
                            ws
                        };

                        currentRoom.players.set(currentPlayerId, playerInfo);

                        // Envoyer l'état d'initialisation au nouveau joueur
                        const existingPlayers = Array.from(currentRoom.players.values()).map(p => ({
                            id: p.id,
                            name: p.name,
                            slotIndex: p.slotIndex,
                            color: p.color,
                            pos: p.pos,
                            rotY: p.rotY,
                            hp: p.hp,
                            kills: p.kills,
                            deaths: p.deaths
                        }));

                        ws.send(JSON.stringify({
                            type: 'init_state',
                            myId: currentPlayerId,
                            mySlot: slotIndex,
                            myColor: playerInfo.color,
                            mySpawn: playerInfo.spawnPos,
                            players: existingPlayers
                        }));

                        // Notifier les autres joueurs
                        broadcastToRoom(currentRoom, {
                            type: 'player_joined',
                            player: {
                                id: playerInfo.id,
                                name: playerInfo.name,
                                slotIndex: playerInfo.slotIndex,
                                color: playerInfo.color,
                                pos: playerInfo.pos,
                                rotY: playerInfo.rotY,
                                hp: playerInfo.hp,
                                kills: playerInfo.kills,
                                deaths: playerInfo.deaths
                            }
                        }, ws);
                        break;
                    }

                    case 'move': {
                        if (!currentRoom || !currentPlayerId) return;
                        const player = currentRoom.players.get(currentPlayerId);
                        if (player) {
                            player.pos = data.pos;
                            player.rotY = data.rotY;
                            player.pitch = data.pitch;
                            player.isAiming = data.isAiming;

                            broadcastToRoom(currentRoom, {
                                type: 'player_moved',
                                id: currentPlayerId,
                                pos: data.pos,
                                rotY: data.rotY,
                                pitch: data.pitch,
                                isAiming: data.isAiming
                            }, ws);
                        }
                        break;
                    }

                    case 'shoot': {
                        if (!currentRoom || !currentPlayerId) return;
                        broadcastToRoom(currentRoom, {
                            type: 'player_shot',
                            id: currentPlayerId,
                            origin: data.origin,
                            dir: data.dir
                        }, ws);
                        break;
                    }

                    case 'hit': {
                        if (!currentRoom || !currentPlayerId) return;
                        const target = currentRoom.players.get(data.targetId);
                        const shooter = currentRoom.players.get(currentPlayerId);

                        if (target) {
                            const damage = data.damage || 20;
                            target.hp = Math.max(0, target.hp - damage);

                            const isKill = target.hp <= 0;
                            if (isKill && shooter) {
                                shooter.kills = (shooter.kills || 0) + 1;
                                target.deaths = (target.deaths || 0) + 1;
                            }

                            broadcastToRoom(currentRoom, {
                                type: 'damage_applied',
                                targetId: data.targetId,
                                shooterId: currentPlayerId,
                                shooterName: shooter ? shooter.name : 'Un joueur',
                                targetName: target.name,
                                damage,
                                hitType: data.hitType,
                                newHp: target.hp,
                                isKill,
                                hitPoint: data.hitPoint
                            });
                        }
                        break;
                    }

                    case 'respawn': {
                        if (!currentRoom || !currentPlayerId) return;
                        const player = currentRoom.players.get(currentPlayerId);
                        if (player) {
                            player.hp = 100;
                            const spawn = COLORS[player.slotIndex % 4].spawn;
                            player.pos = spawn;

                            broadcastToRoom(currentRoom, {
                                type: 'player_respawned',
                                id: currentPlayerId,
                                hp: 100,
                                spawnPos: spawn
                            });
                        }
                        break;
                    }
                }
            } catch (e) {
                console.error('[Multiplayer] Erreur message WS:', e);
            }
        });

        ws.on('close', () => {
            if (currentRoom && currentPlayerId) {
                currentRoom.players.delete(currentPlayerId);
                broadcastToRoom(currentRoom, {
                    type: 'player_left',
                    id: currentPlayerId
                });
                if (currentRoom.players.size === 0) {
                    rooms.delete(currentRoom.id);
                }
            }
        });
    });

    console.log('[Multiplayer] Serveur WebSocket initialisé sur /api/ws');
}
