// config.js - Configurazione Tombola Natalizia
const TombolaConfig = {
  // Server
  server: {
    port: 3000,
    host: window.location.hostname || 'localhost',
    secure: window.location.protocol === 'https:'
  },
  
  // Admin
  admin: {
    superAdminEmail: "superadmin@tombola.natale",
    minPasswordLength: 6,
    sessionDuration: 24 * 60 * 60 * 1000 // 24 ore
  },
  
  // Game
  game: {
    numbersRange: { min: 1, max: 90 },
    numbersPerCard: 15,
    maxPlayersPerRoom: 50,
    autoExtractDelay: 3000,
    showNatalMeanings: true
  },
  
  // UI
  ui: {
    theme: 'christmas',
    animations: true,
    sounds: true,
    snowflakes: true
  },
  
  // Sounds (percorsi relativi)
  sounds: {
    click: '/sounds/click.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
    'number-extracted': '/sounds/number.mp3',
    'game-start': '/sounds/game-start.mp3',
    win: '/sounds/win.mp3',
    'player-join': '/sounds/join.mp3',
    'room-created': '/sounds/room-created.mp3'
  },
  
  // Methods
  getServerUrl() {
    const protocol = this.server.secure ? 'https://' : 'http://';
    return `${protocol}${this.server.host}:${this.server.port}`;
  },
  
  getWebSocketUrl() {
    const protocol = this.server.secure ? 'wss://' : 'ws://';
    return `${protocol}${this.server.host}:${this.server.port}`;
  },
  
  // Validazioni
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  isValidRoomCode(code) {
    return code && code.length === 6 && /^[A-Z0-9]+$/.test(code);
  },
  
  isValidPlayerName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 20;
  },
  
  // Generazione casuale
  generateRandomNumbers(count, min, max) {
    const numbers = new Set();
    while (numbers.size < count) {
      numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }
};

// Esporta per uso globale
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TombolaConfig;
} else {
  window.TombolaConfig = TombolaConfig;
}
