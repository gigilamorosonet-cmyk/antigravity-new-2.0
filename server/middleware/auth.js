const authService = require('../auth');

/**
 * Middleware pour valider le token JWT
 * Utilise le header Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification requis', code: 'TOKEN_REQUIRED' });
  }

  const user = authService.validateToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Token invalide ou expiré', code: 'TOKEN_INVALID' });
  }

  req.user = user;
  next();
}

/**
 * Middleware optionnel - continue sans erreur si pas de token
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const user = authService.validateToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Middleware pour vérifier les permissions d'agent
 */
function canAccessAgent(agentId) {
  return (req, res, next) => {
    // Si admin ou propriétaire, accès autorisé
    if (req.user.isAdmin || req.user.ownerId === req.user.userId) {
      return next();
    }

    // Vérifier si l'utilisateur a accès à cet agent
    const agent = getAgentById(agentId); // Fonction à définir
    if (agent && (agent.ownerId === req.user.userId || agent.sharedWith?.includes(req.user.userId))) {
      return next();
    }

    res.status(403).json({ error: 'Accès refusé à cet agent', code: 'ACCESS_DENIED' });
  };
}

module.exports = {
  authenticateToken,
  optionalAuth,
  canAccessAgent
};