/**
 * Auth Service - Authentification gratuite avec JWT
 * Utilise crypto intégré Node.js (pas de dépendance externe)
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION';
const JWT_EXPIRES_IN = '24h';

// Stockage mémoire simple (remplacer par DB pour prod)
const usersStore = {};

/**
 * Hash simple avec SHA-256 (pour dev/test)
 * En prod, utiliser bcrypt
 */
function hashPassword(password, salt = 'salt') {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * Vérifie le mot de passe
 */
function verifyPassword(password, hashed) {
  // Pour les comptes existants avec bcrypt, essayer bcrypt
  // Sinon utiliser SHA256
  return hashed.startsWith('$2b$') ? 
    false : // bcrypt
    hashPassword(password) === hashed; // SHA256
}

class AuthService {
  /**
   * Inscription utilisateur
   */
  async register(email, password, name, apiKey) {
    const email_lower = email.toLowerCase();
    
    if (usersStore[email_lower]) {
      throw new Error('Email déjà utilisé');
    }

    const user = {
      id: Date.now().toString(),
      email: email_lower,
      name: name,
      hashedPassword: hashPassword(password),
      apiKey: apiKey || null,
      createdAt: new Date().toISOString(),
      agents: [],
      connections: []
    };

    usersStore[email_lower] = user;
    return this.generateToken(user);
  }

  /**
   * Login utilisateur
   */
  async login(email, password) {
    const email_lower = email.toLowerCase();
    const user = usersStore[email_lower];

    if (!user) {
      throw new Error('Identifiants invalides');
    }

    if (!verifyPassword(password, user.hashedPassword)) {
      throw new Error('Identifiants invalides');
    }

    return this.generateToken(user);
  }

  /**
   * Génère un token JWT
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        hasApiKey: user.apiKey ? true : false
      }
    };
  }

  /**
   * Valide un token JWT
   */
  validateToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  /**
   * Récupère un utilisateur par ID
   */
  getUserById(id) {
    for (const email in usersStore) {
      if (usersStore[email].id === id) return usersStore[email];
    }
    return null;
  }

  /**
   * Récupère un utilisateur par email
   */
  getUserByEmail(email) {
    return usersStore[email.toLowerCase()] || null;
  }

  /**
   * Ajoute un agent à l'utilisateur
   */
  addAgentToUser(email, agentId) {
    const user = usersStore[email.toLowerCase()];
    if (user && !user.agents.includes(agentId)) {
      user.agents.push(agentId);
    }
  }

  /**
   * Change le mot de passe
   */
  async changePassword(email, oldPassword, newPassword) {
    const email_lower = email.toLowerCase();
    const user = usersStore[email_lower];
    
    if (!user || !verifyPassword(oldPassword, user.hashedPassword)) {
      throw new Error('Mot de passe actuel incorrect');
    }
    
    user.hashedPassword = hashPassword(newPassword);
    return true;
  }
}

module.exports = new AuthService();