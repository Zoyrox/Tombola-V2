// Tombola Python - Game Client
class TombolaGame {
    constructor() {
        this.socket = null;
        this.user = null;
        this.room = null;
        this.isAdmin = false;
        this.cardNumbers = [];
        this.autoExtractInterval = null;
        
        console.log('🎯 Inizializzazione Tombola Python...');
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initSocket();
        this.showLoginScreen();
        
        // Genera grid tombola di esempio
        this.generateTombolaGrid();
    }

    setupEventListeners() {
        // Login
        document.getElementById('admin-login-btn')?.addEventListener('click', () => this.adminLogin());
        document.getElementById('player-login-btn')?.addEventListener('click', () => this.playerLogin());
        
        // Switch login type
        document.getElementById('admin-switch')?.addEventListener('click', () => this.switchToAdminLogin());
        document.getElementById('player-switch')?.addEventListener('click', () => this.switchToPlayerLogin());
        
        // Game Controls
        document.getElementById('extract-btn')?.addEventListener('click', () => this.extractNumber());
        document.getElementById('auto-btn')?.addEventListener('click', () => this.toggleAutoExtract());
        document.getElementById('new-game-btn')?.addEventListener('click', () => this.newGame());
        document.getElementById('manage-codes-btn')?.addEventListener('click', () => this.showCodesModal());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        
        // Modals
        document.getElementById('close-winner-modal')?.addEventListener('click', () => this.closeModal('winner'));
        document.getElementById('new-game-modal-btn')?.addEventListener('click', () => this.newGame());
        document.getElementById('close-codes-modal')?.addEventListener('click', () => this.closeModal('codes'));
        document.getElementById('generate-codes-btn')?.addEventListener('click', () => this.generateCodes());
        document.getElementById('copy-codes-btn')?.addEventListener('click', () => this.copyCodes());
        
        // Keyboard shortcuts
        document.getElementById('admin-code')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.adminLogin();
        });
        
        document.getElementById('player-code')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.playerLogin();
        });
    }

    initSocket() {
        console.log('🔌 Connessione al server...');
        
        // Usa host corrente
        this.socket = io();
        
        // Event handlers
        this.socket.on('connect', () => {
            console.log('✅ Connesso al server');
            this.showNotification('Connesso al server', 'success');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('❌ Errore connessione:', error);
            this.showNotification('Errore di connessione', 'error');
        });
        
        this.socket.on('disconnect', () => {
            console.log('🔌 Disconnesso dal server');
            this.showNotification('Disconnesso dal server', 'warning');
        });
        
        // Login Events
        this.socket.on('login-success', (data) => {
            console.log('✅ Login admin successo');
            this.handleAdminLogin(data);
        });
        
        // Game Events
        this.socket.on('number-extracted', (data) => {
            console.log('🎲 Numero estratto:', data.number);
            this.handleNumberExtracted(data);
        });
        
        this.socket.on('player-joined', (data) => {
            console.log('👤 Nuovo giocatore:', data.player.name);
            this.handlePlayerJoined(data);
        });
        
        this.socket.on('player-left', (data) => {
            console.log('👋 Giocatore uscito:', data.playerName);
            this.handlePlayerLeft(data);
        });
        
        this.socket.on('game-started', (data) => {
            console.log('🔄 Nuova partita iniziata');
            this.handleNewGame(data);
        });
        
        this.socket.on('game-won', (data) => {
            console.log('🏆 Vincitore:', data.winner.name);
            this.handleGameWon(data);
        });
        
        this.socket.on('pong', () => {
            // Keep alive
        });
    }

    // Login Methods
    showLoginScreen() {
        document.querySelector('.login-screen').style.display = 'block';
        document.querySelector('.game-screen').style.display = 'none';
        
        // Mostra player login di default
        this.switchToPlayerLogin();
    }

    switchToAdminLogin() {
        document.getElementById('player-login').style.display = 'none';
        document.getElementById('admin-login').style.display = 'block';
        document.getElementById('admin-code').focus();
    }

    switchToPlayerLogin() {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('player-login').style.display = 'block';
        document.getElementById('player-code').focus();
    }

    adminLogin() {
        const adminCode = document.getElementById('admin-code').value.trim();
        
        if (!adminCode) {
            this.showNotification('Inserisci il codice admin', 'error');
            return;
        }
        
        this.showLoading(true);
        
        this.socket.emit('admin-login', { adminCode }, (response) => {
            this.showLoading(false);
            
            if (response.success) {
                console.log('✅ Admin autenticato');
                this.handleAdminLogin(response);
            } else {
                this.showNotification(response.message || 'Codice admin non valido', 'error');
            }
        });
    }

    playerLogin() {
        const playerCode = document.getElementById('player-code').value.trim();
        const playerName = document.getElementById('player-name').value.trim() || 'Giocatore';
        
        if (!playerCode) {
            this.showNotification('Inserisci un codice giocatore', 'error');
            return;
        }
        
        if (playerName.length < 2) {
            this.showNotification('Inserisci un nome valido', 'error');
            return;
        }
        
        this.showLoading(true);
        
        this.socket.emit('player-login', { playerCode, playerName }, (response) => {
            this.showLoading(false);
            
            if (response.success) {
                console.log('✅ Giocatore autenticato');
                this.handlePlayerLogin(response);
            } else {
                this.showNotification(response.message || 'Codice giocatore non valido', 'error');
            }
        });
    }

    handleAdminLogin(data) {
        this.user = {
            name: data.user.name,
            type: 'admin',
            roomCode: data.user.roomCode
        };
        
        this.room = data.room;
        this.isAdmin = true;
        
        this.showGameScreen();
        this.updateUI();
        this.showNotification('Accesso come Amministratore completato', 'success');
    }

    handlePlayerLogin(data) {
        this.user = {
            name: data.player.name,
            type: 'player',
            playerCode: data.player.code,
            id: data.player.id
        };
        
        this.room = data.room;
        this.cardNumbers = data.player.cardNumbers;
        this.isAdmin = false;
        
        this.showGameScreen();
        this.updateUI();
        this.generateTombolaGrid();
        this.showNotification(`Benvenuto ${data.player.name}!`, 'success');
    }

    showGameScreen() {
        document.querySelector('.login-screen').style.display = 'none';
        document.querySelector('.game-screen').style.display = 'block';
        
        // Mostra/nascondi controlli in base al ruolo
        if (this.isAdmin) {
            document.getElementById('admin-controls').style.display = 'block';
            document.getElementById('player-message').style.display = 'none';
        } else {
            document.getElementById('admin-controls').style.display = 'none';
            document.getElementById('player-message').style.display = 'block';
        }
    }

    // Game Methods
    extractNumber() {
        if (!this.isAdmin) {
            this.showNotification('Solo l\'amministratore può estrarre numeri', 'error');
            return;
        }
        
        this.socket.emit('extract-number', {}, (response) => {
            if (response.success) {
                console.log('🎲 Numero estratto:', response.number);
            } else {
                this.showNotification(response.message || 'Errore estrazione', 'error');
            }
        });
    }

    toggleAutoExtract() {
        const autoBtn = document.getElementById('auto-btn');
        
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
            autoBtn.innerHTML = '<i class="fas fa-robot"></i> Auto Estr.';
            autoBtn.classList.remove('btn-danger');
            autoBtn.classList.add('btn-success');
            this.showNotification('Auto-estrazione disattivata', 'info');
        } else {
            if (!this.isAdmin) {
                this.showNotification('Solo l\'amministratore può usare auto-estrazione', 'error');
                return;
            }
            
            this.autoExtractInterval = setInterval(() => {
                this.extractNumber();
            }, 3000);
            
            autoBtn.innerHTML = '<i class="fas fa-stop"></i> Ferma Auto';
            autoBtn.classList.remove('btn-success');
            autoBtn.classList.add('btn-danger');
            this.showNotification('Auto-estrazione attivata', 'success');
        }
    }

    newGame() {
        if (!this.isAdmin) {
            this.showNotification('Solo l\'amministratore può iniziare una nuova partita', 'error');
            return;
        }
        
        if (confirm('Vuoi iniziare una nuova partita? Tutti i progressi attuali andranno persi.')) {
            this.socket.emit('new-game', {}, (response) => {
                if (response.success) {
                    this.showNotification('Nuova partita iniziata!', 'success');
                } else {
                    this.showNotification(response.message || 'Errore nuova partita', 'error');
                }
            });
        }
    }

    // UI Updates
    updateUI() {
        if (!this.user || !this.room) return;
        
        // Update user info
        document.getElementById('user-name').textContent = this.user.name;
        document.getElementById('user-role').textContent = this.isAdmin ? 'Admin' : 'Giocatore';
        document.getElementById('user-role').className = `user-role ${this.isAdmin ? 'role-admin' : 'role-player'}`;
        document.getElementById('user-icon').className = this.isAdmin ? 'fas fa-crown' : 'fas fa-user';
        
        // Update game stats
        if (this.room.game) {
            document.getElementById('numbers-left').textContent = this.room.game.remainingNumbers?.length || 0;
            document.getElementById('extracted-count').textContent = this.room.game.extractedNumbers?.length || 0;
            
            // Update current number
            const currentNumber = document.getElementById('current-number-value');
            if (this.room.game.lastExtracted) {
                document.getElementById('no-number').style.display = 'none';
                document.getElementById('current-number').style.display = 'block';
                currentNumber.textContent = this.room.game.lastExtracted;
            } else {
                document.getElementById('no-number').style.display = 'block';
                document.getElementById('current-number').style.display = 'none';
            }
            
            // Update extracted numbers
            this.updateExtractedNumbers();
        }
        
        // Update players
        this.updatePlayersList();
    }

    updateExtractedNumbers() {
        const container = document.getElementById('extracted-numbers');
        if (!container || !this.room?.game?.extractedNumbers) return;
        
        container.innerHTML = '';
        
        // Mostra solo gli ultimi 10 numeri
        const recentNumbers = this.room.game.extractedNumbers.slice(-10);
        
        recentNumbers.forEach((num, index) => {
            const bubble = document.createElement('div');
            bubble.className = 'number-bubble';
            
            // L'ultimo numero estratto ha classe "recent"
            if (index === recentNumbers.length - 1 && this.room.game.extractedNumbers.length > 0) {
                bubble.classList.add('recent');
            }
            
            bubble.textContent = num;
            container.appendChild(bubble);
        });
    }

    updatePlayersList() {
        const container = document.getElementById('players-list');
        if (!container || !this.room?.players) return;
        
        container.innerHTML = '';
        
        // Update count
        document.getElementById('players-count').textContent = this.room.players.length;
        
        if (this.room.players.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 20px;">Nessun giocatore online</div>';
            return;
        }
        
        this.room.players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            if (player.id === this.user?.id) {
                playerCard.classList.add('active');
            }
            
            if (player.hasWon) {
                playerCard.classList.add('winner');
            }
            
            playerCard.innerHTML = `
                <div class="player-info">
                    <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="player-details">
                        <h4>${player.name}</h4>
                        <div class="player-code">${player.code || 'N/A'}</div>
                    </div>
                </div>
                <div class="player-score">
                    ${player.extractedCount || 0}/15
                    ${player.hasWon ? '<span class="winner-badge">🏆</span>' : ''}
                </div>
            `;
            
            container.appendChild(playerCard);
        });
    }

    generateTombolaGrid() {
        const grid = document.getElementById('tombola-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Se abbiamo i numeri della cartella, li usiamo
        if (this.cardNumbers && this.cardNumbers.length > 0) {
            // Grid 3x9 = 27 celle (ma noi ne abbiamo solo 15)
            const sortedNumbers = [...this.cardNumbers].sort((a, b) => a - b);
            let numIndex = 0;
            
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 9; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    
                    // Inserisci numero se disponibile, altrimenti cella vuota
                    if (numIndex < sortedNumbers.length) {
                        const num = sortedNumbers[numIndex];
                        const tens = Math.floor((num - 1) / 10);
                        
                        // La colonna è determinata dalla decina (0-8 per 1-90)
                        if (col === tens) {
                            cell.textContent = num;
                            cell.classList.remove('empty');
                            
                            // Controlla se il numero è stato estratto
                            if (this.room?.game?.extractedNumbers.includes(num)) {
                                cell.classList.add('extracted');
                            }
                            
                            numIndex++;
                        } else {
                            cell.classList.add('empty');
                        }
                    } else {
                        cell.classList.add('empty');
                    }
                    
                    grid.appendChild(cell);
                }
            }
        } else {
            // Grid di esempio
            const exampleNumbers = [
                1, 2, 3, 4, 5, 6, 7, 8, 9,
                10, 11, 12, 13, 14, 15
            ];
            
            exampleNumbers.forEach(num => {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.textContent = num;
                
                // Numeri estratti di esempio
                if ([23, 56, 71].includes(num)) {
                    cell.classList.add('extracted');
                }
                
                grid.appendChild(cell);
            });
        }
    }

    // Modal Methods
    showCodesModal() {
        if (!this.isAdmin) {
            this.showNotification('Solo l\'amministratore può gestire i codici', 'error');
            return;
        }
        
        document.getElementById('codes-modal-overlay').style.display = 'flex';
    }

    generateCodes() {
        const count = parseInt(document.getElementById('codes-count').value) || 5;
        
        this.socket.emit('generate-codes', { count }, (response) => {
            if (response.success) {
                const codesList = document.getElementById('codes-list');
                const generatedCodes = document.getElementById('generated-codes');
                
                // Aggiorna lista codici
                codesList.innerHTML = response.codes.map(code => 
                    `<div style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">${code}</div>`
                ).join('');
                
                // Mostra codici generati
                generatedCodes.innerHTML = response.codes.map(code => 
                    `<div>${code}</div>`
                ).join('');
                
                // Chiudi modal attuale e apri modal nuovi codici
                this.closeModal('codes');
                document.getElementById('generated-codes-modal-overlay').style.display = 'flex';
                
                this.showNotification(`Generati ${count} nuovi codici giocatore`, 'success');
            } else {
                this.showNotification(response.message || 'Errore generazione codici', 'error');
            }
        });
    }

    copyCodes() {
        const codes = Array.from(document.querySelectorAll('#codes-list div'))
            .map(div => div.textContent)
            .join('\n');
        
        navigator.clipboard.writeText(codes)
            .then(() => this.showNotification('Codici copiati negli appunti!', 'success'))
            .catch(() => this.showNotification('Errore copia codici', 'error'));
    }

    closeModal(modalName) {
        if (modalName === 'winner') {
            document.getElementById('winner-modal-overlay').style.display = 'none';
        } else if (modalName === 'codes') {
            document.getElementById('codes-modal-overlay').style.display = 'none';
        } else if (modalName === 'generated-codes') {
            document.getElementById('generated-codes-modal-overlay').style.display = 'none';
        }
    }

    logout() {
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.user = null;
        this.room = null;
        this.isAdmin = false;
        this.cardNumbers = [];
        
        this.showLoginScreen();
        this.showNotification('Disconnesso con successo', 'info');
    }

    // Event Handlers
    handleNumberExtracted(data) {
        if (!this.room || this.room.code !== data.room.code) return;
        
        this.room = data.room;
        
        // Se siamo giocatori, aggiorna la nostra cartella
        if (!this.isAdmin && this.cardNumbers) {
            if (this.cardNumbers.includes(data.number)) {
                // Aggiorna UI della cella
                const cells = document.querySelectorAll('.cell');
                cells.forEach(cell => {
                    if (parseInt(cell.textContent) === data.number) {
                        cell.classList.add('extracted');
                    }
                });
            }
        }
        
        this.updateUI();
        
        // Mostra notifica
        this.showNotification(`Numero estratto: ${data.number}`, 'info');
        
        // Aggiorna il titolo della pagina temporaneamente
        const originalTitle = document.title;
        document.title = `🎲 ${data.number} - ${originalTitle}`;
        setTimeout(() => {
            document.title = originalTitle;
        }, 2000);
    }

    handlePlayerJoined(data) {
        this.updatePlayersList();
        this.showNotification(`${data.player.name} si è unito al gioco!`, 'info');
    }

    handlePlayerLeft(data) {
        this.updatePlayersList();
        this.showNotification(`${data.playerName} ha lasciato il gioco`, 'info');
    }

    handleNewGame(data) {
        this.room = data.room;
        
        // Reset cartella per giocatori
        if (!this.isAdmin) {
            this.generateTombolaGrid();
        }
        
        this.updateUI();
        this.showNotification('Nuova partita iniziata!', 'success');
    }

    handleGameWon(data) {
        // Ferma auto-estrazione se attiva
        if (this.autoExtractInterval) {
            clearInterval(this.autoExtractInterval);
            this.autoExtractInterval = null;
        }
        
        document.getElementById('winner-name').textContent = data.winner.name;
        document.getElementById('winner-modal-overlay').style.display = 'flex';
        
        this.showNotification(`${data.winner.name} ha vinto la partita! 🎉`, 'success');
    }

    // Utility Methods
    showNotification(message, type = 'info') {
        // Crea elemento notifica
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        // Aggiungi al body
        document.body.appendChild(notification);
        
        // Animazione in entrata
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease forwards';
        }, 10);
        
        // Rimuovi dopo 5 secondi
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'block' : 'none';
        }
    }
}

// Avvia il gioco quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM caricato, avvio Tombola Python...');
    window.tombolaGame = new TombolaGame();
    
    // Aggiungi stili per le notifiche
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--card-bg);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                transform: translateX(120%);
                border-left: 4px solid var(--primary);
                max-width: 400px;
                backdrop-filter: blur(10px);
            }
            
            .notification-success {
                border-left-color: var(--success);
            }
            
            .notification-error {
                border-left-color: var(--danger);
            }
            
            .notification-warning {
                border-left-color: var(--warning);
            }
            
            .notification-info {
                border-left-color: var(--info);
            }
            
            .notification i {
                font-size: 20px;
            }
            
            .notification-success i {
                color: var(--success);
            }
            
            .notification-error i {
                color: var(--danger);
            }
            
            .notification-warning i {
                color: var(--warning);
            }
            
            .notification-info i {
                color: var(--info);
            }
        `;
        document.head.appendChild(style);
    }
});
