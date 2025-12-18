const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Database in memoria
const activeGames = new Map(); // roomCode -> game data
const players = new Map(); // socket.id -> player data
const admins = new Set(['PYTHON2024_ADMIN']);
const usedPlayerCodes = new Set();
const playerCodes = new Map(); // playerCode -> {code, used, socketId}

// Genera codici giocatore
function generatePlayerCodes(count) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        let code;
        do {
            code = 'PLAYER' + String(usedPlayerCodes.size + i + 1).padStart(3, '0');
        } while (usedPlayerCodes.has(code));
        
        usedPlayerCodes.add(code);
        codes.push(code);
        playerCodes.set(code, { code, used: false, socketId: null });
    }
    return codes;
}

// Genera codice stanza
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Genera numeri per cartella
function generateCardNumbers() {
    const numbers = new Set();
    while (numbers.size < 15) {
        numbers.add(Math.floor(Math.random() * 90) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}

// Genera tutti i numeri per l'estrazione
function generateAllNumbers() {
    return Array.from({length: 90}, (_, i) => i + 1)
        .sort(() => Math.random() - 0.5);
}

// Significati Smorfia
const smorfia = {
    1: "L'Italia", 2: "'A piccerella (la bambina)", 3: "'A jatta (la gatta)",
    4: "'O puorco (il maiale)", 5: "'A mano (la mano)", 
    6: "Chella che guarda 'nterra", 7: "'O vascio (il palazzo)",
    8: "'A maronna (la madonna)", 9: "'A figliata (la prole)",
    10: "'E fasule (i fagioli)", 11: "'E suricille (i topolini)",
    12: "'O surdato (il soldato)", 13: "Sant'Antonio",
    14: "'O mbriaco (l'ubriaco)", 15: "'O guaglione (il ragazzo)",
    16: "'O culo (il sedere)", 17: "'A disgrazzia (la disgrazia)",
    18: "'O sanghe (il sangue)", 19: "'A resata (la risata)",
    20: "'A festa (la festa)", 21: "'A femmena annura (la donna nuda)",
    22: "'O pazzo (il pazzo)", 23: "'O scemo (lo scemo)",
    24: "'E gguardie (le guardie)", 25: "Natale",
    // ... continua con tutti i numeri fino a 90
    90: "'A paura (la paura)"
};

// Creazione stanza iniziale
function createInitialRoom() {
    const roomCode = 'GAME001';
    const room = {
        code: roomCode,
        adminSocketId: null,
        players: [],
        game: {
            active: true,
            extractedNumbers: [23, 57, 62, 73, 56, 71],
            lastExtracted: 71,
            remainingNumbers: generateAllNumbers().filter(n => ![23, 57, 62, 73, 56, 71].includes(n)),
            winner: null,
            startedAt: new Date().toISOString()
        },
        settings: {
            maxPlayers: 50,
            autoExtract: false,
            autoExtractDelay: 3000
        }
    };
    
    activeGames.set(roomCode, room);
    return room;
}

// Crea la stanza iniziale
const initialRoom = createInitialRoom();

// Socket.io events
io.on('connection', (socket) => {
    console.log('🔌 Nuova connessione:', socket.id);
    
    // Login Admin
    socket.on('admin-login', (data, callback) => {
        try {
            const { adminCode } = data;
            
            console.log('🔑 Tentativo login admin:', adminCode);
            
            if (!admins.has(adminCode)) {
                console.log('❌ Codice admin non valido');
                callback({ success: false, message: 'Codice admin non valido' });
                return;
            }
            
            // Trova o crea una stanza
            let room = Array.from(activeGames.values())[0];
            if (!room) {
                room = createInitialRoom();
            }
            
            // Assegna admin alla stanza
            room.adminSocketId = socket.id;
            activeGames.set(room.code, room);
            
            socket.join(room.code);
            socket.roomCode = room.code;
            socket.userType = 'admin';
            
            console.log('✅ Admin connesso a stanza:', room.code);
            
            callback({
                success: true,
                room: room,
                user: {
                    name: 'Amministratore',
                    type: 'admin',
                    roomCode: room.code
                }
            });
            
        } catch (error) {
            console.error('❌ Errore login admin:', error);
            callback({ success: false, message: 'Errore interno del server' });
        }
    });
    
    // Login Giocatore
    socket.on('player-login', (data, callback) => {
        try {
            const { playerCode, playerName } = data;
            
            console.log('👤 Tentativo login giocatore:', playerCode, playerName);
            
            // Verifica codice giocatore
            const codeData = playerCodes.get(playerCode);
            if (!codeData || codeData.used) {
                console.log('❌ Codice giocatore non valido o già usato');
                callback({ success: false, message: 'Codice giocatore non valido' });
                return;
            }
            
            // Trova stanza
            let room = Array.from(activeGames.values())[0];
            if (!room) {
                room = createInitialRoom();
            }
            
            // Controlla se il giocatore è già connesso
            const existingPlayer = room.players.find(p => p.code === playerCode);
            if (existingPlayer) {
                console.log('❌ Giocatore già connesso');
                callback({ success: false, message: 'Giocatore già connesso' });
                return;
            }
            
            // Crea giocatore
            const player = {
                id: socket.id,
                code: playerCode,
                name: playerName || `Giocatore_${Math.floor(Math.random() * 10000)}`,
                cardNumbers: generateCardNumbers(),
                extractedCount: 0,
                hasWon: false,
                joinedAt: new Date().toISOString()
            };
            
            // Conta numeri estratti trovati
            player.extractedCount = player.cardNumbers.filter(num => 
                room.game.extractedNumbers.includes(num)
            ).length;
            
            room.players.push(player);
            activeGames.set(room.code, room);
            
            // Aggiorna codice come usato
            codeData.used = true;
            codeData.socketId = socket.id;
            playerCodes.set(playerCode, codeData);
            
            socket.join(room.code);
            socket.roomCode = room.code;
            socket.userType = 'player';
            socket.playerCode = playerCode;
            
            console.log('✅ Giocatore connesso:', player.name, 'a stanza:', room.code);
            
            // Notifica tutti i giocatori
            io.to(room.code).emit('player-joined', {
                player: {
                    id: socket.id,
                    name: player.name,
                    code: playerCode
                },
                totalPlayers: room.players.length
            });
            
            callback({
                success: true,
                room: room,
                player: player
            });
            
        } catch (error) {
            console.error('❌ Errore login giocatore:', error);
            callback({ success: false, message: 'Errore interno del server' });
        }
    });
    
    // Estrai numero (solo admin)
    socket.on('extract-number', (data, callback) => {
        try {
            const roomCode = socket.roomCode;
            if (!roomCode) {
                callback({ success: false, message: 'Non sei in una stanza' });
                return;
            }
            
            const room = activeGames.get(roomCode);
            if (!room) {
                callback({ success: false, message: 'Stanza non trovata' });
                return;
            }
            
            if (socket.userType !== 'admin' || socket.id !== room.adminSocketId) {
                callback({ success: false, message: 'Non autorizzato' });
                return;
            }
            
            if (!room.game.active) {
                callback({ success: false, message: 'Il gioco non è attivo' });
                return;
            }
            
            if (room.game.remainingNumbers.length === 0) {
                callback({ success: false, message: 'Tutti i numeri estratti!' });
                return;
            }
            
            // Estrai numero
            const number = room.game.remainingNumbers.pop();
            const meaning = smorfia[number] || `Numero ${number} - Buona fortuna!`;
            
            room.game.extractedNumbers.push(number);
            room.game.lastExtracted = number;
            
            // Controlla vincite
            let winner = null;
            room.players.forEach(player => {
                if (player.cardNumbers.includes(number)) {
                    player.extractedCount++;
                    
                    if (player.extractedCount === 15 && !player.hasWon) {
                        player.hasWon = true;
                        winner = player;
                        room.game.active = false;
                        room.game.winner = player;
                    }
                }
            });
            
            activeGames.set(room.code, room);
            
            // Prepara dati da inviare
            const gameData = {
                number: number,
                meaning: meaning,
                room: {
                    code: room.code,
                    game: room.game,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        code: p.code,
                        extractedCount: p.extractedCount,
                        hasWon: p.hasWon
                    }))
                }
            };
            
            // Invia a tutti i giocatori nella stanza
            io.to(room.code).emit('number-extracted', gameData);
            
            if (winner) {
                io.to(room.code).emit('game-won', {
                    winner: winner,
                    roomCode: room.code
                });
            }
            
            callback({ success: true, number: number, meaning: meaning });
            console.log('🎲 Numero estratto:', number, 'in', room.code);
            
        } catch (error) {
            console.error('❌ Errore estrazione:', error);
            callback({ success: false, message: 'Errore interno' });
        }
    });
    
    // Genera nuovi codici (solo admin)
    socket.on('generate-codes', (data, callback) => {
        try {
            if (socket.userType !== 'admin') {
                callback({ success: false, message: 'Non autorizzato' });
                return;
            }
            
            const count = Math.min(Math.max(1, parseInt(data.count) || 5), 50);
            const codes = generatePlayerCodes(count);
            
            callback({ 
                success: true, 
                codes: codes,
                totalCodes: usedPlayerCodes.size
            });
            
            console.log('🔑 Generati', count, 'nuovi codici giocatore');
            
        } catch (error) {
            console.error('❌ Errore generazione codici:', error);
            callback({ success: false, message: 'Errore interno' });
        }
    });
    
    // Nuova partita (solo admin)
    socket.on('new-game', (data, callback) => {
        try {
            const roomCode = socket.roomCode;
            if (!roomCode) {
                callback({ success: false, message: 'Non sei in una stanza' });
                return;
            }
            
            const room = activeGames.get(roomCode);
            if (!room) {
                callback({ success: false, message: 'Stanza non trovata' });
                return;
            }
            
            if (socket.userType !== 'admin' || socket.id !== room.adminSocketId) {
                callback({ success: false, message: 'Non autorizzato' });
                return;
            }
            
            // Reset gioco
            room.game = {
                active: true,
                extractedNumbers: [],
                lastExtracted: null,
                remainingNumbers: generateAllNumbers(),
                winner: null,
                startedAt: new Date().toISOString()
            };
            
            // Reset giocatori
            room.players.forEach(player => {
                player.cardNumbers = generateCardNumbers();
                player.extractedCount = 0;
                player.hasWon = false;
            });
            
            activeGames.set(room.code, room);
            
            // Notifica tutti
            io.to(room.code).emit('game-started', { room: room });
            
            callback({ success: true, room: room });
            console.log('🔄 Nuova partita iniziata in:', room.code);
            
        } catch (error) {
            console.error('❌ Errore nuova partita:', error);
            callback({ success: false, message: 'Errore interno' });
        }
    });
    
    // Ping per mantenere connessione
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Disconnessione
    socket.on('disconnect', () => {
        console.log('🔌 Disconnesso:', socket.id);
        
        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = activeGames.get(roomCode);
            if (room) {
                if (socket.id === room.adminSocketId) {
                    // Admin disconnesso
                    room.adminSocketId = null;
                    console.log('👑 Admin disconnesso da:', roomCode);
                } else {
                    // Rimuovi giocatore
                    const playerIndex = room.players.findIndex(p => p.id === socket.id);
                    if (playerIndex !== -1) {
                        const player = room.players[playerIndex];
                        room.players.splice(playerIndex, 1);
                        
                        // Rilascia codice giocatore
                        if (player.code) {
                            const codeData = playerCodes.get(player.code);
                            if (codeData) {
                                codeData.used = false;
                                codeData.socketId = null;
                                playerCodes.set(player.code, codeData);
                            }
                        }
                        
                        console.log('👋 Giocatore rimosso:', player.name, 'da', roomCode);
                        
                        // Notifica gli altri
                        io.to(roomCode).emit('player-left', {
                            playerId: socket.id,
                            playerName: player.name,
                            totalPlayers: room.players.length
                        });
                    }
                }
                
                activeGames.set(roomCode, room);
            }
        }
    });
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        activeGames: activeGames.size,
        totalPlayers: Array.from(activeGames.values()).reduce((sum, room) => sum + room.players.length, 0),
        generatedCodes: usedPlayerCodes.size,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/stats', (req, res) => {
    const stats = {
        activeGames: activeGames.size,
        totalPlayers: Array.from(activeGames.values()).reduce((sum, room) => sum + room.players.length, 0),
        availableCodes: Array.from(playerCodes.values()).filter(c => !c.used).length,
        usedCodes: Array.from(playerCodes.values()).filter(c => c.used).length
    };
    res.json(stats);
});

// Genera alcuni codici iniziali
generatePlayerCodes(10);

// Avvia il server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 TOMBOLA PYTHON - SERVER
📍 Porta: ${PORT}
🔑 Codice Admin: PYTHON2024_ADMIN
🔢 Codici Giocatore: PLAYER001 - PLAYER010
📡 Server pronto e funzionante!
    `);
});
