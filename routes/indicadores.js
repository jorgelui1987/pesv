const express = require('express');
const { queryAll, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const indicadores = await queryAll('SELECT * FROM indicadores WHERE empresa_id = ? ORDER BY nombre', [req.usuario.empresa_id]);
    res.json(indicadores);
});

router.post('/', verificarToken, async (req, res) => {
    const { nombre, descripcion, formula, meta, periodo } = req.body;
    const result = await queryRun('INSERT INTO indicadores (empresa_id, nombre, descripcion, formula, meta, periodo) VALUES (?,?,?,?,?,?)',
        [req.usuario.empresa_id, nombre, descripcion, formula, meta, periodo || 'mensual']);
    res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/registros', verificarToken, async (req, res) => {
    const { valor, fecha, observaciones } = req.body;
    await queryRun('INSERT INTO registros_indicadores (indicador_id, empresa_id, valor, fecha, observaciones) VALUES (?,?,?,?,?)',
        [req.params.id, req.usuario.empresa_id, valor, fecha, observaciones]);
    res.status(201).json({ mensaje: 'Registro guardado' });
});

router.get('/:id/registros', verificarToken, async (req, res) => {
    const registros = await queryAll('SELECT * FROM registros_indicadores WHERE indicador_id = ? AND empresa_id = ? ORDER BY fecha DESC',
        [req.params.id, req.usuario.empresa_id]);
    res.json(registros);
});

module.exports = router;