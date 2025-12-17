const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configura Socket.io per Render
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Serve file statici dalla cartella public
app.use(express.static(path.join(__dirname, 'public')));

// Database in memoria
const rooms = new Map();
const users = new Map();

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

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    users: users.size
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    code: room.code,
    admin: room.admin?.name,
    players: room.players.length,
    gameActive: room.game.active,
    createdAt: room.createdAt
  }));
  res.json(roomList);
});

// Socket.io Events
io.on('connection', (socket) => {
  console.log('Nuova connessione:', socket.id);

  // Ping per tenere attiva la connessione
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Crea stanza
  socket.on('create-room', (data) => {
    try {
      const { name } = data;
      if (!name) {
        socket.emit('error', { message: 'Nome richiesto' });
        return;
      }

      const roomCode = generateRoomCode();
      
      const room = {
        code: roomCode,
        admin: {
          id: socket.id,
          name: name,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      rooms.set(roomCode, room);
      users.set(socket.id, { roomCode, role: 'admin', name });

      socket.join(roomCode);
      socket.emit('room-created', { 
        roomCode, 
        room,
        user: { role: 'admin', name, id: socket.id }
      });

      console.log(`Stanza ${roomCode} creata da ${name}`);
    } catch (error) {
      console.error('Errore creazione stanza:', error);
      socket.emit('error', { message: 'Errore nel server' });
    }
  });

  // Unisciti a stanza
  socket.on('join-room', (data) => {
    try {
      const { roomCode, name } = data;
      
      if (!roomCode || !name) {
        socket.emit('error', { message: 'Codice stanza e nome richiesti' });
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());
      if (!room) {
        socket.emit('error', { message: 'Stanza non trovata' });
        return;
      }

      // Controlla se il giocatore esiste già
      let player = room.players.find(p => p.name === name);
      
      if (!player) {
        player = {
          id: socket.id,
          name: name,
          socketId: socket.id,
          cardNumbers: generateCardNumbers(),
          extractedCount: 0,
          hasWon: false,
          joinedAt: new Date().toISOString(),
          lastActivity: Date.now()
        };
        
        room.players.push(player);
      } else {
        // Riconnessione
        player.socketId = socket.id;
        player.lastActivity = Date.now();
      }

      room.updatedAt = new Date().toISOString();
      rooms.set(roomCode, room);
      users.set(socket.id, { roomCode, role: 'player', name });

      socket.join(roomCode);
      socket.emit('room-joined', { 
        room,
        user: { role: 'player', name, id: socket.id, cardNumbers: player.cardNumbers }
      });

      // Notifica tutti nella stanza
      io.to(roomCode).emit('player-joined', {
        player: { name, id: socket.id },
        players: room.players
      });

      console.log(`${name} si è unito alla stanza ${roomCode}`);
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

      // Reset giocatori
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
        socket.emit('error', { message: 'Tutti i numeri estratti' });
        return;
      }

      // Estrai numero
      const extracted = room.game.remainingNumbers.pop();
      room.game.extractedNumbers.push(extracted);
      room.game.lastExtracted = extracted;
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
        room: room
      });

      // Se c'è un vincitore, notifica
      if (room.game.winner) {
        io.to(roomCode).emit('game-won', {
          winner: room.game.winner,
          room: room
        });
      }

      console.log(`Numero ${extracted} estratto nella stanza ${roomCode}`);
    } catch (error) {
      console.error('Errore estrazione numero:', error);
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

  // Disconnessione
  socket.on('disconnect', () => {
    try {
      const user = users.get(socket.id);
      
      if (user) {
        const { roomCode, role, name } = user;
        const room = rooms.get(roomCode);
        
        if (room) {
          if (role === 'admin') {
            // Se l'admin si disconnette, chiudi la stanza dopo 30 secondi
            setTimeout(() => {
              const currentRoom = rooms.get(roomCode);
              if (currentRoom && currentRoom.admin.socketId === socket.id) {
                rooms.delete(roomCode);
                io.to(roomCode).emit('room-closed', { 
                  message: 'La stanza è stata chiusa' 
                });
                console.log(`Stanza ${roomCode} chiusa (admin disconnesso)`);
              }
            }, 30000);
          } else {
            // Rimuovi giocatore
            room.players = room.players.filter(p => p.id !== socket.id);
            rooms.set(roomCode, room);
            
            // Notifica gli altri
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

// Route di fallback - deve venire DOPO tutte le altre route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Avvia il server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server Tombola Python in esecuzione sulla porta ${PORT}`);
  console.log(`📡 WebSocket attivo su ws://localhost:${PORT}`);
  console.log(`🌐 Frontend disponibile su http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
