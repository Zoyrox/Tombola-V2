const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Sicurezza
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Limite richieste per IP
  message: 'Troppe richieste da questo IP'
});
app.use('/api/', limiter);

// Socket.io con opzioni sicure
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') || [] : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: {
    name: 'io',
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Database in memoria (in produzione usa database vero)
const usersDB = new Map(); // email -> {passwordHash, name, role, createdAt}
const roomsDB = new Map(); // roomCode -> roomData
const sessionsDB = new Map(); // sessionToken -> {email, expires}
const activeSockets = new Map(); // socketId -> {email, roomCode, role}

// Inizializza Super Admin
const SUPER_ADMIN = {
  email: process.env.SUPER_ADMIN_EMAIL || "superadmin@tombola.natale",
  password: process.env.SUPER_ADMIN_PASSWORD || "Natale2023!",
  name: "Super Admin Babbo Natale"
};

async function initializeSuperAdmin() {
  if (!usersDB.has(SUPER_ADMIN.email)) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 12);
    usersDB.set(SUPER_ADMIN.email, {
      passwordHash,
      name: SUPER_ADMIN.name,
      role: 'super_admin',
      createdAt: new Date().toISOString(),
      lastLogin: null
    });
    console.log(`🎅 Super Admin creato: ${SUPER_ADMIN.email}`);
  }
}

// Funzioni helper
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Rimossi caratteri confondibili
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

// Significati natalizi per i numeri
const natalNumbers = {
  1: "L'albero di Natale",
  2: "Le renne di Babbo Natale",
  3: "I Re Magi",
  4: "Le candele dell'Avvento",
  5: "I campanelli d'argento",
  6: "I fiocchi di neve",
  7: "I giorni della settimana santa",
  8: "Le palline dell'albero",
  9: "I cori angelici",
  10: "I biscotti di zenzero",
  11: "Le calze del caminetto",
  12: "I giorni di Natale (canzone)",
  13: "La sfortuna? No, è Natale!",
  14: "I panettoni infornati",
  15: "I regali impacchettati",
  16: "Gli elfi laboriosi",
  17: "I cioccolatini",
  18: "Gli auguri di Buon Natale",
  19: "Le stelle comete",
  20: "I pupazzi di neve",
  21: "Gli abbracci natalizi",
  22: "Le luci colorate",
  23: "I brindisi in famiglia",
  24: "La vigilia di Natale",
  25: "🎄 NATALE! 🎄",
  26: "I pandori dorati",
  27: "I canti di Natale",
  28: "I fuochi d'artificio",
  29: "Gli spumanti stappati",
  30: "I semi di melograno",
  31: "Capodanno alle porte",
  32: "I baci sotto il vischio",
  33: "Gli anni di Cristo",
  34: "Le slitte volanti",
  35: "I bastoncini di zucchero",
  36: "I biglietti d'auguri",
  37: "I mercatini natalizi",
  38: "I vin brulè caldi",
  39: "I pacchi regalo",
  40: "I giorni di Quaresima",
  41: "I film natalizi",
  42: "Le noci decorate",
  43: "I presepi artistici",
  44: "Le ghirlande sulla porta",
  45: "I giorni fino all'Epifania",
  46: "Le letterine a Babbo Natale",
  47: "I pupazzi di Babbo Natale",
  48: "Le caramelle colorate",
  49: "I dolci della nonna",
  50: "I panettoni farciti",
  51: "Gli stivali pieni di neve",
  52: "Le settimane dell'anno",
  53: "I giorni festivi",
  54: "Le cartoline natalizie",
  55: "Le campane che suonano",
  56: "I fiocchi regalo",
  57: "Gli alberi addobbati",
  58: "Le luci a led",
  59: "I minuti di attesa",
  60: "I secondi del countdown",
  61: "I gradi del camino",
  62: "I biscotti avanzati",
  63: "I centimetri di neve",
  64: "I pezzi del puzzle natalizio",
  65: "Gli anni della nonna",
  66: "I desideri esauditi",
  67: "I sorrisi dei bambini",
  68: "Gli abeti nelle case",
  69: "Le ore di veglia",
  70: "I decimetri di neve",
  71: "I regali inaspettati",
  72: "Le ore di felicità",
  73: "I giorni di vacanza",
  74: "I parenti a tavola",
  75: "Gli anni di tradizione",
  76: "Le stelle in cielo",
  77: "I fiocchi caduti",
  78: "I bicchieri alzati",
  79: "I canti imparati",
  80: "Gli amici ritrovati",
  81: "I giorni di festa",
  82: "Le ricette di famiglia",
  83: "I ricordi d'infanzia",
  84: "Le decorazioni fatte a mano",
  85: "I centimetri del pacco regalo",
  86: "I gradi del forno",
  87: "I minuti di cottura",
  88: "Gli anni di matrimonio",
  89: "I capelli bianchi di Babbo Natale",
  90: "I desideri per l'anno nuovo"
};

// API Routes
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    season: 'Natale 2023',
    stats: {
      rooms: roomsDB.size,
      users: usersDB.size,
      activeSockets: activeSockets.size
    }
  });
});

app.get('/api/natal-numbers', (req, res) => {
  res.json({
    count: Object.keys(natalNumbers).length,
    numbers: natalNumbers
  });
});

app.get('/api/stats', (req, res) => {
  const publicStats = {
    totalRooms: roomsDB.size,
    activeRooms: Array.from(roomsDB.values()).filter(r => r.players.length > 0).length,
    totalPlayers: Array.from(roomsDB.values()).reduce((sum, room) => sum + room.players.length, 0),
    numbersExtractedToday: Array.from(roomsDB.values()).reduce((sum, room) => sum + room.game.extractedNumbers.length, 0)
  };
  res.json(publicStats);
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log(`🔌 Nuova connessione: ${socket.id}`);
  
  // Auth via token
  socket.on('authenticate', async ({ token, email }) => {
    try {
      const session = sessionsDB.get(token);
      if (!session || session.email !== email || new Date() > new Date(session.expires)) {
        socket.emit('auth-error', { message: 'Sessione scaduta o non valida' });
        return;
      }
      
      const user = usersDB.get(email);
      if (!user) {
        socket.emit('auth-error', { message: 'Utente non trovato' });
        return;
      }
      
      activeSockets.set(socket.id, {
        email,
        role: user.role,
        name: user.name,
        roomCode: null
      });
      
      socket.emit('authenticated', {
        email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.role === 'super_admin'
      });
      
      console.log(`🔑 ${user.name} (${email}) autenticato`);
    } catch (error) {
      console.error('Errore autenticazione:', error);
      socket.emit('auth-error', { message: 'Errore interno' });
    }
  });
  
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
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ore
      
      sessionsDB.set(token, { email, expires });
      
      // Rimuovi sessioni vecchie
      setTimeout(() => {
        if (sessionsDB.get(token)?.email === email) {
          sessionsDB.delete(token);
        }
      }, 24 * 60 * 60 * 1000);
      
      activeSockets.set(socket.id, {
        email,
        role: user.role,
        name: user.name,
        roomCode: null
      });
      
      user.lastLogin = new Date().toISOString();
      usersDB.set(email, user);
      
      socket.emit('login-success', {
        token,
        email,
        name: user.name,
        role: user.role,
        isSuperAdmin: user.role === 'super_admin',
        permissions: getPermissions(user.role)
      });
      
      console.log(`🔓 ${user.name} (${email}) ha effettuato il login`);
    } catch (error) {
      console.error('Errore login:', error);
      socket.emit('login-error', { message: 'Errore interno del server' });
    }
  });
  
  // Crea nuovo Admin (solo super admin)
  socket.on('create-admin', async ({ email, password, name }, callback) => {
    try {
      const socketData = activeSockets.get(socket.id);
      if (!socketData || socketData.role !== 'super_admin') {
        callback({ success: false, error: 'Non autorizzato' });
        return;
      }
      
      if (usersDB.has(email)) {
        callback({ success: false, error: 'Email già registrata' });
        return;
      }
      
      const passwordHash = await bcrypt.hash(password, 12);
      usersDB.set(email, {
        passwordHash,
        name: name || email.split('@')[0],
        role: 'admin',
        createdAt: new Date().toISOString(),
        createdBy: socketData.email,
        lastLogin: null
      });
      
      callback({ success: true, email, name });
      console.log(`👨‍💼 Nuovo admin creato da ${socketData.name}: ${email}`);
    } catch (error) {
      console.error('Errore creazione admin:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });
  
  // Crea stanza
  socket.on('create-room', ({ name, maxPlayers, settings }, callback) => {
    try {
      const socketData = activeSockets.get(socket.id);
      if (!socketData || !['super_admin', 'admin'].includes(socketData.role)) {
        callback({ success: false, error: 'Non autorizzato' });
        return;
      }
      
      const roomCode = generateRoomCode();
      
      const room = {
        code: roomCode,
        name: name || `Tombola di ${socketData.name}`,
        admin: {
          email: socketData.email,
          name: socketData.name,
          socketId: socket.id
        },
        players: [],
        game: {
          active: false,
          extractedNumbers: [],
          lastExtracted: null,
          lastMeaning: null,
          remainingNumbers: generateAllNumbers(),
          startedAt: null,
          winner: null
        },
        settings: {
          maxPlayers: Math.min(Math.max(2, parseInt(maxPlayers) || 20), 50),
          showNatalMeanings: settings?.showNatalMeanings ?? true,
          autoMark: settings?.autoMark ?? true,
          autoExtractDelay: 3000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      roomsDB.set(roomCode, room);
      
      socketData.roomCode = roomCode;
      activeSockets.set(socket.id, socketData);
      
      socket.join(roomCode);
      
      callback({
        success: true,
        room,
        user: {
          role: 'admin',
          name: socketData.name,
          email: socketData.email
        }
      });
      
      console.log(`🚪 Stanza ${roomCode} creata da ${socketData.name}`);
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
      
      if (room.game.active && room.game.startedAt) {
        const minutesSinceStart = (Date.now() - new Date(room.game.startedAt).getTime()) / 60000;
        if (minutesSinceStart > 5) {
          callback({ success: false, error: 'Partita già iniziata da più di 5 minuti' });
          return;
        }
      }
      
      const player = {
        id: socket.id,
        socketId: socket.id,
        name: playerName.substring(0, 20),
        cardNumbers: generateCardNumbers(),
        extractedCount: 0,
        hasWon: false,
        joinedAt: new Date().toISOString(),
        lastActive: Date.now()
      };
      
      room.players.push(player);
      room.settings.updatedAt = new Date().toISOString();
      roomsDB.set(roomCode, room);
      
      const socketData = {
        email: `player_${socket.id}`,
        role: 'player',
        name: playerName,
        roomCode: roomCode
      };
      
      activeSockets.set(socket.id, socketData);
      socket.join(roomCode);
      
      // Notifica tutti nella stanza
      io.to(roomCode).emit('player-joined', {
        player: {
          id: socket.id,
          name: playerName,
          joinedAt: player.joinedAt
        },
        totalPlayers: room.players.length
      });
      
      callback({
        success: true,
        room,
        player: {
          id: socket.id,
          name: playerName,
          cardNumbers: player.cardNumbers,
          role: 'player'
        }
      });
      
      console.log(`👤 ${playerName} unito alla stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore join stanza:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });
  
  // Avvia gioco
  socket.on('start-game', ({ roomCode }, callback) => {
    try {
      const socketData = activeSockets.get(socket.id);
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
        lastMeaning: null,
        remainingNumbers: generateAllNumbers(),
        startedAt: new Date().toISOString(),
        winner: null
      };
      
      // Nuove cartelle per tutti
      room.players.forEach(player => {
        player.cardNumbers = generateCardNumbers();
        player.extractedCount = 0;
        player.hasWon = false;
      });
      
      room.settings.updatedAt = new Date().toISOString();
      roomsDB.set(roomCode, room);
      
      io.to(roomCode).emit('game-started', { room });
      callback({ success: true, room });
      
      console.log(`🎮 Gioco iniziato in ${roomCode} da ${socketData.name}`);
    } catch (error) {
      console.error('Errore avvio gioco:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });
  
  // Estrai numero
  socket.on('extract-number', ({ roomCode }, callback) => {
    try {
      const socketData = activeSockets.get(socket.id);
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
      const meaning = natalNumbers[number] || `Numero ${number} - Buona fortuna!`;
      
      room.game.extractedNumbers.push(number);
      room.game.lastExtracted = number;
      room.game.lastMeaning = meaning;
      room.settings.updatedAt = new Date().toISOString();
      
      // Aggiorna giocatori e controlla vincite
      let winner = null;
      room.players.forEach(player => {
        if (player.cardNumbers.includes(number)) {
          player.extractedCount++;
          player.lastActive = Date.now();
          
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
          winner: {
            id: winner.id,
            name: winner.name,
            cardNumbers: winner.cardNumbers
          },
          roomCode: room.code
        });
      }
      
      callback({ success: true, number, meaning });
      console.log(`🎲 Numero ${number} estratto in ${roomCode} (${meaning.substring(0, 30)}...)`);
    } catch (error) {
      console.error('Errore estrazione:', error);
      callback({ success: false, error: 'Errore interno' });
    }
  });
  
  // Ping/pong per keep alive
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  // Disconnessione
  socket.on('disconnect', (reason) => {
    try {
      const socketData = activeSockets.get(socket.id);
      
      if (socketData) {
        const { roomCode, role, name, email } = socketData;
        
        if (roomCode) {
          const room = roomsDB.get(roomCode);
          if (room) {
            if (role === 'admin' && room.admin.socketId === socket.id) {
              // Admin disconnesso - chiudi stanza dopo 1 minuto
              setTimeout(() => {
                const currentRoom = roomsDB.get(roomCode);
                if (currentRoom && currentRoom.admin.socketId === socket.id) {
                  roomsDB.delete(roomCode);
                  io.to(roomCode).emit('room-closed', {
                    message: 'La stanza è stata chiusa (admin disconnesso)'
                  });
                  console.log(`🚪 Stanza ${roomCode} chiusa per inattività admin`);
                }
              }, 60000);
            } else if (role === 'player') {
              // Rimuovi giocatore
              room.players = room.players.filter(p => p.id !== socket.id);
              roomsDB.set(roomCode, room);
              
              io.to(roomCode).emit('player-left', {
                playerId: socket.id,
                totalPlayers: room.players.length
              });
              
              console.log(`👋 ${name} ha lasciato la stanza ${roomCode}`);
            }
          }
        }
        
        activeSockets.delete(socket.id);
        
        if (role === 'super_admin' || role === 'admin') {
          console.log(`🔒 ${name} (${role}) disconnesso: ${reason}`);
        }
      }
    } catch (error) {
      console.error('Errore durante disconnessione:', error);
    }
  });
});

// Funzioni helper
function getPermissions(role) {
  const permissions = {
    super_admin: {
      canCreateAdmins: true,
      canDeleteAdmins: true,
      canCreateRooms: true,
      canDeleteRooms: true,
      canViewAllRooms: true,
      canModifySettings: true
    },
    admin: {
      canCreateAdmins: false,
      canDeleteAdmins: false,
      canCreateRooms: true,
      canDeleteRooms: false,
      canViewAllRooms: false,
      canModifySettings: false
    },
    player: {
      canCreateAdmins: false,
      canDeleteAdmins: false,
      canCreateRooms: false,
      canDeleteRooms: false,
      canViewAllRooms: false,
      canModifySettings: false
    }
  };
  
  return permissions[role] || permissions.player;
}

// Avvia il server
const PORT = process.env.PORT || 3000;

initializeSuperAdmin().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄
🎅 TOMBOLA NATALIZIA - SERVER v3.0 🎅
🌐 Porta: ${PORT}
🔐 Super Admin: ${SUPER_ADMIN.email}
📡 Ready for Render.com
🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄🎄
`);
    
    // Pulizia sessioni scadute ogni ora
    setInterval(() => {
      const now = new Date();
      for (const [token, session] of sessionsDB.entries()) {
        if (now > new Date(session.expires)) {
          sessionsDB.delete(token);
        }
      }
      
      // Pulizia stanze inattive
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const [code, room] of roomsDB.entries()) {
        if (!room.game.active && 
            new Date(room.settings.updatedAt).getTime() < oneHourAgo && 
            room.players.length === 0) {
          roomsDB.delete(code);
          console.log(`🧹 Stanza ${code} rimossa per inattività`);
        }
      }
    }, 60 * 60 * 1000);
  });
}).catch(console.error);

// Fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
