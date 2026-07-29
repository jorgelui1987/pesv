const express = require('express');
const { queryAll, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const auditorias = await queryAll('SELECT * FROM auditorias WHERE empresa_id = ? ORDER BY fecha DESC', [req.usuario.empresa_id]);
    res.json(auditorias);
});

router.post('/', verificarToken, async (req, res) => {
    const { tipo, fecha, auditor, hallazgos, resultado } = req.body;
    const result = await queryRun('INSERT INTO auditorias (empresa_id, tipo, fecha, auditor, hallazgos, resultado) VALUES (?,?,?,?,?,?)',
        [req.usuario.empresa_id, tipo || 'interna', fecha, auditor, hallazgos, resultado]);
    res.status(201).json({ id: result.lastInsertRowid });
});

module.exports = router;