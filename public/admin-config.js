
// admin-config.js - Configurazione Admin System
class AdminConfig {
  constructor() {
    this.config = {
      // SUPER ADMIN - Cambia queste in produzione!
      superAdmin: {
        email: "admin@tombola.it",
        defaultPassword: "Admin123!",
        name: "Super Admin"
      },
      
      // Sicurezza
      security: {
        minPasswordLength: 6,
        requireEmailVerification: false, // Imposta true in produzione
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 ore in millisecondi
        maxLoginAttempts: 5,
        lockoutTime: 15 * 60 * 1000 // 15 minuti
      },
      
      // Stanze
      rooms: {
        maxRoomsPerAdmin: 10,
        maxPlayersPerRoom: 50,
        autoCleanupInactiveRooms: true,
        roomInactiveTimeout: 30 * 60 * 1000 // 30 minuti
      },
      
      // Game
      game: {
        numbersRange: { min: 1, max: 90 },
        numbersPerCard: 15,
        autoExtractDelay: 3000, // 3 secondi
        maxAutoExtractDuration: 30 * 60 * 1000 // 30 minuti
      },
      
      // Features
      features: {
        enableSmorfia: true,
        enableAutoMark: true,
        enableSoundEffects: true,
        enableAnimations: true,
        enableNotifications: true
      },
      
      // UI
      ui: {
        theme: 'dark',
        showPlayerAvatars: true,
        showNumberHistory: true,
        compactMode: false
      }
    };
  }
  
  // Getters per configurazione
  getSuperAdminConfig() {
    return {
      ...this.config.superAdmin,
      // Non restituire password in chiaro
      hasDefaultPassword: true
    };
  }
  
  getSecurityConfig() {
    return this.config.security;
  }
  
  getRoomConfig() {
    return this.config.rooms;
  }
  
  getGameConfig() {
    return this.config.game;
  }
  
  getFeaturesConfig() {
    return this.config.features;
  }
  
  getUIConfig() {
    return this.config.ui;
  }
  
  // Validazione
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  isValidPassword(password) {
    return password.length >= this.config.security.minPasswordLength;
  }
  
  isValidRoomName(name) {
    return name && name.trim().length >= 3 && name.trim().length <= 50;
  }
  
  isValidPlayerName(name) {
    return name && name.trim().length >= 2 && name.trim().length <= 20;
  }
  
  // Generazione codice stanza
  generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  // Generazione cartella tombola
  generateCardNumbers() {
    const numbers = new Set();
    const { min, max } = this.config.game.numbersRange;
    const count = this.config.game.numbersPerCard;
    
    while (numbers.size < count) {
      numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    
    return Array.from(numbers).sort((a, b) => a - b);
  }
  
  // Ottieni significato Smorfia
  getSmorfiaMeaning(number) {
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
    
    return smorfia[number] || `Numero ${number} - Buona fortuna!`;
  }
  
  // Permessi admin
  getAdminPermissions(isSuperAdmin) {
    return {
      canCreateRooms: true,
      canStartGames: true,
      canExtractNumbers: true,
      canResetGames: true,
      canKickPlayers: isSuperAdmin,
      canCreateAdmins: isSuperAdmin,
      canDeleteAdmins: isSuperAdmin,
      canViewAllRooms: isSuperAdmin,
      canModifySettings: isSuperAdmin
    };
  }
  
  // Validazione permessi
  canPerformAction(admin, action) {
    const permissions = this.getAdminPermissions(admin.isSuperAdmin);
    return permissions[action] || false;
  }
}

// Esporta per uso globale
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminConfig;
} else {
  window.AdminConfig = AdminConfig;
}
