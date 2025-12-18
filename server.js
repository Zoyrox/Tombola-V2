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
const sessionsDB = new Map();

// Super Admin iniziale
const SUPER_ADMIN = {
  email: "admin@tombola.it",
  password: "Admin123!",
  name: "Super Admin"
};

// Inizializza Super Admin
async function initSuperAdmin() {
  if (!usersDB.has(SUPER_ADMIN.email)) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 10);
    usersDB.set(SUPER_ADMIN.email, {
      passwordHash,
      name: SUPER_ADMIN.name,
      role: 'super_admin',
      createdAt: new Date().toISOString()
    });
    console.log('✅ Super Admin creato');
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

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCardNumbers() {
  const numbers = new Set();
  while (numbers.size < 15) {
    numbers.add(Math.floor(Math.random() * 90) + 1);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

function generateAllNumbers() {
  return Array.from({length: 90}, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5);
}

// Significati Smorfia
const smorfia = {
  1: "L'Italia",
  2: "'A piccerella (la bambina)",
  3: "'A jatta (la gatta)",
  4: "'O puorco (il maiale)",
  5: "'A mano (la mano)",
  6: "Chella che guarda 'nterra",
  7: "'O vascio (il palazzo)",
  8: "'A maronna (la madonna)",
  9: "'A figliata (la prole)",
  10: "'E fasule (i fagioli)",
  11: "'E suricille (i topolini)",
  12: "'O surdato (il soldato)",
  13: "Sant'Antonio",
  14: "'O mbriaco (l'ubriaco)",
  15: "'O guaglione (il ragazzo)",
  16: "'O culo (il sedere)",
  17: "'A disgrazzia (la disgrazia)",
  18: "'O sanghe (il sangue)",
  19: "'A resata (la risata)",
  20: "'A festa (la festa)",
  21: "'A femmena annura (la donna nuda)",
  22: "'O pazzo (il pazzo)",
  23: "'O scemo (lo scemo)",
  24: "'E gguardie (le guardie)",
  25: "Natale",
  26: "Nanninella",
  27: "'O cantero (il vaso da notte)",
  28: "'E zizze (le tette)",
  29: "'O pate d''e criature (il padre dei bambini)",
  30: "'E ppalle d''o tenente",
  31: "'O padrone 'e casa",
  32: "'O capitone",
  33: "L'anne 'e Cristo",
  34: "'A capa (la testa)",
  35: "L'aucelluzz (l'uccellino)",
  36: "'E castagnelle (le nacchere)",
  37: "'O monaco (il monaco)",
  38: "'E mmazzate (le botte)",
  39: "'A funa 'nganna (la corda al collo)",
  40: "'A paposcia (l'ernia)",
  41: "'O curtiello (il coltello)",
  42: "'O ccafè (il caffè)",
  43: "'A femmena 'ncopp''o balcone",
  44: "'E ccancelle (le prigioni)",
  45: "'O vino buono",
  46: "'E denare (i soldi)",
  47: "'O muorto (il morto)",
  48: "'O muorto che parla",
  49: "'O piezzo 'e carne",
  50: "'O ppane (il pane)",
  51: "'O ciardino (il giardino)",
  52: "'A mamma",
  53: "'O viecchio",
  54: "'O cappiello",
  55: "'A museca (la musica)",
  56: "'A caruta (la caduta)",
  57: "'O scartellato (il gobbo)",
  58: "'O paccotto (il regalo)",
  59: "'E pile (i peli)",
  60: "'O lamento",
  61: "'O cacciatore",
  62: "'O muorto acciso",
  63: "'A sposa",
  64: "'A sciammeria",
  65: "'O chianto",
  66: "'E ddoie zetelle",
  67: "'O totano int''a chitarra",
  68: "'A zuppa cotta",
  69: "Sottosopra",
  70: "'O palazzo",
  71: "L'ommo 'e merda",
  72: "'A meraviglia",
  73: "'O spitale",
  74: "'A rotta (la grotta)",
  75: "Pullecenella",
  76: "'A funtana",
  77: "'E riavulille",
  78: "'A bella figliola",
  79: "'O mariuolo",
  80: "'A vocca",
  81: "'E sciure",
  82: "'A tavula 'mbandita",
  83: "'O maletiempo",
  84: "'A chiesa",
  85: "L'aneme 'o priatorio",
  86: "'A puteca",
  87: "'E perucchie",
  88: "'E casecavalle",
  89: "'A vecchia",
  90: "'A paura"
};

// Socket.io events
io.on('connection', (socket) => {
  console.log('🔌 Nuova connessione:', socket.id);

  // Login Admin
  socket.on('admin-login', async ({ email, password }) => {
    try {
      const user = usersDB.get(email);
      if (!user) {
        socket.emit('login-error', { message: 'Credenziali non valide' });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        socket.emit('login-error', { message: 'Credenziali non valide' });
        return;
      }

      // Crea sessione
      const token = generateSessionToken();
      const expires = Date.now() + (24 * 60 * 60 * 1000);
      
      sessionsDB.set(token, { email, expires });
      socket.sessionToken = token;

      socket.emit('login-success', {
        token,
        email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.role === 'super_admin'
      });

      console.log(`🔓 ${user.name} ha effettuato il login`);
    } catch (error) {
      console.error('Errore login:', error);
      socket.emit('login-error', { message: 'Errore interno' });
    }
  });

  // Crea nuovo Admin
  socket.on('create-admin', async ({ email, password, name }, callback) => {
    try {
      const token = socket.sessionToken;
      const session = sessionsDB.get(token);
      
      if (!session) {
        callback({ success: false, error: 'Non autenticato' });
        return;
      }

      const user = usersDB.get(session.email);
      if (!user || user.role !== 'super_admin') {
        callback({ success: false, error: 'Non autorizzato' });
        return;
      }

      if (usersDB.has(email)) {
        callback({ success: false, error: 'Email già registrata' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      usersDB.set(email, {
        passwordHash,
        name: name || email.split('@')[0],
        role: 'admin',
        createdAt: new Date().toISOString(),
        createdBy: session.email
      });

      callback({ success: true, email, name });
      console.log(`👑 Nuovo admin creato: ${email}`);
    } catch (error) {
      console.error('Errore creazione admin:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });

  // Crea stanza
  socket.on('create-room', ({ name, maxPlayers, settings }, callback) => {
    try {
      const token = socket.sessionToken;
      const session = sessionsDB.get(token);
      
      if (!session) {
        callback({ success: false, error: 'Non autenticato' });
        return;
      }

      const user = usersDB.get(session.email);
      if (!user || !['super_admin', 'admin'].includes(user.role)) {
        callback({ success: false, error: 'Non autorizzato' });
        return;
      }

      const roomCode = generateRoomCode();
      const room = {
        code: roomCode,
        name: name || `Tombola ${roomCode}`,
        admin: {
          email: session.email,
          name: user.name,
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

      callback({
        success: true,
        room,
        user: {
          role: 'admin',
          name: user.name,
          email: session.email
        }
      });

      console.log(`🚪 Stanza ${roomCode} creata`);
    } catch (error) {
      console.error('Errore creazione stanza:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });

  // Unisciti a stanza
  socket.on('join-room', ({ roomCode, playerName }, callback) => {
    try {
      const room = roomsDB.get(roomCode.toUpperCase());
      if (!room) {
        callback({ success: false, error: 'Stanza non trovata' });
        return;
      }

      if (room.players.length >= room.settings.maxPlayers) {
        callback({ success: false, error: 'Stanza piena' });
        return;
      }

      const player = {
        id: socket.id,
        name: playerName.substring(0, 20),
        cardNumbers: generateCardNumbers(),
        extractedCount: 0,
        hasWon: false,
        joinedAt: new Date().toISOString()
      };

      room.players.push(player);
      roomsDB.set(roomCode, room);

      socket.join(roomCode);
      socket.roomCode = roomCode;

      // Notifica tutti
      io.to(roomCode).emit('player-joined', {
        player: {
          id: socket.id,
          name: playerName
        },
        totalPlayers: room.players.length
      });

      callback({
        success: true,
        room,
        player: {
          id: socket.id,
          name: playerName,
          cardNumbers: player.cardNumbers
        }
      });

      console.log(`👤 ${playerName} unito a ${roomCode}`);
    } catch (error) {
      console.error('Errore join stanza:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });

  // Estrai numero
  socket.on('extract-number', ({ roomCode }, callback) => {
    try {
      const room = roomsDB.get(roomCode);
      if (!room || room.admin.socketId !== socket.id || !room.game.active) {
        callback({ success: false, error: 'Non autorizzato' });
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
      room.players.forEach(player => {
        if (player.cardNumbers.includes(number)) {
          player.extractedCount++;
          
          if (player.extractedCount === 15 && !player.hasWon) {
            player.hasWon = true;
            room.game.active = false;
            room.game.winner = player;
            
            io.to(roomCode).emit('game-won', {
              winner: player,
              roomCode: room.code
            });
          }
        }
      });

      roomsDB.set(roomCode, room);

      // Invia a tutti
      io.to(roomCode).emit('number-extracted', {
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
      });

      callback({ success: true, number, meaning });
      console.log(`🎲 ${number} estratto in ${roomCode}`);
    } catch (error) {
      console.error('Errore estrazione:', error);
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
      console.log(`🎮 Gioco iniziato in ${roomCode}`);
    } catch (error) {
      console.error('Errore avvio gioco:', error);
      callback({ success: false, error: 'Errore interno' });
    }
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
            message: 'La stanza è stata chiusa'
          });
          console.log(`🚪 Stanza ${roomCode} chiusa`);
        } else {
          // Rimuovi giocatore
          room.players = room.players.filter(p => p.id !== socket.id);
          roomsDB.set(roomCode, room);
          
          io.to(roomCode).emit('player-left', {
            playerId: socket.id,
            totalPlayers: room.players.length
          });
          console.log(`👋 Giocatore rimosso da ${roomCode}`);
        }
      }
    }
  });
});

// Inizializza e avvia
const PORT = process.env.PORT || 3000;

initSuperAdmin().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 TOMBOLA ONLINE v4.0
📍 Porta: ${PORT}
🔐 Super Admin: ${SUPER_ADMIN.email}
📡 Server pronto!
    `);
  });
});
