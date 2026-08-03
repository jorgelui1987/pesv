const express = require('express');
const { queryAll, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const acciones = await queryAll('SELECT * FROM acciones_mejora WHERE empresa_id = $1 ORDER BY created_at DESC', [req.usuario.empresa_id]);
    res.json(acciones);
});

router.post('/', verificarToken, async (req, res) => {
    const { origen, descripcion, responsable, fecha_compromiso } = req.body;
    const result = await queryRun('INSERT INTO acciones_mejora (empresa_id, origen, descripcion, responsable, fecha_compromiso) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.usuario.empresa_id, origen, descripcion, responsable, fecha_compromiso]);
    res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', verificarToken, async (req, res) => {
    const { estado, descripcion, responsable, fecha_compromiso } = req.body;
    await queryRun('UPDATE acciones_mejora SET estado=$1, descripcion=$2, responsable=$3, fecha_compromiso=$4 WHERE id=$5 AND empresa_id=$6',
        [estado, descripcion, responsable, fecha_compromiso, req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Acción actualizada' });
});

module.exports = router;