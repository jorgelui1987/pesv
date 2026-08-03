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

module.exports = router;