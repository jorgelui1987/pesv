const express = require('express');
const { queryAll, queryGet, queryRun } = require('../database');
const { verificarToken, verificarRol } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, verificarRol('admin'), async (req, res) => {
    const empresas = await queryAll('SELECT * FROM empresas ORDER BY nombre');
    res.json(empresas);
});

router.get('/mi-empresa', verificarToken, async (req, res) => {
    const empresa = await queryGet('SELECT * FROM empresas WHERE id = $1', [req.usuario.empresa_id]);
    res.json(empresa);
});

router.put('/mi-empresa', verificarToken, verificarRol('admin'), async (req, res) => {
    const { nombre, nit, direccion, telefono, email_contacto } = req.body;
    await queryRun('UPDATE empresas SET nombre=$1, nit=$2, direccion=$3, telefono=$4, email_contacto=$5 WHERE id=$6',
        [nombre, nit, direccion, telefono, email_contacto, req.usuario.empresa_id]);
    res.json({ mensaje: 'Empresa actualizada' });
});

router.get('/usuarios', verificarToken, async (req, res) => {
    const usuarios = await queryAll('SELECT id, nombre, email, rol, activo FROM usuarios WHERE empresa_id = $1 ORDER BY nombre',
        [req.usuario.empresa_id]);
    res.json(usuarios);
});

router.post('/usuarios', verificarToken, verificarRol('admin'), async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    await queryRun('INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)',
        [req.usuario.empresa_id, nombre, email, hash, rol || 'coordinador']);
    res.status(201).json({ mensaje: 'Usuario creado' });
});

// DELETE /api/empresas/usuarios/:id - Eliminar un usuario de la propia empresa
router.delete('/usuarios/:id', verificarToken, verificarRol('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        // 1. Verificar que el usuario existe y pertenece a la misma empresa
        const usuario = await queryGet(
            'SELECT id, email FROM usuarios WHERE id = $1 AND empresa_id = $2',
            [userId, req.usuario.empresa_id]
        );

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 2. No permitir eliminarse a sí mismo (evita dejar la empresa sin admin)
        if (userId === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        // 3. Proteger al super admin global
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'jesuscastrosg@gmail.com';
        if (usuario.email === SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'No se puede eliminar la cuenta de super administrador' });
        }

        // 4. Eliminar el usuario
        await queryRun('DELETE FROM usuarios WHERE id = $1', [userId]);
        res.json({ mensaje: 'Usuario eliminado' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;
