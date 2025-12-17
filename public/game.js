// game.js - Tombola Python Game Client
class TombolaGame {
  constructor() {
    this.socket = null;
    this.user = null;
    this.room = null;
    this.isAdmin = false;
    this.isSuperAdmin = false;
    this.autoExtractInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.autoMarkEnabled = true;
    this.cardNumbers = [];
    this.markedNumbers = new Set();
    
    // Inizializza subito
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initSocket();
    this.showAdminLoginModal();
    this.updateConnectionStatus();
  }

  setupEventListeners() {
    // Admin Login
    document.getElementById('admin-login-btn').addEventListener('click', () => this.adminLogin());
    document.getElementById('player-mode-btn').addEventListener('click', () => this.showJoinRoomModal());
    document.getElementById('logout-admin-btn').addEventListener('click', () => this.logoutAdmin());
    
    // Admin Dashboard
    document.getElementById('create-room-admin-btn').addEventListener('click', () => this.createRoomAsAdmin());
    document.getElementById('create-admin-btn').addEventListener('click', () => this.createNewAdmin());
    document.getElementById('manage-admins-btn').addEventListener('click', () => this.loadAdminsList());
    
    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchAdminTab(tabName);
      });
    });
    
    // Join Room
    document.getElementById('join-room-btn-bottom').addEventListener('click', () => this.showJoinRoomModal());
    document.getElementById('confirm-join-btn').addEventListener('click', () => this.joinRoomAsPlayer());
    document.getElementById('cancel-join-btn').addEventListener('click', () => this.hideJoinRoomModal());
    
    // Game Controls
    document.getElementById('extract-btn-sidebar').addEventListener('click', () => this.extractNumber());
    document.getElementById('auto-btn-sidebar').addEventListener('click', () => this.toggleAutoExtract());
    document.getElementById('new-game-btn-bottom').addEventListener('click', () => this.startNewGame());
    document.getElementById('copy-code-btn-bottom').addEventListener('click', () => this.copyRoomCode());
    document.getElementById('auto-mark-btn').addEventListener('click', () => this.toggleAutoMark());
    document.getElementById('new-game-popup-btn').addEventListener('click', () => this.startNewGame());
    document.getElementById('settings-btn-bottom').addEventListener('click', () => this.showSettingsModal());
    
    // Popups
    document.getElementById('close-popup-btn').addEventListener('click', () => this.closeNumberPopup());
    document.getElementById('continue-btn').addEventListener('click', () => this.closeWinnerPopup());
    
    // Enter key per login
    document.getElementById('admin-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.adminLogin();
    });
    
    document.getElementById('join-room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoomAsPlayer();
    });
  }

  initSocket() {
    // Connessione a Socket.io
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Socket event handlers
    this.socket.on('connect', () => {
      console.log('Connesso al server');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
      
      // Se abbiamo credenziali salvate, prova login automatico
      const savedSession = localStorage.getItem('admin_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          this.socket.emit('admin-login', {
            email: session.email,
            password: session.password
          });
        } catch (e) {
          localStorage.removeItem('admin_session');
        }
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Errore connessione:', error);
      this.updateConnectionStatus(false);
      this.showToast('Errore di connessione al server', 'error');
      
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.showToast('Impossibile connettersi. Ricarica la pagina.', 'error');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnesso:', reason);
      this.updateConnectionStatus(false);
      if (reason === 'io server disconnect') {
        this.showToast('Disconnesso dal server', 'warning');
      }
    });

    // Admin Events
    this.socket.on('admin-login-success', (data) => {
      this.isAdmin = true;
      this.isSuperAdmin = data.isSuperAdmin;
      this.user = {
        email: data.email,
        name: data.name,
        role: 'admin',
        isSuperAdmin: data.isSuperAdmin
      };
      
      // Salva sessione per future connessioni
      localStorage.setItem('admin_session', JSON.stringify({
        email: data.email,
        password: document.getElementById('admin-password').value
      }));
      
      this.showAdminDashboard(data);
      this.showToast(`Benvenuto Admin ${data.name}!`, 'success');
    });

    this.socket.on('admin-login-error', (data) => {
      this.showToast(data.message || 'Credenziali non valide', 'error');
    });

    this.socket.on('admin-created', (data) => {
      this.showToast(`Admin ${data.name} creato con successo!`, 'success');
      this.loadAdminsList();
      document.getElementById('new-admin-email').value = '';
      document.getElementById('new-admin-name').value = '';
      document.getElementById('new-admin-password').value = '';
    });

    this.socket.on('create-admin-error', (data) => {
      this.showToast(data.message || 'Errore creazione admin', 'error');
    });

    // Room Events
    this.socket.on('room-created', (data) => {
      this.room = data.room;
      this.user = data.user;
      this.cardNumbers = data.user.cardNumbers || [];
      
      this.showGameScreen();
      this.updateRoomInfo();
      this.generateTombolaCard();
      this.showToast(`Stanza ${data.room.code} creata!`, 'success');
    });

    this.socket.on('room-joined', (data) => {
      this.room = data.room;
      this.user = data.user;
      this.cardNumbers = data.user.cardNumbers || [];
      
      this.showGameScreen();
      this.updateRoomInfo();
      this.generateTombolaCard();
      this.showToast(`Unito alla stanza ${data.room.code}!`, 'success');
    });

    this.socket.on('error', (data) => {
      this.showToast(data.message || 'Errore', 'error');
    });

    this.socket.on('player-joined', (data) => {
      if (this.room) {
        this.room.players = data.players;
        this.updatePlayersList();
        this.showToast(`${data.player.name} si è unito alla stanza!`, 'info');
      }
    });

    this.socket.on('player-left', (data) => {
      if (this.room) {
        this.room.players = data.players;
        this.updatePlayersList();
      }
    });

    this.socket.on('room-closed', (data) => {
      this.showToast(data.message || 'Stanza chiusa', 'warning');
      this.showAdminLoginModal();
    });

    // Game Events
    this.socket.on('game-started', (data) => {
      this.room = data.room;
      this.resetGameState();
      this.showToast('Partita iniziata!', 'success');
    });

    this.socket.on('number-extracted', (data) => {
      if (this.room) {
        this.room.game = data.room.game;
        this.updateCurrentNumber(data.number, data.meaning);
        this.updateRecentNumbers();
        this.updatePlayersList();
        this.updateGameStatus();
        
        // Mostra popup del numero
        this.showNumberPopup(data.number, data.meaning);
        
        // Auto-mark se abilitato
        if (this.autoMarkEnabled && this.cardNumbers.includes(data.number)) {
          this.markNumberOnCard(data.number);
        }
        
        // Controlla se abbiamo vinto
        if (this.user.role === 'player' && this.cardNumbers) {
          const extractedCount = this.cardNumbers.filter(num => 
            data.room.game.extractedNumbers.includes(num)
          ).length;
          
          document.getElementById('numbers-found').textContent = extractedCount;
          document.getElementById('progress-text').textContent = `${Math.round((extractedCount / 15) * 100)}%`;
          document.getElementById('progress-fill').style.width = `${(extractedCount / 15) * 100}%`;
          
          if (extractedCount === 15) {
            this.showToast('🎉 HAI VINTO! TOMBOLA COMPLETATA! 🎉', 'success');
          }
        }
      }
    });

    this.socket.on('game-won', (data) => {
      this.room = data.room;
      this.showWinnerPopup(data.winner);
      if (this.autoExtractInterval) {
        clearInterval(this.autoExtractInterval);
        this.autoExtractInterval = null;
      }
    });

    this.socket.on('new-game-started', (data) => {
      this.room = data.room;
      this.resetGameState();
      this.showToast('Nuova partita iniziata!', 'success');
    });

    this.socket.on('number-marked', (data) => {
      // Conferma segnatura numero
    });

    // Keep alive
    this.socket.on('pong', (data) => {
      // Ping risposto
    });
  }

  // UI Methods
  showAdminLoginModal() {
    this.hideAllModals();
    document.getElementById('admin-login-modal').classList.remove('hidden');
  }

  showAdminDashboard(adminData) {
    this.hideAllModals();
    document.getElementById('admin-dashboard-modal').classList.remove('hidden');
    
    // Aggiorna info admin
    document.getElementById('admin-name-display').textContent = adminData.name;
    document.getElementById('admin-type').textContent = adminData.isSuperAdmin ? 'Super Admin' : 'Admin';
    
    // Mostra/nascondi tab gestione admin
    const manageBtn = document.getElementById('manage-admins-btn');
    if (adminData.isSuperAdmin) {
      manageBtn.style.display = 'flex';
    } else {
      manageBtn.style.display = 'none';
    }
  }

  showGameScreen() {
    this.hideAllModals();
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Mostra/nascondi controlli admin
    const adminControls = document.getElementById('admin-controls-sidebar');
    const playerMessage = document.getElementById('player-message-sidebar');
    
    if (this.user.role === 'admin') {
      adminControls.classList.remove('hidden');
      playerMessage.classList.add('hidden');
    } else {
      adminControls.classList.add('hidden');
      playerMessage.classList.remove('hidden');
    }
  }

  showJoinRoomModal() {
    this.hideAllModals();
    document.getElementById('join-room-modal').classList.remove('hidden');
  }

  hideJoinRoomModal() {
    document.getElementById('join-room-modal').classList.add('hidden');
    this.showAdminLoginModal();
  }

  hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  // Admin Methods
  adminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    
    if (!email || !password) {
      this.showToast('Email e password richieste', 'error');
      return;
    }
    
    this.socket.emit('admin-login', { email, password });
  }

  logoutAdmin() {
    this.isAdmin = false;
    this.isSuperAdmin = false;
    this.user = null;
    localStorage.removeItem('admin_session');
    this.showAdminLoginModal();
    this.showToast('Disconnesso', 'info');
  }

  createRoomAsAdmin() {
    const roomName = document.getElementById('room-name').value.trim();
    const maxPlayers = parseInt(document.getElementById('max-players').value);
    const showSmorfia = document.getElementById('show-smorfia').checked;
    const autoMark = document.getElementById('auto-mark').checked;
    
    if (!roomName) {
      this.showToast('Inserisci un nome per la stanza', 'error');
      return;
    }
    
    this.socket.emit('create-room', {
      name: roomName,
      maxPlayers: maxPlayers || 20,
      settings: {
        showSmorfia,
        autoMark
      }
    });
  }

  createNewAdmin() {
    if (!this.isSuperAdmin) {
      this.showToast('Solo il Super Admin può creare nuovi admin', 'error');
      return;
    }
    
    const email = document.getElementById('new-admin-email').value.trim();
    const name = document.getElementById('new-admin-name').value.trim();
    const password = document.getElementById('new-admin-password').value.trim();
    
    if (!email || !password) {
      this.showToast('Email e password richieste', 'error');
      return;
    }
    
    if (!email.includes('@')) {
      this.showToast('Email non valida', 'error');
      return;
    }
    
    if (password.length < 6) {
      this.showToast('Password troppo corta (min 6 caratteri)', 'error');
      return;
    }
    
    this.socket.emit('create-admin', { email, password, name });
  }

  switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) btn.classList.add('active');
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      content.classList.add('hidden');
    });
    
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) {
      activeTab.classList.remove('hidden');
      activeTab.classList.add('active');
    }
  }

  async loadAdminsList() {
    if (!this.isSuperAdmin) return;
    
    // Per ora mostra solo mock data
    const adminsList = document.getElementById('admins-list');
    adminsList.innerHTML = `
      <div style="color: var(--text-secondary); padding: 20px; text-align: center;">
        <i class="fas fa-users"></i>
        <p>Lista admin verrà caricata dal server</p>
      </div>
    `;
  }

  // Game Methods
  joinRoomAsPlayer() {
    const roomCode = document.getElementById('join-room-code-input').value.trim().toUpperCase();
    const playerName = document.getElementById('join-player-name').value.trim();
    
    if (!roomCode || roomCode.length !== 6) {
      this.showToast('Codice stanza non valido (6 caratteri)', 'error');
      return;
    }
    
    if (!playerName || playerName.length < 2) {
      this.showToast('Inserisci un nome valido', 'error');
      return;
    }
    
    this.socket.emit('join-room', { roomCode, playerName });
  }

  extractNumber() {
    if (!this.room || !this.isAdmin) {
      this.showToast('Non autorizzato', 'error');
      return;
    }
    
    if (!this.room.game.active) {
      this.showToast('Il gioco non è attivo', 'error');
      return;
    }
    
    this.socket.emit('extract-number', { roomCode: this.room.code });
  }

  toggleAutoExtract() {
    const autoBtn = document.getElementById('auto-btn-sidebar');
    
    if (this.autoExtractInterval) {
      clearInterval(this.autoExtractInterval);
      this.autoExtractInterval = null;
      autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto';
      autoBtn.classList.remove('btn-extract');
      autoBtn.classList.add('btn-auto');
      this.showToast('Auto-estrazione disattivata', 'info');
    } else {
      if (!this.room || !this.isAdmin || !this.room.game.active) {
        this.showToast('Non puoi avviare auto-estrazione', 'error');
        return;
      }
      
      this.autoExtractInterval = setInterval(() => {
        if (this.room.game.active && this.room.game.remainingNumbers.length > 0) {
          this.extractNumber();
        } else {
          this.toggleAutoExtract(); // Disattiva se finito
        }
      }, 3000); // Ogni 3 secondi
      
      autoBtn.innerHTML = '<i class="fas fa-stop"></i> Ferma';
      autoBtn.classList.remove('btn-auto');
      autoBtn.classList.add('btn-extract');
      this.showToast('Auto-estrazione attivata', 'success');
    }
  }

  startNewGame() {
    if (!this.room || !this.isAdmin) {
      this.showToast('Solo l\'admin può iniziare una nuova partita', 'error');
      return;
    }
    
    if (confirm('Vuoi iniziare una nuova partita? Tutti i progressi andranno persi.')) {
      this.socket.emit('new-game', { roomCode: this.room.code });
    }
  }

  toggleAutoMark() {
    this.autoMarkEnabled = !this.autoMarkEnabled;
    const btn = document.getElementById('auto-mark-btn');
    if (this.autoMarkEnabled) {
      btn.innerHTML = '<i class="fas fa-toggle-on"></i> Auto-segna ON';
      btn.classList.add('btn-success');
      this.showToast('Auto-segna attivato', 'success');
    } else {
      btn.innerHTML = '<i class="fas fa-toggle-off"></i> Auto-segna OFF';
      btn.classList.remove('btn-success');
      this.showToast('Auto-segna disattivato', 'info');
    }
  }

  // UI Update Methods
  updateRoomInfo() {
    if (!this.room) return;
    
    // Room code
    document.getElementById('current-room-code').textContent = this.room.code;
    
    // Room name in title
    document.querySelector('.user-name').textContent = this.user.name;
    
    // Avatar
    const avatar = document.getElementById('user-avatar');
    if (this.user.role === 'admin') {
      avatar.innerHTML = '<i class="fas fa-crown"></i>';
      avatar.style.background = 'var(--gradient-accent)';
    } else {
      avatar.innerHTML = '<i class="fas fa-user"></i>';
      avatar.style.background = 'var(--gradient-primary)';
    }
    
    // Score
    if (this.user.role === 'player' && this.cardNumbers) {
      const extractedCount = this.cardNumbers.filter(num => 
        this.room.game.extractedNumbers.includes(num)
      ).length;
      document.getElementById('user-score').textContent = `${extractedCount}/15`;
    }
  }

  generateTombolaCard() {
    const grid = document.getElementById('tombola-card-grid');
    grid.innerHTML = '';
    
    if (!this.cardNumbers || this.cardNumbers.length === 0) {
      // Mostra cartella vuota
      for (let i = 0; i < 15; i++) {
        const cell = document.createElement('div');
        cell.className = 'number-cell';
        cell.textContent = '?';
        grid.appendChild(cell);
      }
      return;
    }
    
    // Ordina numeri
    const sortedNumbers = [...this.cardNumbers].sort((a, b) => a - b);
    
    // Crea 15 celle (3 righe x 5 colonne)
    for (let i = 0; i < 15; i++) {
      const cell = document.createElement('div');
      const number = sortedNumbers[i];
      
      cell.className = 'number-cell';
      cell.textContent = number;
      cell.dataset.number = number;
      
      // Se il numero è stato estratto, evidenzia
      if (this.room && this.room.game.extractedNumbers.includes(number)) {
        cell.classList.add('extracted');
        this.markedNumbers.add(number);
        
        // Se è l'ultimo estratto, evidenzia di più
        if (this.room.game.lastExtracted === number) {
          cell.classList.add('recent');
        }
      }
      
      // Click per segnare manualmente
      cell.addEventListener('click', () => {
        if (this.room && this.room.game.extractedNumbers.includes(number)) {
          cell.classList.toggle('extracted');
          if (cell.classList.contains('extracted')) {
            this.markedNumbers.add(number);
          } else {
            this.markedNumbers.delete(number);
          }
        }
      });
      
      grid.appendChild(cell);
    }
    
    // Aggiorna conteggio
    if (this.room) {
      const extractedCount = sortedNumbers.filter(num => 
        this.room.game.extractedNumbers.includes(num)
      ).length;
      
      document.getElementById('numbers-found').textContent = extractedCount;
      document.getElementById('progress-text').textContent = `${Math.round((extractedCount / 15) * 100)}%`;
      document.getElementById('progress-fill').style.width = `${(extractedCount / 15) * 100}%`;
    }
  }

  updateCurrentNumber(number, meaning) {
    const numberValue = document.getElementById('current-number-value');
    const numberMeaning = document.getElementById('number-meaning');
    
    if (number) {
      numberValue.textContent = number;
      numberMeaning.innerHTML = `<i class="fas fa-quote-left"></i><span>${meaning}</span>`;
    } else {
      numberValue.textContent = '-';
      numberMeaning.innerHTML = '<i class="fas fa-quote-left"></i><span>In attesa dell\'estrazione...</span>';
    }
  }

  updateRecentNumbers() {
    const grid = document.getElementById('recent-numbers-grid');
    if (!this.room || !this.room.game.extractedNumbers) {
      grid.innerHTML = '';
      return;
    }
    
    grid.innerHTML = '';
    const recentNumbers = this.room.game.extractedNumbers.slice(-10).reverse();
    
    recentNumbers.forEach((num, index) => {
      const cell = document.createElement('div');
      cell.className = 'recent-number';
      if (index === 0) cell.classList.add('recent');
      cell.textContent = num;
      grid.appendChild(cell);
    });
  }

  updatePlayersList() {
    const list = document.getElementById('players-list-sidebar');
    const count = document.getElementById('players-count');
    
    if (!this.room || !this.room.players) {
      list.innerHTML = '';
      count.textContent = '0';
      return;
    }
    
    list.innerHTML = '';
    count.textContent = this.room.players.length;
    
    this.room.players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      if (player.id === this.socket.id) item.classList.add('active');
      if (player.hasWon) item.classList.add('winner');
      
      const extractedCount = player.cardNumbers?.filter(num => 
        this.room.game.extractedNumbers.includes(num)
      ).length || 0;
      
      item.innerHTML = `
        <div class="player-info">
          <div class="player-avatar-small">
            ${player.name.charAt(0).toUpperCase()}
          </div>
          <div class="player-details-small">
            <h4>${player.name}</h4>
            <div class="player-code-small">${player.id === this.socket.id ? 'Tu' : 'Giocatore'}</div>
          </div>
        </div>
        <div class="player-score-small">${extractedCount}/15</div>
      `;
      
      list.appendChild(item);
    });
  }

  updateGameStatus() {
    const status = document.getElementById('game-status');
    if (!this.room) {
      status.innerHTML = '<i class="fas fa-circle"></i><span>In attesa...</span>';
      return;
    }
    
    if (this.room.game.active) {
      const remaining = this.room.game.remainingNumbers.length;
      status.innerHTML = `<i class="fas fa-circle" style="color: var(--success)"></i><span>Gioco attivo (${remaining} rimasti)</span>`;
    } else if (this.room.game.winner) {
      status.innerHTML = `<i class="fas fa-trophy" style="color: var(--warning)"></i><span>Vinto da ${this.room.game.winner.name}</span>`;
    } else {
      status.innerHTML = '<i class="fas fa-circle"></i><span>In attesa...</span>';
    }
  }

  updateConnectionStatus(connected = false) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    
    if (connected) {
      dot.className = 'connection-dot connected';
      text.textContent = 'Connesso';
    } else {
      dot.className = 'connection-dot disconnected';
      text.textContent = 'Disconnesso';
    }
  }

  // Popup Methods
  showNumberPopup(number, meaning) {
    document.getElementById('popup-number-value').textContent = number;
    document.getElementById('popup-number-meaning').textContent = meaning;
    document.getElementById('number-popup').classList.remove('hidden');
    
    // Auto-close dopo 5 secondi
    setTimeout(() => {
      if (!document.getElementById('number-popup').classList.contains('hidden')) {
        this.closeNumberPopup();
      }
    }, 5000);
  }

  closeNumberPopup() {
    document.getElementById('number-popup').classList.add('hidden');
  }

  showWinnerPopup(winner) {
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-popup').classList.remove('hidden');
  }

  closeWinnerPopup() {
    document.getElementById('winner-popup').classList.add('hidden');
  }

  showSettingsModal() {
    // Implementa se necessario
    this.showToast('Impostazioni - Funzione in sviluppo', 'info');
  }

  // Utility Methods
  markNumberOnCard(number) {
    const cell = document.querySelector(`.number-cell[data-number="${number}"]`);
    if (cell && !cell.classList.contains('extracted')) {
      cell.classList.add('extracted');
      this.markedNumbers.add(number);
      
      // Aggiorna conteggio
      const current = parseInt(document.getElementById('numbers-found').textContent);
      document.getElementById('numbers-found').textContent = current + 1;
      
      const newPercent = ((current + 1) / 15) * 100;
      document.getElementById('progress-text').textContent = `${Math.round(newPercent)}%`;
      document.getElementById('progress-fill').style.width = `${newPercent}%`;
    }
  }

  resetGameState() {
    this.markedNumbers.clear();
    this.generateTombolaCard();
    this.updateCurrentNumber(null, null);
    this.updateRecentNumbers();
    this.updateGameStatus();
    this.updatePlayersList();
    
    // Reset progress
    document.getElementById('numbers-found').textContent = '0';
    document.getElementById('progress-text').textContent = '0%';
    document.getElementById('progress-fill').style.width = '0%';
    
    // Ferma auto-estrazione se attiva
    if (this.autoExtractInterval) {
      clearInterval(this.autoExtractInterval);
      this.autoExtractInterval = null;
      const autoBtn = document.getElementById('auto-btn-sidebar');
      autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto';
      autoBtn.classList.remove('btn-extract');
      autoBtn.classList.add('btn-auto');
    }
  }

  copyRoomCode() {
    if (!this.room) {
      this.showToast('Non sei in una stanza', 'error');
      return;
    }
    
    navigator.clipboard.writeText(this.room.code)
      .then(() => this.showToast('Codice stanza copiato!', 'success'))
      .catch(() => this.showToast('Errore copia codice', 'error'));
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
      <i class="${icons[type] || 'fas fa-info-circle'}"></i>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Rimuovi dopo 5 secondi
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

// Avvia il gioco quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
  window.tombolaGame = new TombolaGame();
});

// Prevent FOUC
document.body.style.opacity = '0';
window.addEventListener('DOMContentLoaded', () => {
  document.body.style.transition = 'opacity 0.3s';
  document.body.style.opacity = '1';
});

// PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
