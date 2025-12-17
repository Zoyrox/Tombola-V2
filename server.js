const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Configura Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Serve file statici
app.use(express.static(path.join(__dirname, 'public')));

// Database in memoria
const rooms = new Map();
const users = new Map();
const adminUsers = new Map(); // {email: {passwordHash, name, isSuperAdmin}}
const activeSessions = new Map(); // {socketId: {email, role}}

// Configurazione iniziale admin (cambiala in produzione!)
const SUPER_ADMIN_EMAIL = "admin@tombola.it";
const SUPER_ADMIN_PASSWORD = "Admin123!"; // Password di default

// Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Inizializza super admin
if (!adminUsers.has(SUPER_ADMIN_EMAIL)) {
  adminUsers.set(SUPER_ADMIN_EMAIL, {
    passwordHash: hashPassword(SUPER_ADMIN_PASSWORD),
    name: "Super Admin",
    isSuperAdmin: true,
    createdAt: new Date().toISOString()
  });
  console.log("Super Admin creato:", SUPER_ADMIN_EMAIL);
}

// Helper functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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
  return Array.from({length: 90}, (_, i) => i + 1)
    .sort(() => Math.random() - 0.5);
}

// Frasi smorfia napoletana per ogni numero
const smorfia = {
  1: "L'Italia",
  2: "'A piccerella (la bambina)",
  3: "'A jatta (la gatta)",
  4: "'O puorco (il maiale)",
  5: "'A mano (la mano)",
  6: "Chella che guarda 'nterra (quella che guarda a terra)",
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
  26: "Nanninella (piccola Anna)",
  27: "'O cantero (il vaso da notte)",
  28: "'E zizze (le tette)",
  29: "'O pate d''e criature (il padre dei bambini)",
  30: "'E ppalle d''o tenente (le palle del tenente)",
  31: "'O padrone 'e casa (il padrone di casa)",
  32: "'O capitone (il capitone)",
  33: "L'anne 'e Cristo (gli anni di Cristo)",
  34: "'A capa (la testa)",
  35: "L'aucelluzz (l'uccellino)",
  36: "'E castagnelle (le nacchere)",
  37: "'O monaco (il monaco)",
  38: "'E mmazzate (le botte)",
  39: "'A funa 'nganna (la corda al collo)",
  40: "'A paposcia (l'ernia)",
  41: "'O curtiello (il coltello)",
  42: "'O ccafè (il caffè)",
  43: "'A femmena 'ncopp''o balcone (la donna al balcone)",
  44: "'E ccancelle (le prigioni)",
  45: "'O vino buono (il vino buono)",
  46: "'E denare (i soldi)",
  47: "'O muorto (il morto)",
  48: "'O muorto che parla (il morto che parla)",
  49: "'O piezzo 'e carne (il pezzo di carne)",
  50: "'O ppane (il pane)",
  51: "'O ciardino (il giardino)",
  52: "'A mamma (la mamma)",
  53: "'O viecchio (il vecchio)",
  54: "'O cappiello (il cappello)",
  55: "'A museca (la musica)",
  56: "'A caruta (la caduta)",
  57: "'O scartellato (il gobbo)",
  58: "'O paccotto (il regalo)",
  59: "'E pile (i peli)",
  60: "'O lamento (il lamento)",
  61: "'O cacciatore (il cacciatore)",
  62: "'O muorto acciso (il morto ammazzato)",
  63: "'A sposa (la sposa)",
  64: "'A sciammeria (la marsina)",
  65: "'O chianto (il pianto)",
  66: "'E ddoie zetelle (le due zitelle)",
  67: "'O totano int''a chitarra (il totano nella chitarra)",
  68: "'A zuppa cotta (la zuppa cotta)",
  69: "Sottosopra",
  70: "'O palazzo (il palazzo)",
  71: "L'ommo 'e merda (l'uomo di merda)",
  72: "'A meraviglia (la meraviglia)",
  73: "'O spitale (l'ospedale)",
  74: "'A rotta (la grotta)",
  75: "Pullecenella (Pulcinella)",
  76: "'A funtana (la fontana)",
  77: "'E riavulille (i diavoletti)",
  78: "'A bella figliola (la bella ragazza)",
  79: "'O mariuolo (il ladro)",
  80: "'A vocca (la bocca)",
  81: "'E sciure (i fiori)",
  82: "'A tavula 'mbandita (la tavola imbandita)",
  83: "'O maletiempo (il maltempo)",
  84: "'A chiesa (la chiesa)",
  85: "L'aneme 'o priatorio (le anime del purgatorio)",
  86: "'A puteca (la bottega)",
  87: "'E perucchie (i pidocchi)",
  88: "'E casecavalle (i caciocavalli)",
  89: "'A vecchia (la vecchia)",
  90: "'A paura (la paura)"
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    users: users.size,
    admins: adminUsers.size
  });
});

app.get('/api/smorfia/:number', (req, res) => {
  const number = parseInt(req.params.number);
  if (number >= 1 && number <= 90) {
    res.json({ number, meaning: smorfia[number] || 'Numero senza significato' });
  } else {
    res.status(400).json({ error: 'Numero non valido (1-90)' });
  }
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);

  // Login admin
  socket.on('admin-login', (data) => {
    try {
      const { email, password } = data;
      const admin = adminUsers.get(email);
      
      if (!admin || admin.passwordHash !== hashPassword(password)) {
        socket.emit('admin-login-error', { message: 'Credenziali non valide' });
        return;
      }

      activeSessions.set(socket.id, { email, role: 'admin', isSuperAdmin: admin.isSuperAdmin });
      socket.emit('admin-login-success', {
        email,
        name: admin.name,
        isSuperAdmin: admin.isSuperAdmin,
        canCreateAdmins: admin.isSuperAdmin
      });
      
      console.log(`Admin ${email} connesso`);
    } catch (error) {
      console.error('Errore login admin:', error);
      socket.emit('admin-login-error', { message: 'Errore nel server' });
    }
  });

  // Crea nuovo admin (solo super admin)
  socket.on('create-admin', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session || !session.isSuperAdmin) {
        socket.emit('error', { message: 'Non autorizzato' });
        return;
      }

      const { email, password, name } = data;
      if (adminUsers.has(email)) {
        socket.emit('create-admin-error', { message: 'Admin già esistente' });
        return;
      }

      adminUsers.set(email, {
        passwordHash: hashPassword(password),
        name: name || email.split('@')[0],
        isSuperAdmin: false,
        createdAt: new Date().toISOString(),
        createdBy: session.email
      });

      socket.emit('admin-created', { email, name });
      console.log(`Nuovo admin creato da ${session.email}: ${email}`);
    } catch (error) {
      console.error('Errore creazione admin:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Crea stanza (solo admin)
  socket.on('create-room', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session || session.role !== 'admin') {
        socket.emit('error', { message: 'Devi essere admin per creare stanze' });
        return;
      }

      const { name, maxPlayers = 20 } = data;
      const admin = adminUsers.get(session.email);
      
      const roomCode = generateRoomCode();
      
      const room = {
        code: roomCode,
        admin: {
          email: session.email,
          name: admin.name,
          socketId: socket.id
        },
        players: [],
        game: {
          active: false,
          extractedNumbers: [],
          lastExtracted: null,
          remainingNumbers: generateAllNumbers(),
          startedAt: null,
          winner: null
        },
        settings: {
          maxPlayers: parseInt(maxPlayers),
          autoMark: true,
          showSmorfia: true
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      rooms.set(roomCode, room);
      users.set(socket.id, { roomCode, role: 'admin', email: session.email, name: admin.name });

      socket.join(roomCode);
      socket.emit('room-created', { 
        roomCode, 
        room,
        user: { role: 'admin', name: admin.name, email: session.email }
      });

      console.log(`Stanza ${roomCode} creata da admin ${session.email}`);
    } catch (error) {
      console.error('Errore creazione stanza:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Unisciti a stanza come giocatore
  socket.on('join-room', (data) => {
    try {
      const { roomCode, playerName } = data;
      
      if (!roomCode || !playerName) {
        socket.emit('error', { message: 'Codice stanza e nome richiesti' });
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());
      if (!room) {
        socket.emit('error', { message: 'Stanza non trovata' });
        return;
      }

      // Controlla limite giocatori
      if (room.players.length >= room.settings.maxPlayers) {
        socket.emit('error', { message: 'Stanza piena' });
        return;
      }

      // Genera cartella unica
      const player = {
        id: socket.id,
        name: playerName,
        socketId: socket.id,
        cardNumbers: generateCardNumbers(),
        extractedCount: 0,
        hasWon: false,
        joinedAt: new Date().toISOString(),
        lastActivity: Date.now()
      };
      
      room.players.push(player);
      room.updatedAt = new Date().toISOString();
      rooms.set(roomCode, room);
      
      users.set(socket.id, { roomCode, role: 'player', name: playerName });

      socket.join(roomCode);
      socket.emit('room-joined', { 
        room,
        user: { role: 'player', name: playerName, id: socket.id, cardNumbers: player.cardNumbers }
      });

      // Notifica tutti nella stanza
      io.to(roomCode).emit('player-joined', {
        player: { name: playerName, id: socket.id },
        players: room.players
      });

      console.log(`${playerName} si è unito alla stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore join stanza:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Avvia gioco
  socket.on('start-game', (data) => {
    try {
      const { roomCode } = data;
      const room = rooms.get(roomCode);
      
      if (!room || room.admin.socketId !== socket.id) {
        socket.emit('error', { message: 'Non autorizzato' });
        return;
      }

      // Reset gioco
      room.game = {
        active: true,
        extractedNumbers: [],
        lastExtracted: null,
        remainingNumbers: generateAllNumbers(),
        startedAt: new Date().toISOString(),
        winner: null
      };

      // Reset giocatori con nuove cartelle
      room.players.forEach(player => {
        player.cardNumbers = generateCardNumbers();
        player.extractedCount = 0;
        player.hasWon = false;
      });

      room.updatedAt = new Date().toISOString();
      rooms.set(roomCode, room);

      io.to(roomCode).emit('game-started', { room });
      console.log(`Gioco iniziato nella stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore avvio gioco:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Estrai numero
  socket.on('extract-number', (data) => {
    try {
      const { roomCode } = data;
      const room = rooms.get(roomCode);
      
      if (!room || room.admin.socketId !== socket.id || !room.game.active) {
        socket.emit('error', { message: 'Non autorizzato o gioco non attivo' });
        return;
      }

      if (room.game.remainingNumbers.length === 0) {
        socket.emit('error', { message: 'Tutti i numeri estratti!' });
        return;
      }

      // Estrai numero
      const extracted = room.game.remainingNumbers.pop();
      const meaning = smorfia[extracted] || "Numero fortunato!";
      
      room.game.extractedNumbers.push(extracted);
      room.game.lastExtracted = extracted;
      room.game.lastMeaning = meaning;
      room.updatedAt = new Date().toISOString();

      // Aggiorna giocatori
      room.players.forEach(player => {
        if (player.cardNumbers.includes(extracted)) {
          player.extractedCount += 1;
          
          // Controlla vincita
          if (player.extractedCount === 15 && !player.hasWon) {
            player.hasWon = true;
            room.game.winner = player;
            room.game.active = false;
          }
        }
      });

      rooms.set(roomCode, room);

      // Invia a tutti nella stanza
      io.to(roomCode).emit('number-extracted', {
        number: extracted,
        meaning: meaning,
        room: room
      });

      // Se c'è un vincitore, notifica
      if (room.game.winner) {
        io.to(roomCode).emit('game-won', {
          winner: room.game.winner,
          room: room
        });
      }

      console.log(`Numero ${extracted} (${meaning}) estratto nella stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore estrazione numero:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Segna numero sulla cartella
  socket.on('mark-number', (data) => {
    try {
      const { roomCode, number } = data;
      const user = users.get(socket.id);
      
      if (!user || user.roomCode !== roomCode) {
        socket.emit('error', { message: 'Non autorizzato' });
        return;
      }

      const room = rooms.get(roomCode);
      const player = room?.players.find(p => p.id === socket.id);
      
      if (player && room.game.extractedNumbers.includes(parseInt(number))) {
        socket.emit('number-marked', { 
          number, 
          marked: true,
          playerName: player.name 
        });
      }
    } catch (error) {
      console.error('Errore segnatura numero:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Nuova partita
  socket.on('new-game', (data) => {
    try {
      const { roomCode } = data;
      const room = rooms.get(roomCode);
      
      if (!room || room.admin.socketId !== socket.id) {
        socket.emit('error', { message: 'Non autorizzato' });
        return;
      }

      room.game = {
        active: true,
        extractedNumbers: [],
        lastExtracted: null,
        remainingNumbers: generateAllNumbers(),
        startedAt: new Date().toISOString(),
        winner: null
      };

      room.players.forEach(player => {
        player.cardNumbers = generateCardNumbers();
        player.extractedCount = 0;
        player.hasWon = false;
      });

      room.updatedAt = new Date().toISOString();
      rooms.set(roomCode, room);

      io.to(roomCode).emit('new-game-started', { room });
      console.log(`Nuova partita nella stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore nuova partita:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Ping per keep alive
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Disconnessione
  socket.on('disconnect', () => {
    try {
      const user = users.get(socket.id);
      const session = activeSessions.get(socket.id);
      
      if (session) {
        activeSessions.delete(socket.id);
        console.log(`Admin ${session.email} disconnesso`);
      }
      
      if (user) {
        const { roomCode, role, name } = user;
        const room = rooms.get(roomCode);
        
        if (room) {
          if (role === 'admin' && room.admin.socketId === socket.id) {
            // Se l'admin lascia, chiudi stanza dopo 1 minuto
            setTimeout(() => {
              const currentRoom = rooms.get(roomCode);
              if (currentRoom && currentRoom.admin.socketId === socket.id) {
                rooms.delete(roomCode);
                io.to(roomCode).emit('room-closed', { 
                  message: 'La stanza è stata chiusa (admin disconnesso)' 
                });
                console.log(`Stanza ${roomCode} chiusa`);
              }
            }, 60000);
          } else if (role === 'player') {
            // Rimuovi giocatore
            room.players = room.players.filter(p => p.id !== socket.id);
            rooms.set(roomCode, room);
            
            io.to(roomCode).emit('player-left', {
              playerId: socket.id,
              players: room.players
            });
            
            console.log(`${name} ha lasciato la stanza ${roomCode}`);
          }
        }
        
        users.delete(socket.id);
      }
      
      console.log('Disconnessione:', socket.id);
    } catch (error) {
      console.error('Errore disconnessione:', error);
    }
  });
});

// Route di fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvia il server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 Tombola Python - Server Admin v2.0`);
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🔐 Super Admin: ${SUPER_ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});
