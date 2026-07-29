const express = require('express');
const { queryAll, queryGet, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const { fase_id } = req.query;
    let pasos;
    if (fase_id) {
        pasos = await queryAll('SELECT * FROM pasos WHERE fase_id = ? AND empresa_id = ? ORDER BY orden', [fase_id, req.usuario.empresa_id]);
    } else {
        pasos = await queryAll('SELECT * FROM pasos WHERE empresa_id = ? ORDER BY orden', [req.usuario.empresa_id]);
    }
    res.json(pasos);
});

router.get('/:id', verificarToken, async (req, res) => {
    const paso = await queryGet('SELECT * FROM pasos WHERE id = ? AND empresa_id = ?', [req.params.id, req.usuario.empresa_id]);
    if (!paso) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json(paso);
});

router.put('/:id', verificarToken, async (req, res) => {
    const { responsable, fecha_limite } = req.body;
    await queryRun('UPDATE pasos SET responsable=?, fecha_limite=? WHERE id=? AND empresa_id=?',
        [responsable, fecha_limite, req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Paso actualizado' });
});

module.exports = router;