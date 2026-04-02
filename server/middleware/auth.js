function requireAuth(req, res, next) {
  const AUTH_TOKEN = process.env.MC_AUTH_TOKEN;

  // No token configured — skip auth for local dev
  if (!AUTH_TOKEN) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice('Bearer '.length);
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { requireAuth };
