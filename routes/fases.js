const express = require('express');
const { queryAll, queryGet } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const fases = await queryAll('SELECT * FROM fases WHERE empresa_id = ? ORDER BY orden', [req.usuario.empresa_id]);
    res.json(fases);
});

router.get('/:id', verificarToken, async (req, res) => {
    const fase = await queryGet('SELECT * FROM fases WHERE id = ? AND empresa_id = ?', [req.params.id, req.usuario.empresa_id]);
    if (!fase) return res.status(404).json({ error: 'Fase no encontrada' });

    const pasos = await queryAll(`
        SELECT p.*, 
            (SELECT COUNT(*) FROM evidencias e WHERE e.paso_id = p.id) as total_evidencias,
            (SELECT COUNT(*) FROM evidencias e WHERE e.paso_id = p.id AND e.estado = 'finalizado') as evidencias_completadas
        FROM pasos p 
        WHERE p.fase_id = ? AND p.empresa_id = ? 
        ORDER BY p.orden
    `, [req.params.id, req.usuario.empresa_id]);

    res.json({ ...fase, pasos });
});

module.exports = router;