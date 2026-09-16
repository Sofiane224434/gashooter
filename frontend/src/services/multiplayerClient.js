// Client WebSocket pour le Mode Multijoueur Temps Réel (1 à 4 Joueurs)
export class MultiplayerClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.myId = null;
        this.mySlot = 0;
        this.myColor = 0x06b6d4;
        this.pingInterval = null;
        this.callbacks = {
            onInitState: null,
            onPlayerJoined: null,
            onPlayerMoved: null,
            onPlayerShot: null,
            onDamageApplied: null,
            onPlayerRespawned: null,
            onPlayerLeft: null,
            onRoomFull: null,
            onDisconnected: null
        };
    }

    connect(playerName = 'Joueur', roomId = 'global_arena') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/ws`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                this.ws.send(JSON.stringify({
                    type: 'join',
                    playerName,
                    roomId
                }));

                // Heartbeat régulier toutes les 15 secondes pour éviter tout timeout proxy/nginx
                if (this.pingInterval) clearInterval(this.pingInterval);
                this.pingInterval = setInterval(() => {
                    if (this.connected && this.ws?.readyState === 1) {
                        try {
                            this.ws.send(JSON.stringify({ type: 'ping' }));
                        } catch (e) {}
                    }
                }, 15000);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'pong':
                            break;

                        case 'init_state':
                            this.myId = data.myId;
                            this.mySlot = data.mySlot;
                            this.myColor = data.myColor;
                            if (this.callbacks.onInitState) this.callbacks.onInitState(data);
                            break;

                        case 'player_joined':
                            if (this.callbacks.onPlayerJoined) this.callbacks.onPlayerJoined(data.player);
                            break;

                        case 'player_moved':
                            if (this.callbacks.onPlayerMoved) this.callbacks.onPlayerMoved(data);
                            break;

                        case 'player_shot':
                            if (this.callbacks.onPlayerShot) this.callbacks.onPlayerShot(data);
                            break;

                        case 'damage_applied':
                            if (this.callbacks.onDamageApplied) this.callbacks.onDamageApplied(data);
                            break;

                        case 'player_respawned':
                            if (this.callbacks.onPlayerRespawned) this.callbacks.onPlayerRespawned(data);
                            break;

                        case 'player_left':
                            if (this.callbacks.onPlayerLeft) this.callbacks.onPlayerLeft(data.id);
                            break;

                        case 'room_full':
                            if (this.callbacks.onRoomFull) this.callbacks.onRoomFull(data.message);
                            break;
                    }
                } catch (err) {
                    console.warn('[MultiplayerClient] Erreur parsing message:', err);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                if (this.pingInterval) clearInterval(this.pingInterval);
                if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
            };

            this.ws.onerror = (e) => {
                console.warn('[MultiplayerClient] Erreur WebSocket:', e);
            };
        } catch (e) {
            console.error('[MultiplayerClient] Impossible d\'établir la connexion WS:', e);
        }
    }

    sendMove(pos, rotY, pitch = 0, isAiming = false) {
        if (this.connected && this.ws?.readyState === 1) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'move',
                    pos: [pos.x, pos.y, pos.z],
                    rotY,
                    pitch,
                    isAiming
                }));
            } catch (e) {}
        }
    }

    sendShoot(origin, dir) {
        if (this.connected && this.ws?.readyState === 1) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'shoot',
                    origin: [origin.x, origin.y, origin.z],
                    dir: [dir.x, dir.y, dir.z]
                }));
            } catch (e) {}
        }
    }

    sendHit(targetId, damage, hitType, hitPoint) {
        if (this.connected && this.ws?.readyState === 1) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'hit',
                    targetId,
                    damage,
                    hitType,
                    hitPoint: [hitPoint.x, hitPoint.y, hitPoint.z]
                }));
            } catch (e) {}
        }
    }

    sendRespawn() {
        if (this.connected && this.ws?.readyState === 1) {
            try {
                this.ws.send(JSON.stringify({
                    type: 'respawn'
                }));
            } catch (e) {}
        }
    }

    disconnect() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.ws) {
            try {
                this.ws.close();
            } catch (e) {}
            this.ws = null;
            this.connected = false;
        }
    }
}
