// Tombola Game Client con WebSocket
class TombolaGame {
  constructor() {
    this.socket = null;
    this.user = null;
    this.room = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.connectToServer();
  }

  connectToServer() {
    // Connetti al server Socket.io (usa URL corrente)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = io(`${protocol}//${host}`);

    // Setup event handlers
    this.setupSocketEvents();
    
    // Check server health
    this.checkServerHealth();
  }

  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Connesso al server WebSocket');
      this.updateConnectionStatus(true);
      this.reconnectAttempts = 0;
      this.showToast('Connesso al server!', 'success');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnesso dal server');
      this.updateConnectionStatus(false);
      this.showToast('Disconnesso, riconnessione in corso...', 'warning');
      this.attemptReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('Errore WebSocket:', error);
      this.showToast(error.message || 'Errore di connessione', 'error');
    });

    this.socket.on('room-created', (data) => {
      this.user = data.user;
      this.room = data.room;
      this.showRoomLobby();
      this.showToast(`Stanza ${data.roomCode} creata!`, 'success');
    });

    this.socket.on('room-joined', (data) => {
      this.user = data.user;
      this.room = data.room;
      this.showGameScreen();
      this.showToast(`Benvenuto ${data.user.name}!`, 'success');
    });

    this.socket.on('player-joined', (data) => {
      if (this.user?.role === 'admin') {
        this.updateLobbyPlayers(data.players);
      }
      this.showToast(`${data.player.name} si è unito!`, 'info');
    });

    this.socket.on('player-left', (data) => {
      if (this.room) {
        this.room.players = data.players;
        this.updatePlayersList();
      }
    });

    this.socket.on('game-started', (data) => {
      this.room = data.room;
      this.showGameScreen();
      this.showToast('Partita iniziata!', 'success');
    });

    this.socket.on('number-extracted', (data) => {
      this.room = data.room;
      this.showNumberPopup(data.number);
      this.updateGameUI();
      this.updateTombolaCard();
    });

    this.socket.on('game-won', (data) => {
      this.room = data.room;
      this.showWinnerModal(data.winner);
      this.showToast(`${data.winner.name} ha vinto! 🎉`, 'success');
    });

    this.socket.on('new-game-started', (data) => {
      this.room = data.room;
      this.updateGameUI();
      this.showToast('Nuova partita iniziata!', 'success');
    });

    this.socket.on('room-closed', (data) => {
      this.showToast(data.message, 'warning');
      setTimeout(() => location.reload(), 2000);
    });

    this.socket.on('pong', (data) => {
      // Keep alive
    });
  }

  setupEventListeners() {
    // Login
    document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
    document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());
    document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
    document.getElementById('copy-room-btn').addEventListener('click', () => this.copyRoomCode());
    document.getElementById('copy-room-game-btn')?.addEventListener('click', () => this.copyRoomCode());
    
    // Game controls
    document.getElementById('extract-btn')?.addEventListener('click', () => this.extractNumber());
    document.getElementById('auto-btn')?.addEventListener('click', () => this.toggleAutoExtract());
    document.getElementById('new-game-btn')?.addEventListener('click', () => this.startNewGame());
    document.getElementById('new-game-modal-btn')?.addEventListener('click', () => this.startNewGame());
    
    // Popup
    document.getElementById('close-popup')?.addEventListener('click', () => this.closePopup());
    document.getElementById('close-winner-modal')?.addEventListener('click', () => this.closeModal('winner-modal'));
    
    // Enter key
    document.getElementById('admin-name')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createRoom();
    });
    
    document.getElementById('room-code-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
    
    document.getElementById('player-name-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
  }

  // Server communication
  createRoom() {
    const name = document.getElementById('admin-name').value.trim() || 'Amministratore';
    this.socket.emit('create-room', { name });
  }

  joinRoom() {
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    const name = document.getElementById('player-name-input').value.trim() || 'Giocatore';
    
    if (!roomCode) {
      this.showToast('Inserisci il codice stanza', 'error');
      return;
    }
    
    this.socket.emit('join-room', { roomCode, name });
  }

  startGame() {
    if (this.user?.role === 'admin' && this.room?.code) {
      this.socket.emit('start-game', { roomCode: this.room.code });
    }
  }

  extractNumber() {
    if (this.user?.role === 'admin' && this.room?.code) {
      this.socket.emit('extract-number', { roomCode: this.room.code });
    }
  }

  startNewGame() {
    if (this.user?.role === 'admin' && this.room?.code) {
      this.socket.emit('new-game', { roomCode: this.room.code });
      this.closeModal('winner-modal');
    }
  }

  copyRoomCode() {
    if (this.room?.code) {
      navigator.clipboard.writeText(this.room.code)
        .then(() => this.showToast('Codice copiato!', 'success'))
        .catch(() => this.showToast('Errore nella copia', 'error'));
    }
  }

  markNumber(number) {
    if (this.user?.role === 'player' && this.room?.code) {
      this.socket.emit('mark-number', { roomCode: this.room.code, number });
    }
  }

  // UI Functions
  showLoginScreen() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('room-lobby').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
  }

  showRoomLobby() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('room-lobby').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    // Update room code
    document.getElementById('room-code-display').textContent = this.room.code;
    
    // Update players list
    this.updateLobbyPlayers(this.room.players);
  }

  showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('room-lobby').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    this.updateGameUI();
  }

  updateGameUI() {
    if (!this.user || !this.room) return;

    // Update user info
    document.getElementById('user-name').textContent = this.user.name;
    document.getElementById('user-role').textContent = this.user.role === 'admin' ? 'Admin' : 'Giocatore';
    document.getElementById('user-role').className = `user-role role-${this.user.role}`;
    document.getElementById('current-room-code').textContent = this.room.code;
    
    // Update stats
    document.getElementById('numbers-left').textContent = this.room.game.remainingNumbers?.length || 90;
    document.getElementById('extracted-count').textContent = this.room.game.extractedNumbers?.length || 0;
    document.getElementById('online-players').textContent = this.room.players?.length || 0;
    document.getElementById('players-count').textContent = this.room.players?.length || 0;
    
    // Update current number
    this.updateCurrentNumber();
    
    // Update recent numbers
    this.updateRecentNumbers();
    
    // Update players list
    this.updatePlayersList();
    
    // Update tombola card
    this.updateTombolaCard();
    
    // Show/hide admin controls
    if (this.user.role === 'admin') {
      document.getElementById('admin-controls').classList.remove('hidden');
      document.getElementById('player-message').classList.add('hidden');
    } else {
      document.getElementById('admin-controls').classList.add('hidden');
      document.getElementById('player-message').classList.remove('hidden');
    }
  }

  updateCurrentNumber() {
    if (this.room?.game?.lastExtracted) {
      document.getElementById('current-number-value').textContent = this.room.game.lastExtracted;
      document.getElementById('no-number').classList.add('hidden');
      document.getElementById('current-number').classList.remove('hidden');
    } else {
      document.getElementById('no-number').classList.remove('hidden');
      document.getElementById('current-number').classList.add('hidden');
    }
  }

  updateRecentNumbers() {
    const container = document.getElementById('recent-numbers');
    container.innerHTML = '';
    
    const numbers = this.room?.game?.extractedNumbers || [];
    const lastNumbers = numbers.slice(-10);
    
    lastNumbers.forEach((num, index) => {
      const bubble = document.createElement('div');
      bubble.className = 'recent-number';
      if (index === lastNumbers.length - 1) {
        bubble.classList.add('recent');
      }
      bubble.textContent = num;
      container.appendChild(bubble);
    });
  }

  updatePlayersList() {
    const container = document.getElementById('players-list');
    const players = this.room?.players || [];
    
    if (players.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Nessun giocatore online</p></div>';
      return;
    }
    
    container.innerHTML = '';
    
    players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      if (this.user?.id === player.id) {
        item.classList.add('active');
      }
      if (player.hasWon) {
        item.classList.add('winner');
      }
      
      item.innerHTML = `
        <div class="player-info">
          <div class="player-avatar">${player.name.charAt(0)}</div>
          <div class="player-details">
            <h4>${player.name}</h4>
            <div class="player-code">${player.id.slice(-6)}</div>
          </div>
        </div>
        <div class="player-score">
          ${player.extractedCount || 0}/15
          ${player.hasWon ? ' 🏆' : ''}
        </div>
      `;
      
      container.appendChild(item);
    });
  }

  updateLobbyPlayers(players) {
    const container = document.getElementById('lobby-players');
    
    if (!players || players.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-user-clock"></i><p>In attesa di giocatori...</p></div>';
      return;
    }
    
    container.innerHTML = '';
    
    players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      
      item.innerHTML = `
        <div class="player-info">
          <div class="player-avatar">${player.name.charAt(0)}</div>
          <div class="player-details">
            <h4>${player.name}</h4>
            <div class="player-code">Giocatore</div>
          </div>
        </div>
        <div class="player-score">Pronto</div>
      `;
      
      container.appendChild(item);
    });
  }

  updateTombolaCard() {
    const container = document.getElementById('tombola-card-grid');
    if (!container || this.user?.role !== 'player') return;
    
    container.innerHTML = '';
    
    const player = this.room?.players?.find(p => p.id === this.user.id);
    if (!player?.cardNumbers) return;
    
    const numbers = player.cardNumbers;
    const extracted = this.room?.game?.extractedNumbers || [];
    
    // Show 15 numbers in a grid
    for (let i = 0; i < 15; i++) {
      if (i >= numbers.length) break;
      
      const num = numbers[i];
      const cell = document.createElement('div');
      cell.className = 'number-cell';
      cell.textContent = num;
      
      if (extracted.includes(num)) {
        cell.classList.add('extracted');
        if (num === this.room?.game?.lastExtracted) {
          cell.classList.add('recent');
        }
      }
      
      // Click to mark/unmark
      cell.addEventListener('click', () => {
        if (extracted.includes(num)) {
          cell.classList.toggle('extracted');
        }
      });
      
      container.appendChild(cell);
    }
    
    // Update score
    const extractedCount = numbers.filter(n => extracted.includes(n)).length;
    document.getElementById('player-score').textContent = `${extractedCount}/15`;
  }

  showNumberPopup(number) {
    document.getElementById('popup-number').textContent = number;
    document.getElementById('number-popup').style.display = 'flex';
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      this.closePopup();
    }, 3000);
  }

  closePopup() {
    document.getElementById('number-popup').style.display = 'none';
  }

  showWinnerModal(player) {
    document.getElementById('winner-name').textContent = player.name;
    document.getElementById('winner-modal-overlay').style.display = 'flex';
  }

  closeModal(modalId) {
    document.getElementById(`${modalId}-overlay`).style.display = 'none';
  }

  toggleAutoExtract() {
    const btn = document.getElementById('auto-btn');
    
    if (this.autoExtractInterval) {
      clearInterval(this.autoExtractInterval);
      this.autoExtractInterval = null;
      btn.innerHTML = '<i class="fas fa-robot"></i> AUTO';
      this.showToast('Auto-estrazione disattivata', 'info');
    } else {
      this.autoExtractInterval = setInterval(() => {
        if (this.user?.role === 'admin') {
          this.extractNumber();
        } else {
          this.toggleAutoExtract();
        }
      }, 2000);
      
      btn.innerHTML = '<i class="fas fa-stop"></i> FERMA';
      this.showToast('Auto-estrazione attivata', 'success');
    }
  }

  updateConnectionStatus(connected) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    const status = document.getElementById('server-status');
    
    if (connected) {
      dot.className = 'connection-dot connected';
      text.textContent = 'Connesso';
      if (status) status.textContent = 'Online';
    } else {
      dot.className = 'connection-dot disconnected';
      text.textContent = 'Disconnesso';
      if (status) status.textContent = 'Offline';
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.socket.connect();
        this.showToast(`Tentativo di riconnessione ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, 'warning');
      }, 3000);
    } else {
      this.showToast('Impossibile riconnettersi. Ricarica la pagina.', 'error');
    }
  }

  checkServerHealth() {
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        console.log('Server health:', data);
        document.getElementById('server-status').textContent = 'Online';
      })
      .catch(error => {
        console.error('Server health check failed:', error);
        document.getElementById('server-status').textContent = 'Offline';
      });
  }

  showToast(message, type = 'info') {
    // Remove existing toasts
    const oldToasts = document.querySelectorAll('.toast');
    oldToasts.forEach(t => t.remove());
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(() => {
          toast.parentNode.removeChild(toast);
        }, 300);
      }
    }, 3000);
    
    // Add exit animation if not exists
    if (!document.querySelector('#toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes toastOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, -20px); }
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Initialize game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new TombolaGame();
});
