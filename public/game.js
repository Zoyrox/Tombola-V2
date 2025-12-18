// Tombola Game Client
class TombolaGame {
    constructor() {
        this.socket = null;
        this.user = null;
        this.room = null;
        this.cardNumbers = [];
        this.isAdmin = false;
        this.isSuperAdmin = false;
        this.autoExtractInterval = null;
        this.autoMarkEnabled = true;
        
        console.log('🎯 Inizializzazione Tombola...');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initSocket();
        this.showAdminLogin();
    }

    setupEventListeners() {
        // Admin Login
        document.getElementById('admin-login-btn').addEventListener('click', () => this.adminLogin());
        document.getElementById('player-mode-btn').addEventListener('click', () => this.showJoinRoomModal());
        document.getElementById('logout-admin-btn').addEventListener('click', () => this.logoutAdmin());
        
        // Admin Dashboard
        document.getElementById('create-room-admin-btn').addEventListener('click', () => this.createRoomAsAdmin());
        document.getElementById('create-admin-btn').addEventListener('click', () => this.createNewAdmin());
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchAdminTab(e.currentTarget.dataset.tab);
            });
        });
        
        // Join Room
        document.getElementById('confirm-join-btn').addEventListener('click', () => this.joinRoomAsPlayer());
        document.getElementById('cancel-join-btn').addEventListener('click', () => this.hideJoinRoomModal());
        
        // Game Controls
        document.getElementById('extract-btn-sidebar').addEventListener('click', () => this.extractNumber());
        document.getElementById('auto-btn-sidebar').addEventListener('click', () => this.toggleAutoExtract());
        document.getElementById('auto-mark-btn').addEventListener('click', () => this.toggleAutoMark());
        document.getElementById('copy-code-btn-bottom').addEventListener('click', () => this.copyRoomCode());
        
        // Popups
        document.getElementById('close-popup-btn').addEventListener('click', () => this.closeNumberPopup());
        document.getElementById('continue-btn').addEventListener('click', () => this.closeWinnerPopup());
        
        // Keyboard shortcuts
        document.getElementById('admin-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.adminLogin();
        });
        
        document.getElementById('join-room-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoomAsPlayer();
        });
    }

    initSocket() {
        console.log('🔌 Connessione al server...');
        
        this.socket = io();
        
        // Event handlers
        this.socket.on('connect', () => {
            console.log('✅ Connesso al server');
            this.showToast('Connesso al server', 'success');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Errore connessione:', error);
            this.showToast('Errore di connessione al server', 'error');
        });
        
        // Login Events
        this.socket.on('login-success', (data) => {
            console.log('🔓 Login successo:', data);
            
            this.user = {
                email: data.email,
                name: data.name,
                role: data.role,
                isSuperAdmin: data.isSuperAdmin
            };
            
            this.isAdmin = ['super_admin', 'admin'].includes(data.role);
            this.isSuperAdmin = data.isSuperAdmin;
            
            this.showAdminDashboard(data);
            this.showToast(`Benvenuto ${data.name}!`, 'success');
        });
        
        this.socket.on('login-error', (data) => {
            console.error('❌ Login fallito:', data);
            this.showToast(data.message || 'Credenziali non valide', 'error');
        });
        
        // Admin Creation
        this.socket.on('admin-created', (data) => {
            if (data.success) {
                this.showToast(`Admin ${data.name} creato con successo!`, 'success');
                // Reset form
                document.getElementById('new-admin-email').value = '';
                document.getElementById('new-admin-name').value = '';
                document.getElementById('new-admin-password').value = '';
            } else {
                this.showToast(data.error || 'Errore creazione admin', 'error');
            }
        });
        
        // Room Events
        this.socket.on('room-created', (data) => {
            console.log('🚪 Stanza creata:', data);
            
            if (!data.success) {
                this.showToast(data.error || 'Errore creazione stanza', 'error');
                return;
            }
            
            this.room = data.room;
            this.showGameScreen();
            this.updateRoomInfo();
            this.generateTombolaCard();
            this.showToast(`Stanza "${data.room.name}" creata! Codice: ${data.room.code}`, 'success');
        });
        
        this.socket.on('room-joined', (data) => {
            console.log('🎮 Unito alla stanza:', data);
            
            if (!data.success) {
                this.showToast(data.error || 'Errore join stanza', 'error');
                return;
            }
            
            this.room = data.room;
            this.cardNumbers = data.player.cardNumbers;
            this.user = {
                id: data.player.id,
                name: data.player.name,
                role: 'player'
            };
            
            this.showGameScreen();
            this.updateRoomInfo();
            this.generateTombolaCard();
            this.showToast(`Benvenuto in "${data.room.name}"!`, 'success');
        });
        
        this.socket.on('player-joined', (data) => {
            console.log('👤 Nuovo giocatore:', data);
            
            if (this.room) {
                this.updatePlayersList();
                this.showToast(`${data.player.name} si è unito!`, 'info');
            }
        });
        
        this.socket.on('player-left', (data) => {
            console.log('👋 Giocatore uscito');
            
            if (this.room) {
                this.updatePlayersList();
            }
        });
        
        this.socket.on('room-closed', (data) => {
            console.log('🚪 Stanza chiusa');
            this.showToast(data.message || 'Stanza chiusa', 'warning');
            this.showAdminLogin();
        });
        
        // Game Events
        this.socket.on('game-started', (data) => {
            console.log('🎮 Gioco iniziato:', data);
            
            if (this.room && this.room.code === data.room.code) {
                this.room = data.room;
                this.resetGameState();
                this.showToast('Partita iniziata! Buona fortuna!', 'success');
            }
        });
        
        this.socket.on('number-extracted', (data) => {
            console.log('🎲 Numero estratto:', data.number);
            
            if (this.room && this.room.code === data.room.code) {
                this.room.game = data.room.game;
                
                this.updateCurrentNumber(data.number, data.meaning);
                this.updateRecentNumbers();
                this.updatePlayersList();
                this.showNumberPopup(data.number, data.meaning);
                
                if (this.autoMarkEnabled && this.cardNumbers.includes(data.number)) {
                    this.markNumberOnCard(data.number);
                }
                
                this.updateProgress();
            }
        });
        
        this.socket.on('game-won', (data) => {
            console.log('🏆 Vincitore:', data.winner);
            
            if (this.room && this.room.code === data.roomCode) {
                this.showWinnerPopup(data.winner);
                
                if (this.autoExtractInterval) {
                    clearInterval(this.autoExtractInterval);
                    this.autoExtractInterval = null;
                    this.updateAutoExtractButton(false);
                }
            }
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
        document.getElementById('admin-type').textContent = adminData.isSuperAdmin ? 'Super Admin' : 'Admin';
        
        // Mostra/nascondi tab gestione admin
        const manageTab = document.getElementById('manage-admins-tab');
        if (adminData.isSuperAdmin) {
            manageTab.style.display = 'block';
        } else {
            manageTab.style.display = 'none';
        }
    }

    showGameScreen() {
        console.log('🔄 Mostrando schermo di gioco...');
        
        this.hideAllModals();
        document.getElementById('game-screen').classList.remove('hidden');
        
        // Mostra/nascondi controlli admin
        const adminControls = document.getElementById('admin-controls-sidebar');
        const playerMessage = document.getElementById('player-message-sidebar');
        
        if (this.isAdmin) {
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
        
        // Focus sul codice stanza
        setTimeout(() => {
            document.getElementById('join-room-code-input').focus();
        }, 100);
    }

    hideJoinRoomModal() {
        document.getElementById('join-room-modal').classList.add('hidden');
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
        
        const numberPopup = document.getElementById('number-popup');
        const winnerPopup = document.getElementById('winner-popup');
        
        if (numberPopup) numberPopup.classList.add('hidden');
        if (winnerPopup) winnerPopup.classList.add('hidden');
    }

    // Admin Methods
    adminLogin() {
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-password').value.trim();
        
        if (!email || !password) {
            this.showToast('Inserisci email e password', 'error');
            return;
        }
        
        console.log('🔑 Invio credenziali al server...');
        this.socket.emit('admin-login', { email, password });
    }

    logoutAdmin() {
        this.isAdmin = false;
        this.isSuperAdmin = false;
        this.user = null;
        
        this.showAdminLogin();
        this.showToast('Disconnesso', 'info');
    }

    createRoomAsAdmin() {
        const roomName = document.getElementById('room-name').value.trim() || "Tombola Python";
        const maxPlayers = parseInt(document.getElementById('max-players').value) || 20;
        const showSmorfia = document.getElementById('show-smorfia').checked;
        const autoMark = document.getElementById('auto-mark').checked;
        
        if (!roomName) {
            this.showToast('Inserisci un nome per la stanza', 'error');
            return;
        }
        
        console.log('🚪 Creazione stanza:', roomName);
        
        this.socket.emit('create-room', {
            name: roomName,
            maxPlayers: Math.min(Math.max(2, maxPlayers), 50),
            settings: { showSmorfia, autoMark }
        }, (response) => {
            if (!response.success) {
                this.showToast(response.error || 'Errore creazione stanza', 'error');
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
        
        console.log('👑 Creazione nuovo admin:', email);
        
        this.socket.emit('create-admin', { email, password, name }, (response) => {
            if (!response.success) {
                this.showToast(response.error || 'Errore creazione admin', 'error');
            } else {
                this.showToast(`Admin ${response.name} creato con successo!`, 'success');
                // Reset form
                document.getElementById('new-admin-email').value = '';
                document.getElementById('new-admin-name').value = '';
                document.getElementById('new-admin-password').value = '';
            }
        });
    }

    switchAdminTab(tabName) {
        console.log('📁 Cambio tab a:', tabName);
        
        // Aggiorna tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Aggiorna tab content
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
        
        console.log('👤 Unione a stanza:', roomCode);
        
        this.socket.emit('join-room', { roomCode, playerName }, (response) => {
            if (!response.success) {
                this.showToast(response.error || 'Errore join stanza', 'error');
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
        
        console.log('🎲 Estrazione numero...');
        
        this.socket.emit('extract-number', { roomCode: this.room.code }, (response) => {
            if (!response.success) {
                this.showToast(response.error || 'Errore estrazione', 'error');
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
            }, 3000);
            
            this.updateAutoExtractButton(true);
            this.showToast('Auto-estrazione attivata', 'success');
        }
    }

    updateAutoExtractButton(isActive) {
        const autoBtn = document.getElementById('auto-btn-sidebar');
        if (isActive) {
            autoBtn.innerHTML = '<i class="fas fa-stop"></i> Ferma Auto';
            autoBtn.classList.add('btn-danger');
            autoBtn.classList.remove('btn-secondary');
        } else {
            autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto';
            autoBtn.classList.remove('btn-danger');
            autoBtn.classList.add('btn-secondary');
        }
    }

    toggleAutoMark() {
        this.autoMarkEnabled = !this.autoMarkEnabled;
        const btn = document.getElementById('auto-mark-btn');
        
        if (this.autoMarkEnabled) {
            btn.innerHTML = '<i class="fas fa-toggle-on"></i> Auto ON';
            btn.classList.add('btn-success');
            this.showToast('Auto-segna attivato', 'success');
        } else {
            btn.innerHTML = '<i class="fas fa-toggle-off"></i> Auto OFF';
            btn.classList.remove('btn-success');
            this.showToast('Auto-segna disattivato', 'info');
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

    // UI Updates
    updateRoomInfo() {
        if (!this.room) return;
        
        // Room code
        document.getElementById('current-room-code').textContent = this.room.code;
        
        // User name
        document.getElementById('user-name').textContent = this.user.name;
        
        // Avatar
        const avatar = document.getElementById('user-avatar');
        if (this.isAdmin) {
            avatar.innerHTML = '<i class="fas fa-crown"></i>';
        } else {
            const initials = this.user.name.substring(0, 2).toUpperCase();
            avatar.textContent = initials;
        }
    }

    generateTombolaCard() {
        const grid = document.getElementById('tombola-card-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (!this.cardNumbers || this.cardNumbers.length === 0) {
            // Cartella vuota per debug
            for (let i = 0; i < 15; i++) {
                const cell = document.createElement('div');
                cell.className = 'number-cell';
                cell.textContent = i + 1;
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
            if (this.room?.game?.extractedNumbers.includes(number)) {
                cell.classList.add('extracted');
                
                // Se è l'ultimo estratto, evidenzia di più
                if (this.room.game.lastExtracted === number) {
                    cell.classList.add('recent');
                }
            }
            
            // Click per segnare manualmente
            cell.addEventListener('click', () => {
                if (this.room?.game?.extractedNumbers.includes(number)) {
                    cell.classList.toggle('extracted');
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
        
        if (numberValue) {
            numberValue.textContent = number || '-';
        }
        
        if (numberMeaning) {
            const span = numberMeaning.querySelector('span');
            if (span) {
                span.textContent = meaning || 'In attesa dell\'estrazione...';
            }
        }
    }

    updateRecentNumbers() {
        const grid = document.getElementById('recent-numbers-grid');
        if (!grid || !this.room?.game) return;
        
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
        
        if (!list || !count || !this.room) return;
        
        list.innerHTML = '';
        count.textContent = this.room.players.length;
        
        this.room.players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'player-item';
            
            if (player.id === this.user?.id) item.classList.add('active');
            if (player.hasWon) item.classList.add('winner');
            
            item.innerHTML = `
                <div class="player-info">
                    <div class="player-avatar-sm">${player.name.substring(0, 2).toUpperCase()}</div>
                    <div class="player-details-sm">
                        <h4>${player.name}</h4>
                        <span>${player.id === this.user?.id ? 'Tu' : 'Giocatore'}</span>
                    </div>
                </div>
                <div class="player-score-sm">${player.extractedCount || 0}/15</div>
            `;
            
            list.appendChild(item);
        });
    }

    // Popups
    showNumberPopup(number, meaning) {
        document.getElementById('popup-number-value').textContent = number;
        document.getElementById('popup-number-meaning').textContent = meaning;
        document.getElementById('number-popup').classList.remove('hidden');
        
        // Auto-close dopo 5 secondi
        setTimeout(() => {
            this.closeNumberPopup();
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

    // Utilities
    markNumberOnCard(number) {
        const cell = document.querySelector(`.number-cell[data-number="${number}"]`);
        if (cell && !cell.classList.contains('extracted')) {
            cell.classList.add('extracted');
            this.updateProgress();
        }
    }

    resetGameState() {
        this.generateTombolaCard();
        this.updateCurrentNumber(null, null);
        this.updateRecentNumbers();
        this.updatePlayersList();
        
        // Ferma auto-estrazione se attiva
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
            this.updateAutoExtractButton(false);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
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
            toast.style.animation = 'slideIn 0.3s ease reverse forwards';
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
}

// Avvia il gioco quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM caricato, avvio Tombola...');
    window.tombolaGame = new TombolaGame();
});
