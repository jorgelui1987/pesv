const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'PESV_Integral_Secret_Key_2024_Saas';

// Email del super admin global. Solo este usuario tiene acceso al Panel Admin.
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'jesuscastrosg@gmail.com';

function esSuperAdminUsuario(usuario) {
    return usuario.email === SUPER_ADMIN_EMAIL;
}

function generarToken(usuario) {
    return jwt.sign(
        {
            id: usuario.id,
            empresa_id: usuario.empresa_id,
            email: usuario.email,
            rol: usuario.rol,
            nombre: usuario.nombre,
            es_super_admin: esSuperAdminUsuario(usuario)
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

function verificarRol(...roles) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({ error: 'No tiene permisos para esta acción' });
        }
        next();
    };
}

// Middleware: Solo el super admin global (independiente del rol) puede pasar.
function verificarSuperAdmin(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    if (!req.usuario.es_super_admin) {
        return res.status(403).json({ error: 'Acceso denegado. No tiene permisos de super administrador.' });
    }
    next();
}

module.exports = { generarToken, verificarToken, verificarRol, verificarSuperAdmin, esSuperAdminUsuario, JWT_SECRET };
