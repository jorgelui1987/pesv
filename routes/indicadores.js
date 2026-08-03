const express = require('express');
const { queryAll, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const indicadores = await queryAll('SELECT * FROM indicadores WHERE empresa_id = $1 ORDER BY nombre', [req.usuario.empresa_id]);
    res.json(indicadores);
});

router.post('/', verificarToken, async (req, res) => {
    const { nombre, descripcion, formula, meta, periodo } = req.body;
    const result = await queryRun('INSERT INTO indicadores (empresa_id, nombre, descripcion, formula, meta, periodo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [req.usuario.empresa_id, nombre, descripcion, formula, meta, periodo || 'mensual']);
    res.status(201).json({ id: result.lastInsertRowid });
});

router.post('/:id/registros', verificarToken, async (req, res) => {
    const { valor, fecha, observaciones } = req.body;
    await queryRun('INSERT INTO registros_indicadores (indicador_id, empresa_id, valor, fecha, observaciones) VALUES ($1,$2,$3,$4,$5)',
        [req.params.id, req.usuario.empresa_id, valor, fecha, observaciones]);
    res.status(201).json({ mensaje: 'Registro guardado' });
});

router.get('/:id/registros', verificarToken, async (req, res) => {
    const registros = await queryAll('SELECT * FROM registros_indicadores WHERE indicador_id = $1 AND empresa_id = $2 ORDER BY fecha DESC',
        [req.params.id, req.usuario.empresa_id]);
    res.json(registros);
});

module.exports = router;