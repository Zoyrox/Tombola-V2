// game.js - Tombola Online
class TombolaGame {
    constructor() {
        this.socket = null;
        this.user = null;
        this.room = null;
        this.cardNumbers = [];
        this.isAdmin = false;
        this.sessionToken = null;
        this.autoExtractInterval = null;
        this.autoMarkEnabled = true;
        
        this.init();
    }

    init() {
        console.log('🎯 Inizializzazione Tombola...');
        
        this.setupEventListeners();
        this.initSocket();
        
        // Mostra login admin di default
        setTimeout(() => {
            this.showAdminLogin();
        }, 100);
    }

    setupEventListeners() {
        // Admin Login
        document.getElementById('admin-login-btn')?.addEventListener('click', () => this.adminLogin());
        document.getElementById('player-mode-btn')?.addEventListener('click', () => this.showJoinRoomModal());
        document.getElementById('logout-admin-btn')?.addEventListener('click', () => this.logoutAdmin());
        
        // Admin Dashboard
        document.getElementById('create-room-admin-btn')?.addEventListener('click', () => this.createRoomAsAdmin());
        document.getElementById('create-admin-btn')?.addEventListener('click', () => this.createNewAdmin());
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchAdminTab(tabName);
            });
        });
        
        // Join Room
        document.getElementById('confirm-join-btn')?.addEventListener('click', () => this.joinRoomAsPlayer());
        document.getElementById('cancel-join-btn')?.addEventListener('click', () => this.hideJoinRoomModal());
        
        // Game Controls
        document.getElementById('extract-btn-sidebar')?.addEventListener('click', () => this.extractNumber());
        document.getElementById('auto-btn-sidebar')?.addEventListener('click', () => this.toggleAutoExtract());
        document.getElementById('auto-mark-btn')?.addEventListener('click', () => this.toggleAutoMark());
        document.getElementById('copy-code-btn-bottom')?.addEventListener('click', () => this.copyRoomCode());
        
        // Popups
        document.getElementById('close-popup-btn')?.addEventListener('click', () => this.closeNumberPopup());
        document.getElementById('continue-btn')?.addEventListener('click', () => this.closeWinnerPopup());
        
        // Keyboard shortcuts
        document.getElementById('admin-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.adminLogin();
        });
        
        document.getElementById('join-room-code-input')?.addEventListener('keypress', (e) => {
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
        
        this.socket.on('connect_error', () => {
            console.error('❌ Errore di connessione');
            this.showToast('Errore di connessione', 'error');
        });
        
        // Login
        this.socket.on('login-success', (data) => {
            console.log('🔓 Login successo:', data);
            
            this.sessionToken = data.token;
            this.user = {
                email: data.email,
                name: data.name,
                role: data.role,
                isSuperAdmin: data.isSuperAdmin
            };
            
            this.isAdmin = ['super_admin', 'admin'].includes(data.role);
            
            // Salva token
            localStorage.setItem('tombola_token', data.token);
            localStorage.setItem('tombola_email', data.email);
            
            this.showAdminDashboard(data);
            this.showToast(`Benvenuto ${data.name}!`, 'success');
        });
        
        this.socket.on('login-error', (data) => {
            console.error('❌ Login fallito:', data);
            this.showToast(data.message || 'Credenziali non valide', 'error');
        });
        
        // Room
        this.socket.on('room-created', (data) => {
            if (!data.success) {
                this.showToast(data.error || 'Errore creazione stanza', 'error');
                return;
            }
            
            this.room = data.room;
            this.showGameScreen();
            this.updateRoomInfo();
            this.generateTombolaCard();
            this.showToast(`Stanza "${data.room.name}" creata!`, 'success');
        });
        
        this.socket.on('room-joined', (data) => {
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
            if (this.room) {
                this.updatePlayersList();
                this.showToast(`${data.player.name} si è unito!`, 'info');
            }
        });
        
        this.socket.on('player-left', (data) => {
            if (this.room) {
                this.updatePlayersList();
            }
        });
        
        this.socket.on('room-closed', (data) => {
            this.showToast(data.message || 'Stanza chiusa', 'warning');
            this.showAdminLogin();
        });
        
        // Game
        this.socket.on('game-started', (data) => {
            if (this.room && this.room.code === data.room.code) {
                this.room = data.room;
                this.resetGameState();
                this.showToast('Partita iniziata! Buona fortuna!', 'success');
            }
        });
        
        this.socket.on('number-extracted', (data) => {
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
            if (this.room && this.room.code === data.roomCode) {
                this.showWinnerPopup(data.winner);
                
                if (this.autoExtractInterval) {
                    clearInterval(this.autoExtractInterval);
                    this.autoExtractInterval = null;
                }
            }
        });
    }

    // UI Methods
    showAdminLogin() {
        this.hideAllModals();
        document.getElementById('admin-login-modal').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
    }

    showAdminDashboard(adminData) {
        this.hideAllModals();
        document.getElementById('admin-dashboard-modal').classList.remove('hidden');
        
        document.getElementById('admin-name-display').textContent = adminData.name;
        document.getElementById('admin-type').textContent = adminData.isSuperAdmin ? 'Super Admin' : 'Admin';
    }

    showGameScreen() {
        this.hideAllModals();
        document.getElementById('game-screen').classList.remove('hidden');
        
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
    }

    hideJoinRoomModal() {
        document.getElementById('join-room-modal').classList.add('hidden');
    }

    hideAllModals() {
        document.querySelectorAll('.modal-overlay, .number-popup-overlay, .winner-popup-overlay').forEach(el => {
            el.classList.add('hidden');
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
        this.user = null;
        this.sessionToken = null;
        
        localStorage.removeItem('tombola_token');
        localStorage.removeItem('tombola_email');
        
        this.showAdminLogin();
        this.showToast('Disconnesso', 'info');
    }

    createRoomAsAdmin() {
        const roomName = document.getElementById('room-name').value.trim() || "Tombola";
        const maxPlayers = parseInt(document.getElementById('max-players').value) || 20;
        const showSmorfia = document.getElementById('show-smorfia').checked;
        const autoMark = document.getElementById('auto-mark').checked;
        
        this.socket.emit('create-room', {
            name: roomName,
            maxPlayers: Math.min(Math.max(2, maxPlayers), 50),
            settings: { showSmorfia, autoMark }
        });
    }

    createNewAdmin() {
        const email = document.getElementById('new-admin-email').value.trim();
        const name = document.getElementById('new-admin-name').value.trim();
        const password = document.getElementById('new-admin-password').value.trim();
        
        if (!email || !password) {
            this.showToast('Email e password richieste', 'error');
            return;
        }
        
        this.socket.emit('create-admin', { email, password, name });
    }

    switchAdminTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) btn.classList.add('active');
        });
        
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
        
        this.socket.emit('join-room', { roomCode, playerName });
    }

    extractNumber() {
        if (!this.room || !this.isAdmin) {
            this.showToast('Non autorizzato', 'error');
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
            this.showToast('Auto-estrazione disattivata', 'info');
        } else {
            if (!this.room || !this.isAdmin) {
                this.showToast('Non puoi avviare auto-estrazione', 'error');
                return;
            }
            
            this.autoExtractInterval = setInterval(() => {
                if (this.room.game.active && this.room.game.remainingNumbers.length > 0) {
                    this.extractNumber();
                } else {
                    this.toggleAutoExtract();
                }
            }, 3000);
            
            autoBtn.innerHTML = '<i class="fas fa-stop"></i> Ferma Auto';
            this.showToast('Auto-estrazione attivata', 'success');
        }
    }

    toggleAutoMark() {
        this.autoMarkEnabled = !this.autoMarkEnabled;
        const btn = document.getElementById('auto-mark-btn');
        
        if (this.autoMarkEnabled) {
            btn.innerHTML = '<i class="fas fa-toggle-on"></i> Auto ON';
            this.showToast('Auto-segna attivato', 'success');
        } else {
            btn.innerHTML = '<i class="fas fa-toggle-off"></i> Auto OFF';
            this.showToast('Auto-segna disattivato', 'info');
        }
    }

    copyRoomCode() {
        if (!this.room) {
            this.showToast('Non sei in una stanza', 'error');
            return;
        }
        
        navigator.clipboard.writeText(this.room.code)
            .then(() => this.showToast('Codice copiato!', 'success'))
            .catch(() => this.showToast('Errore copia', 'error'));
    }

    // UI Updates
    updateRoomInfo() {
        if (!this.room) return;
        
        document.getElementById('current-room-code').textContent = this.room.code;
        document.getElementById('user-name').textContent = this.user.name;
        
        const avatar = document.getElementById('user-avatar');
        if (this.isAdmin) {
            avatar.innerHTML = '<i class="fas fa-crown"></i>';
        } else {
            avatar.textContent = this.user.name.substring(0, 2).toUpperCase();
        }
    }

    generateTombolaCard() {
        const grid = document.getElementById('tombola-card-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        if (!this.cardNumbers || this.cardNumbers.length === 0) {
            for (let i = 0; i < 15; i++) {
                const cell = document.createElement('div');
                cell.className = 'number-cell';
                cell.textContent = '?';
                grid.appendChild(cell);
            }
            return;
        }
        
        const sortedNumbers = [...this.cardNumbers].sort((a, b) => a - b);
        
        for (let i = 0; i < 15; i++) {
            const cell = document.createElement('div');
            const number = sortedNumbers[i];
            
            cell.className = 'number-cell';
            cell.textContent = number;
            cell.dataset.number = number;
            
            if (this.room?.game?.extractedNumbers.includes(number)) {
                cell.classList.add('extracted');
                if (this.room.game.lastExtracted === number) {
                    cell.classList.add('recent');
                }
            }
            
            cell.addEventListener('click', () => {
                if (this.room?.game?.extractedNumbers.includes(number)) {
                    cell.classList.toggle('extracted');
                    this.updateProgress();
                }
            });
            
            grid.appendChild(cell);
        }
        
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
        
        if (this.user.role === 'player') {
            document.getElementById('user-score').textContent = `${extractedCount}/15`;
        }
    }

    updateCurrentNumber(number, meaning) {
        const numberValue = document.getElementById('current-number-value');
        const numberMeaning = document.getElementById('number-meaning');
        
        if (numberValue && number) {
            numberValue.textContent = number;
        }
        
        if (numberMeaning && meaning) {
            const span = numberMeaning.querySelector('span');
            if (span) span.textContent = meaning;
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
        
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
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
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Avvia il gioco
document.addEventListener('DOMContentLoaded', () => {
    window.tombolaGame = new TombolaGame();
});
