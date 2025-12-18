const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Database in memoria
const usersDB = new Map();
const roomsDB = new Map();

// Inizializza Super Admin
async function initSuperAdmin() {
    const adminEmail = "admin@tombola.it";
    const adminPassword = "Admin123!";
    
    if (!usersDB.has(adminEmail)) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        usersDB.set(adminEmail, {
            passwordHash,
            name: "Super Admin",
            role: 'super_admin',
            createdAt: new Date().toISOString()
        });
        console.log('✅ Super Admin creato:', adminEmail);
    }
}

// Helper functions
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generateCardNumbers() {
    const numbers = new Set();
    while (numbers.size < 15) {
        numbers.add(Math.floor(Math.random() * 90) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}

function generateAllNumbers() {
    const numbers = Array.from({length: 90}, (_, i) => i + 1);
    return numbers.sort(() => Math.random() - 0.5);
}

// Significati Smorfia
const smorfia = {
    1: "L'Italia", 2: "'A piccerella", 3: "'A jatta", 4: "'O puorco", 5: "'A mano",
    6: "Chella che guarda 'nterra", 7: "'O vascio", 8: "'A maronna", 9: "'A figliata",
    10: "'E fasule", 11: "'E suricille", 12: "'O surdato", 13: "Sant'Antonio",
    14: "'O mbriaco", 15: "'O guaglione", 16: "'O culo", 17: "'A disgrazzia",
    18: "'O sanghe", 19: "'A resata", 20: "'A festa", 21: "'A femmena annura",
    22: "'O pazzo", 23: "'O scemo", 24: "'E gguardie", 25: "Natale", 26: "Nanninella",
    27: "'O cantero", 28: "'E zizze", 29: "'O pate d''e criature", 30: "'E ppalle d''o tenente",
    31: "'O padrone 'e casa", 32: "'O capitone", 33: "L'anne 'e Cristo", 34: "'A capa",
    35: "L'aucelluzz", 36: "'E castagnelle", 37: "'O monaco", 38: "'E mmazzate",
    39: "'A funa 'nganna", 40: "'A paposcia", 41: "'O curtiello", 42: "'O ccafè",
    43: "'A femmena 'ncopp''o balcone", 44: "'E ccancelle", 45: "'O vino buono",
    46: "'E denare", 47: "'O muorto", 48: "'O muorto che parla", 49: "'O piezzo 'e carne",
    50: "'O ppane", 51: "'O ciardino", 52: "'A mamma", 53: "'O viecchio", 54: "'O cappiello",
    55: "'A museca", 56: "'A caruta", 57: "'O scartellato", 58: "'O paccotto", 59: "'E pile",
    60: "'O lamento", 61: "'O cacciatore", 62: "'O muorto acciso", 63: "'A sposa",
    64: "'A sciammeria", 65: "'O chianto", 66: "'E ddoie zetelle", 67: "'O totano int''a chitarra",
    68: "'A zuppa cotta", 69: "Sottosopra", 70: "'O palazzo", 71: "L'ommo 'e merda",
    72: "'A meraviglia", 73: "'O spitale", 74: "'A rotta", 75: "Pullecenella",
    76: "'A funtana", 77: "'E riavulille", 78: "'A bella figliola", 79: "'O mariuolo",
    80: "'A vocca", 81: "'E sciure", 82: "'A tavula 'mbandita", 83: "'O maletiempo",
    84: "'A chiesa", 85: "L'aneme 'o priatorio", 86: "'A puteca", 87: "'E perucchie",
    88: "'E casecavalle", 89: "'A vecchia", 90: "'A paura"
};

// Socket.io events
io.on('connection', (socket) => {
    console.log('🔌 Nuova connessione:', socket.id);
    
    // Login Admin
    socket.on('admin-login', async ({ email, password }) => {
        try {
            console.log('🔑 Tentativo login:', email);
            
            const user = usersDB.get(email);
            if (!user) {
                console.log('❌ Utente non trovato:', email);
                socket.emit('login-error', { message: 'Credenziali non valide' });
                return;
            }

            const validPassword = await bcrypt.compare(password, user.passwordHash);
            if (!validPassword) {
                console.log('❌ Password errata per:', email);
                socket.emit('login-error', { message: 'Credenziali non valide' });
                return;
            }

            console.log('✅ Login successo per:', user.name);
            
            socket.user = {
                email: email,
                name: user.name,
                role: user.role,
                isSuperAdmin: user.role === 'super_admin'
            };

            socket.emit('login-success', {
                email: email,
                name: user.name,
                role: user.role,
                isSuperAdmin: user.role === 'super_admin'
            });

        } catch (error) {
            console.error('❌ Errore login:', error);
            socket.emit('login-error', { message: 'Errore interno del server' });
        }
    });

    // Crea nuovo Admin (solo super admin)
    socket.on('create-admin', async ({ email, password, name }, callback) => {
        try {
            console.log('👑 Tentativo creazione admin:', email);
            
            if (!socket.user || socket.user.role !== 'super_admin') {
                console.log('❌ Non autorizzato a creare admin');
                callback({ success: false, error: 'Non autorizzato' });
                return;
            }

            if (usersDB.has(email)) {
                console.log('❌ Email già esistente:', email);
                callback({ success: false, error: 'Email già registrata' });
                return;
            }

            if (!email.includes('@')) {
                callback({ success: false, error: 'Email non valida' });
                return;
            }

            if (password.length < 6) {
                callback({ success: false, error: 'Password troppo corta (min 6 caratteri)' });
                return;
            }

            const passwordHash = await bcrypt.hash(password, 10);
            usersDB.set(email, {
                passwordHash,
                name: name || email.split('@')[0],
                role: 'admin',
                createdAt: new Date().toISOString(),
                createdBy: socket.user.email
            });

            console.log('✅ Nuovo admin creato:', email);
            callback({ success: true, email, name: name || email.split('@')[0] });

        } catch (error) {
            console.error('❌ Errore creazione admin:', error);
            callback({ success: false, error: 'Errore interno' });
        }
    });

    // Crea stanza
    socket.on('create-room', ({ name, maxPlayers, settings }, callback) => {
        try {
            console.log('🚪 Tentativo creazione stanza');
            
            if (!socket.user || !['super_admin', 'admin'].includes(socket.user.role)) {
                console.log('❌ Non autorizzato a creare stanza');
                callback({ success: false, error: 'Non autorizzato' });
                return;
            }

            const roomCode = generateRoomCode();
            
            const room = {
                code: roomCode,
                name: name || `Tombola ${roomCode}`,
                admin: {
                    email: socket.user.email,
                    name: socket.user.name,
                    socketId: socket.id
                },
                players: [],
                game: {
                    active: false,
                    extractedNumbers: [],
                    lastExtracted: null,
                    remainingNumbers: generateAllNumbers(),
                    winner: null
                },
                settings: {
                    maxPlayers: Math.min(Math.max(2, parseInt(maxPlayers) || 20), 50),
                    showSmorfia: settings?.showSmorfia ?? true,
                    autoMark: settings?.autoMark ?? true,
                    createdAt: new Date().toISOString()
                }
            };

            roomsDB.set(roomCode, room);
            socket.join(roomCode);
            socket.roomCode = roomCode;

            console.log('✅ Stanza creata:', roomCode, 'da', socket.user.name);
            
            callback({
                success: true,
                room: room,
                user: {
                    role: 'admin',
                    name: socket.user.name,
                    email: socket.user.email
                }
            });

        } catch (error) {
            console.error('❌ Errore creazione stanza:', error);
            callback({ success: false, error: 'Errore interno' });
        }
    });

    // Unisciti a stanza
    socket.on('join-room', ({ roomCode, playerName }, callback) => {
        try {
            console.log('👤 Tentativo join stanza:', roomCode);
            
            const room = roomsDB.get(roomCode.toUpperCase());
            if (!room) {
                console.log('❌ Stanza non trovata:', roomCode);
                callback({ success: false, error: 'Stanza non trovata' });
                return;
            }

            if (room.players.length >= room.settings.maxPlayers) {
                callback({ success: false, error: 'Stanza piena' });
                return;
            }

            const player = {
                id: socket.id,
                name: playerName.substring(0, 20) || "Giocatore",
                cardNumbers: generateCardNumbers(),
                extractedCount: 0,
                hasWon: false,
                joinedAt: new Date().toISOString()
            };

            room.players.push(player);
            roomsDB.set(roomCode, room);

            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.user = { id: socket.id, name: playerName, role: 'player' };

            // Notifica tutti
            io.to(roomCode).emit('player-joined', {
                player: { id: socket.id, name: playerName },
                totalPlayers: room.players.length
            });

            console.log('✅ Giocatore unito:', playerName, 'a', roomCode);
            
            callback({
                success: true,
                room: room,
                player: {
                    id: socket.id,
                    name: playerName,
                    cardNumbers: player.cardNumbers
                }
            });

        } catch (error) {
            console.error('❌ Errore join stanza:', error);
            callback({ success: false, error: 'Errore interno' });
        }
    });

    // Avvia gioco
    socket.on('start-game', ({ roomCode }, callback) => {
        try {
            const room = roomsDB.get(roomCode);
            
            if (!room || room.admin.socketId !== socket.id) {
                callback({ success: false, error: 'Non autorizzato' });
                return;
            }

            // Reset gioco
            room.game = {
                active: true,
                extractedNumbers: [],
                lastExtracted: null,
                remainingNumbers: generateAllNumbers(),
                winner: null
            };

            // Reset giocatori
            room.players.forEach(player => {
                player.cardNumbers = generateCardNumbers();
                player.extractedCount = 0;
                player.hasWon = false;
            });

            roomsDB.set(roomCode, room);
            
            io.to(roomCode).emit('game-started', { room });
            callback({ success: true, room });

            console.log('🎮 Gioco iniziato in:', roomCode);

        } catch (error) {
            console.error('❌ Errore avvio gioco:', error);
            callback({ success: false, error: 'Errore interno' });
        }
    });

    // Estrai numero
    socket.on('extract-number', ({ roomCode }, callback) => {
        try {
            const room = roomsDB.get(roomCode);
            
            if (!room || room.admin.socketId !== socket.id || !room.game.active) {
                callback({ success: false, error: 'Non autorizzato o gioco non attivo' });
                return;
            }

            if (room.game.remainingNumbers.length === 0) {
                callback({ success: false, error: 'Tutti i numeri estratti!' });
                return;
            }

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

            roomsDB.set(roomCode, room);

            // Invia a tutti
            const eventData = {
                number,
                meaning,
                room: {
                    code: room.code,
                    game: room.game,
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        extractedCount: p.extractedCount,
                        hasWon: p.hasWon
                    }))
                }
            };

            io.to(roomCode).emit('number-extracted', eventData);

            if (winner) {
                io.to(roomCode).emit('game-won', {
                    winner: winner,
                    roomCode: room.code
                });
            }

            callback({ success: true, number, meaning });
            console.log('🎲 Numero estratto:', number, 'in', roomCode);

        } catch (error) {
            console.error('❌ Errore estrazione:', error);
            callback({ success: false, error: 'Errore interno' });
        }
    });

    // Ping per mantenere connessione
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Disconnessione
    socket.on('disconnect', () => {
        console.log('🔌 Disconnesso:', socket.id);

        const roomCode = socket.roomCode;
        if (roomCode) {
            const room = roomsDB.get(roomCode);
            if (room) {
                if (room.admin.socketId === socket.id) {
                    // Admin disconnesso - chiudi stanza
                    roomsDB.delete(roomCode);
                    io.to(roomCode).emit('room-closed', {
                        message: 'La stanza è stata chiusa (admin disconnesso)'
                    });
                    console.log('🚪 Stanza chiusa:', roomCode);
                } else {
                    // Rimuovi giocatore
                    room.players = room.players.filter(p => p.id !== socket.id);
                    roomsDB.set(roomCode, room);
                    
                    io.to(roomCode).emit('player-left', {
                        playerId: socket.id,
                        totalPlayers: room.players.length
                    });
                    console.log('👋 Giocatore rimosso da:', roomCode);
                }
            }
        }
    });
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        users: usersDB.size,
        rooms: roomsDB.size,
        timestamp: new Date().toISOString()
    });
});

// Avvia il server
const PORT = process.env.PORT || 3000;

initSuperAdmin().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
🚀 TOMBOLA ONLINE - SERVER
📍 Porta: ${PORT}
🔐 Super Admin: admin@tombola.it
📡 Server pronto e funzionante!
        `);
    });
}).catch(console.error);
