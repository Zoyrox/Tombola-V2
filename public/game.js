// game.js - Client Tombola Natalizia
class ChristmasTombola {
  constructor() {
    this.socket = null;
    this.user = null;
    this.room = null;
    this.cardNumbers = [];
    this.isAdmin = false;
    this.isSuperAdmin = false;
    this.sessionToken = null;
    this.autoExtractInterval = null;
    this.autoMarkEnabled = true;
    this.markedNumbers = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    this.init();
  }

  async init() {
    this.createSnowflakes();
    this.setupEventListeners();
    this.initSocket();
    this.showAdminLogin();
    
    // Verifica caricamento font
    await this.loadFonts();
    
    console.log('🎄 Tombola Natalizia inizializzata');
  }

  createSnowflakes() {
    const container = document.createElement('div');
    container.className = 'snowflakes';
    
    for (let i = 0; i < 150; i++) {
      const flake = document.createElement('div');
      flake.className = 'snowflake';
      
      // Posizione casuale
      const left = Math.random() * 100;
      const size = Math.random() * 5 + 2;
      const duration = Math.random() * 10 + 10;
      const delay = Math.random() * 5;
      
      flake.style.left = `${left}vw`;
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.opacity = Math.random() * 0.7 + 0.3;
      flake.style.animationDuration = `${duration}s`;
      flake.style.animationDelay = `${delay}s`;
      
      container.appendChild(flake);
    }
    
    document.body.appendChild(container);
    
    // Aggiungi scintillii
    this.createSparkles();
  }

  createSparkles() {
    const effects = document.createElement('div');
    effects.className = 'christmas-effects';
    
    for (let i = 0; i < 50; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const delay = Math.random() * 2;
      const duration = Math.random() * 1 + 1;
      
      sparkle.style.left = `${left}vw`;
      sparkle.style.top = `${top}vh`;
      sparkle.style.animationDelay = `${delay}s`;
      sparkle.style.animationDuration = `${duration}s`;
      
      effects.appendChild(sparkle);
    }
    
    document.body.appendChild(effects);
  }

  async loadFonts() {
    try {
      // Carica font Christmas
      const font = new FontFace(
        'Mountains of Christmas', 
        'url(https://fonts.gstatic.com/s/mountainsofchristmas/v19/3y9z6b4wkCQ_vW8B_mE2ZRkFhHf7w8C7vU.woff2)'
      );
      
      await font.load();
      document.fonts.add(font);
      
      console.log('🎅 Font natalizio caricato');
    } catch (error) {
      console.warn('Font non caricato, usando fallback:', error);
    }
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
    
    // Enter key shortcuts
    document.getElementById('admin-password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.adminLogin();
    });
    
    document.getElementById('join-room-code-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinRoomAsPlayer();
    });
    
    // Visualizza/riproduce suoni
    document.addEventListener('click', () => {
      this.playSound('click');
    });
  }

  initSocket() {
    console.log('🔌 Inizializzazione Socket.io...');
    
    // Connessione WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: this.sessionToken ? { token: this.sessionToken } : null
    });

    // Event Handlers
    this.socket.on('connect', () => {
      console.log('✅ Connesso al server');
      this.updateConnectionStatus(true);
      this.reconnectAttempts = 0;
      
      // Autentica se abbiamo un token salvato
      const savedToken = localStorage.getItem('tombola_token');
      const savedEmail = localStorage.getItem('tombola_email');
      
      if (savedToken && savedEmail) {
        this.sessionToken = savedToken;
        this.socket.emit('authenticate', { token: savedToken, email: savedEmail });
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Errore connessione:', error);
      this.updateConnectionStatus(false);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.showToast('Impossibile connettersi al server. Ricarica la pagina.', 'error');
      } else {
        this.showToast(`Connessione persa. Tentativo ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`, 'warning');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnesso:', reason);
      this.updateConnectionStatus(false);
      
      if (reason === 'io server disconnect') {
        this.showToast('Disconnesso dal server', 'warning');
        this.socket.connect(); // Riconnessione automatica
      }
    });

    // Auth Events
    this.socket.on('authenticated', (data) => {
      console.log('🔓 Autenticato:', data);
      this.user = data;
      this.isAdmin = ['super_admin', 'admin'].includes(data.role);
      this.isSuperAdmin = data.role === 'super_admin';
      
      this.showAdminDashboard(data);
    });

    this.socket.on('auth-error', (data) => {
      console.error('❌ Errore autenticazione:', data);
      localStorage.removeItem('tombola_token');
      localStorage.removeItem('tombola_email');
      this.showToast('Sessione scaduta. Rieffettua il login.', 'error');
      this.showAdminLogin();
    });

    // Login Events
    this.socket.on('login-success', (data) => {
      console.log('🎉 Login successo:', data);
      
      this.sessionToken = data.token;
      this.user = {
        email: data.email,
        name: data.name,
        role: data.role,
        isSuperAdmin: data.isSuperAdmin
      };
      
      this.isAdmin = ['super_admin', 'admin'].includes(data.role);
      this.isSuperAdmin = data.isSuperAdmin;
      
      // Salva token per future sessioni
      localStorage.setItem('tombola_token', data.token);
      localStorage.setItem('tombola_email', data.email);
      
      this.showAdminDashboard(data);
      this.playSound('success');
      this.showToast(`🎅 Benvenuto ${data.name}!`, 'success');
    });

    this.socket.on('login-error', (data) => {
      console.error('❌ Login fallito:', data);
      this.playSound('error');
      this.showToast(data.message || 'Credenziali non valide', 'error');
    });

    // Admin Creation
    this.socket.on('admin-created', (data) => {
      console.log('👑 Admin creato:', data);
      this.playSound('success');
      this.showToast(`Admin ${data.name} creato con successo!`, 'success');
      this.loadAdminsList();
      
      // Reset form
      document.getElementById('new-admin-email').value = '';
      document.getElementById('new-admin-name').value = '';
      document.getElementById('new-admin-password').value = '';
    });

    // Room Events
    this.socket.on('room-created', (data) => {
      console.log('🚪 Stanza creata:', data);
      
      if (!data.success) {
        this.showToast(data.error || 'Errore creazione stanza', 'error');
        return;
      }
      
      this.room = data.room;
      this.cardNumbers = data.user.cardNumbers || [];
      
      this.showGameScreen();
      this.updateRoomInfo();
      this.generateTombolaCard();
      this.playSound('room-created');
      this.showToast(`🎄 Stanza "${data.room.name}" creata! Codice: ${data.room.code}`, 'success');
    });

    this.socket.on('room-joined', (data) => {
      console.log('🎮 Unito alla stanza:', data);
      
      if (!data.success) {
        this.showToast(data.error || 'Errore join stanza', 'error');
        return;
      }
      
      this.room = data.room;
      this.cardNumbers = data.player.cardNumbers || [];
      this.user = {
        id: data.player.id,
        name: data.player.name,
        role: 'player'
      };
      
      this.showGameScreen();
      this.updateRoomInfo();
      this.generateTombolaCard();
      this.playSound('join');
      this.showToast(`👋 Benvenuto in "${data.room.name}"!`, 'success');
    });

    this.socket.on('player-joined', (data) => {
      console.log('👤 Nuovo giocatore:', data);
      
      if (this.room) {
        this.updatePlayersList();
        this.playSound('player-join');
        this.showToast(`${data.player.name} si è unito alla partita!`, 'info');
      }
    });

    this.socket.on('player-left', (data) => {
      console.log('👋 Giocatore uscito:', data);
      
      if (this.room) {
        this.updatePlayersList();
        this.showToast('Un giocatore ha lasciato la partita', 'info');
      }
    });

    this.socket.on('room-closed', (data) => {
      console.log('🚪 Stanza chiusa:', data);
      this.showToast(data.message || 'Stanza chiusa', 'warning');
      this.showAdminLogin();
      this.playSound('room-closed');
    });

    // Game Events
    this.socket.on('game-started', (data) => {
      console.log('🎮 Gioco iniziato:', data);
      
      if (this.room && this.room.code === data.room.code) {
        this.room = data.room;
        this.resetGameState();
        this.playSound('game-start');
        this.showToast('🎲 Partita iniziata! Buona fortuna!', 'success');
      }
    });

    this.socket.on('number-extracted', (data) => {
      console.log('🎲 Numero estratto:', data);
      
      if (this.room && this.room.code === data.room.code) {
        this.room.game = data.room.game;
        
        // Aggiorna UI
        this.updateCurrentNumber(data.number, data.meaning);
        this.updateRecentNumbers();
        this.updatePlayersList();
        this.updateGameStatus();
        
        // Mostra popup
        this.showNumberPopup(data.number, data.meaning);
        
        // Auto-mark se abilitato
        if (this.autoMarkEnabled && this.cardNumbers.includes(data.number)) {
          this.markNumberOnCard(data.number);
        }
        
        // Controlla progresso
        this.updateProgress();
        
        // Suono
        this.playSound('number-extracted');
      }
    });

    this.socket.on('game-won', (data) => {
      console.log('🏆 Vincitore:', data);
      
      if (this.room && this.room.code === data.roomCode) {
        this.showWinnerPopup(data.winner);
        this.playSound('win');
        
        // Ferma auto-estrazione
        if (this.autoExtractInterval) {
          clearInterval(this.autoExtractInterval);
          this.autoExtractInterval = null;
          this.updateAutoExtractButton(false);
        }
      }
    });

    this.socket.on('new-game-started', (data) => {
      console.log('🔄 Nuova partita:', data);
      
      if (this.room && this.room.code === data.room.code) {
        this.room = data.room;
        this.resetGameState();
        this.playSound('new-game');
        this.showToast('🔄 Nuova partita iniziata!', 'success');
      }
    });

    // Ping/Pong
    this.socket.on('pong', () => {
      // Connessione attiva
    });
  }

  // UI Methods
  showAdminLogin() {
    this.hideAllModals();
    document.getElementById('admin-login-modal').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    // Focus sul campo password
    setTimeout(() => {
      document.getElementById('admin-password').focus();
    }, 100);
  }

  showAdminDashboard(adminData) {
    this.hideAllModals();
    document.getElementById('admin-dashboard-modal').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    // Aggiorna info admin
    document.getElementById('admin-name-display').textContent = adminData.name;
    document.getElementById('admin-type').textContent = adminData.isSuperAdmin ? '🎅 Super Admin' : '👑 Admin';
    
    // Mostra/nascondi tab gestione admin
    const manageBtn = document.getElementById('manage-admins-btn');
    const manageTab = document.getElementById('manage-admins-tab');
    
    if (adminData.isSuperAdmin) {
      manageBtn.style.display = 'flex';
      manageTab.style.display = 'block';
    } else {
      manageBtn.style.display = 'none';
      manageTab.style.display = 'none';
    }
  }

  showGameScreen() {
    console.log('🔄 Mostrando schermo di gioco...');
    
    this.hideAllModals();
    
    const gameScreen = document.getElementById('game-screen');
    gameScreen.classList.remove('hidden');
    gameScreen.style.display = 'flex';
    
    // Mostra/nascondi controlli admin
    const adminControls = document.getElementById('admin-controls-sidebar');
    const playerMessage = document.getElementById('player-message-sidebar');
    
    if (this.user && this.user.role === 'admin') {
      adminControls.classList.remove('hidden');
      playerMessage.classList.add('hidden');
    } else {
      adminControls.classList.add('hidden');
      playerMessage.classList.remove('hidden');
    }
    
    console.log('✅ Schermo gioco visibile');
  }

  showJoinRoomModal() {
    this.hideAllModals();
    document.getElementById('join-room-modal').classList.remove('hidden');
    
    // Focus sul codice stanza
    setTimeout(() => {
      document.getElementById('join-room-code-input').focus();
    }, 100);
  }

  hideJoinRoomModal() {
    document.getElementById('join-room-modal').classList.add('hidden');
    this.showAdminLogin();
  }

  hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    });
  }

  // Admin Methods
  adminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    
    if (!email || !password) {
      this.showToast('Inserisci email e password', 'error');
      return;
    }
    
    this.socket.emit('admin-login', { email, password });
  }

  logoutAdmin() {
    this.isAdmin = false;
    this.isSuperAdmin = false;
    this.user = null;
    this.sessionToken = null;
    
    localStorage.removeItem('tombola_token');
    localStorage.removeItem('tombola_email');
    
    this.showAdminLogin();
    this.showToast('Disconnesso', 'info');
  }

  createRoomAsAdmin() {
    const roomName = document.getElementById('room-name').value.trim() || "Tombola di Natale";
    const maxPlayers = parseInt(document.getElementById('max-players').value) || 20;
    const showNatalMeanings = document.getElementById('show-smorfia').checked;
    const autoMark = document.getElementById('auto-mark').checked;
    
    if (!roomName) {
      this.showToast('Inserisci un nome per la stanza', 'error');
      return;
    }
    
    this.socket.emit('create-room', {
      name: roomName,
      maxPlayers: Math.min(Math.max(2, maxPlayers), 50),
      settings: {
        showNatalMeanings,
        autoMark
      }
    }, (response) => {
      if (!response.success) {
        this.showToast(response.error, 'error');
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
    
    this.socket.emit('create-admin', { email, password, name }, (response) => {
      if (!response.success) {
        this.showToast(response.error, 'error');
      }
    });
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
    
    // Per ora mostra messaggio
    const adminsList = document.getElementById('admins-list');
    adminsList.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <i class="fas fa-users fa-2x" style="margin-bottom: 10px;"></i>
        <p>Gestione admin attivata</p>
        <small>La lista completa viene gestita dal server</small>
      </div>
    `;
  }

  // Game Methods
  joinRoomAsPlayer() {
    const roomCode = document.getElementById('join-room-code-input').value.trim().toUpperCase();
    const playerName = document.getElementById('join-player-name').value.trim() || "Giocatore";
    
    if (!roomCode || roomCode.length !== 6) {
      this.showToast('Codice stanza non valido (6 caratteri)', 'error');
      return;
    }
    
    if (playerName.length < 2 || playerName.length > 20) {
      this.showToast('Nome deve essere tra 2 e 20 caratteri', 'error');
      return;
    }
    
    this.socket.emit('join-room', { roomCode, playerName }, (response) => {
      if (!response.success) {
        this.showToast(response.error, 'error');
      }
    });
  }

  extractNumber() {
    if (!this.room || !this.isAdmin) {
      this.showToast('Non autorizzato', 'error');
      return;
    }
    
    if (!this.room.game || !this.room.game.active) {
      this.showToast('Il gioco non è attivo', 'error');
      return;
    }
    
    this.socket.emit('extract-number', { roomCode: this.room.code }, (response) => {
      if (!response.success) {
        this.showToast(response.error, 'error');
      }
    });
  }

  toggleAutoExtract() {
    const autoBtn = document.getElementById('auto-btn-sidebar');
    
    if (this.autoExtractInterval) {
      // Ferma auto-estrazione
      clearInterval(this.autoExtractInterval);
      this.autoExtractInterval = null;
      this.updateAutoExtractButton(false);
      this.showToast('Auto-estrazione disattivata', 'info');
    } else {
      // Avvia auto-estrazione
      if (!this.room || !this.isAdmin || !this.room.game.active) {
        this.showToast('Non puoi avviare auto-estrazione', 'error');
        return;
      }
      
      this.autoExtractInterval = setInterval(() => {
        if (this.room.game.active && this.room.game.remainingNumbers.length > 0) {
          this.extractNumber();
        } else {
          // Ferma se il gioco è finito
          this.toggleAutoExtract();
        }
      }, 3000); // Ogni 3 secondi
      
      this.updateAutoExtractButton(true);
      this.showToast('Auto-estrazione attivata', 'success');
    }
  }

  updateAutoExtractButton(isActive) {
    const autoBtn = document.getElementById('auto-btn-sidebar');
    if (isActive) {
      autoBtn.innerHTML = '<i class="fas fa-stop"></i> Ferma Auto';
      autoBtn.classList.add('btn-christmas');
      autoBtn.classList.remove('btn-snow');
    } else {
      autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto';
      autoBtn.classList.remove('btn-christmas');
      autoBtn.classList.add('btn-snow');
    }
  }

  startNewGame() {
    if (!this.room || !this.isAdmin) {
      this.showToast('Solo l\'admin può iniziare una nuova partita', 'error');
      return;
    }
    
    if (confirm('Vuoi iniziare una nuova partita? Tutti i progressi andranno persi.')) {
      this.socket.emit('start-game', { roomCode: this.room.code }, (response) => {
        if (!response.success) {
          this.showToast(response.error, 'error');
        }
      });
    }
  }

  toggleAutoMark() {
    this.autoMarkEnabled = !this.autoMarkEnabled;
    const btn = document.getElementById('auto-mark-btn');
    
    if (this.autoMarkEnabled) {
      btn.innerHTML = '<i class="fas fa-toggle-on"></i> Auto-segna ON';
      btn.classList.add('btn-gold');
      this.showToast('Auto-segna attivato', 'success');
    } else {
      btn.innerHTML = '<i class="fas fa-toggle-off"></i> Auto-segna OFF';
      btn.classList.remove('btn-gold');
      this.showToast('Auto-segna disattivato', 'info');
    }
  }

  // UI Update Methods
  updateRoomInfo() {
    if (!this.room) return;
    
    // Room code
    document.getElementById('current-room-code').textContent = this.room.code;
    
    // Room name
    document.querySelector('.user-name').textContent = this.user.name;
    
    // Avatar
    const avatar = document.getElementById('user-avatar');
    if (this.user.role === 'admin') {
      avatar.innerHTML = '<i class="fas fa-crown"></i>';
      avatar.style.background = 'var(--gradient-christmas)';
    } else {
      const initials = this.user.name.substring(0, 2).toUpperCase();
      avatar.textContent = initials;
      avatar.style.background = 'var(--gradient-gold)';
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
      if (this.room && this.room.game && this.room.game.extractedNumbers.includes(number)) {
        cell.classList.add('extracted');
        this.markedNumbers.add(number);
        
        // Se è l'ultimo estratto, evidenzia di più
        if (this.room.game.lastExtracted === number) {
          cell.classList.add('recent');
        }
      }
      
      // Click per segnare manualmente
      cell.addEventListener('click', () => {
        if (this.room && this.room.game && this.room.game.extractedNumbers.includes(number)) {
          cell.classList.toggle('extracted');
          if (cell.classList.contains('extracted')) {
            this.markedNumbers.add(number);
          } else {
            this.markedNumbers.delete(number);
          }
          this.updateProgress();
        }
      });
      
      grid.appendChild(cell);
    }
    
    // Aggiorna progresso
    this.updateProgress();
  }

  updateProgress() {
    if (!this.room || !this.cardNumbers) return;
    
    const extractedCount = this.cardNumbers.filter(num => 
      this.room.game.extractedNumbers.includes(num)
    ).length;
    
    document.getElementById('numbers-found').textContent = extractedCount;
    
    const percentage = (extractedCount / 15) * 100;
    document.getElementById('progress-text').textContent = `${Math.round(percentage)}%`;
    document.getElementById('progress-fill').style.width = `${percentage}%`;
    
    // Aggiorna punteggio utente
    if (this.user.role === 'player') {
      document.getElementById('user-score').textContent = `${extractedCount}/15`;
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
    if (!this.room || !this.room.game) {
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
      
      if (player.id === this.user?.id) item.classList.add('active');
      if (player.hasWon) item.classList.add('winner');
      
      item.innerHTML = `
        <div class="player-info">
          <div class="player-avatar-small">
            ${player.name.substring(0, 2).toUpperCase()}
          </div>
          <div class="player-details-small">
            <h4>${player.name}</h4>
            <div class="player-code-small">${player.id === this.user?.id ? 'Tu' : 'Giocatore'}</div>
          </div>
        </div>
        <div class="player-score-small">${player.extractedCount || 0}/15</div>
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
      status.innerHTML = `<i class="fas fa-play-circle" style="color: var(--christmas-green)"></i><span>Gioco attivo (${remaining} rimasti)</span>`;
    } else if (this.room.game.winner) {
      status.innerHTML = `<i class="fas fa-trophy" style="color: var(--christmas-gold)"></i><span>Vinto da ${this.room.game.winner.name}</span>`;
    } else {
      status.innerHTML = '<i class="fas fa-pause-circle" style="color: var(--text-muted)"></i><span>In attesa...</span>';
    }
  }

  updateConnectionStatus(connected = false) {
    const dot = document.getElementById('connection-dot');
    const text = document.getElementById('connection-text');
    
    if (connected) {
      dot.className = 'connection-dot connected';
      text.textContent = 'Connesso';
      dot.style.background = 'var(--christmas-green)';
    } else {
      dot.className = 'connection-dot disconnected';
      text.textContent = 'Disconnesso';
      dot.style.background = 'var(--christmas-red)';
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
    this.showToast('🎄 Impostazioni - Funzione in sviluppo', 'info');
  }

  // Utility Methods
  markNumberOnCard(number) {
    const cell = document.querySelector(`.number-cell[data-number="${number}"]`);
    if (cell && !cell.classList.contains('extracted')) {
      cell.classList.add('extracted');
      this.markedNumbers.add(number);
      this.updateProgress();
    }
  }

  resetGameState() {
    this.markedNumbers.clear();
    this.generateTombolaCard();
    this.updateCurrentNumber(null, null);
    this.updateRecentNumbers();
    this.updateGameStatus();
    this.updatePlayersList();
    
    // Ferma auto-estrazione se attiva
    if (this.autoExtractInterval) {
      clearInterval(this.autoExtractInterval);
      this.autoExtractInterval = null;
      this.updateAutoExtractButton(false);
    }
  }

  copyRoomCode() {
    if (!this.room) {
      this.showToast('Non sei in una stanza', 'error');
      return;
    }
    
    navigator.clipboard.writeText(this.room.code)
      .then(() => this.showToast('🎄 Codice stanza copiato!', 'success'))
      .catch(() => this.showToast('❌ Errore copia codice', 'error'));
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
      toast.style.animation = 'toastSlideDown 0.3s ease reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  playSound(soundType) {
    // Implementa suoni se necessario
    // Per ora solo logging
    console.log(`🔊 Playing sound: ${soundType}`);
  }
}

// Avvia il gioco quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
  window.christmasTombola = new ChristmasTombola();
  
  // Prevent FOUC
  document.body.style.opacity = '1';
});

// Gestione offline
window.addEventListener('offline', () => {
  if (window.christmasTombola) {
    window.christmasTombola.updateConnectionStatus(false);
  }
});

window.addEventListener('online', () => {
  if (window.christmasTombola) {
    window.christmasTombola.updateConnectionStatus(true);
  }
});
