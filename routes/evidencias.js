const express = require('express');
const { queryAll, queryRun } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const { paso_id } = req.query;
    let evidencias;
    if (paso_id) {
        evidencias = await queryAll(`
            SELECT e.*, u.nombre as usuario_nombre 
            FROM evidencias e 
            JOIN usuarios u ON e.usuario_id = u.id 
            WHERE e.paso_id = ? AND e.empresa_id = ? 
            ORDER BY e.created_at DESC
        `, [paso_id, req.usuario.empresa_id]);
    } else {
        evidencias = await queryAll(`
            SELECT e.*, u.nombre as usuario_nombre, p.nombre as paso_nombre 
            FROM evidencias e 
            JOIN usuarios u ON e.usuario_id = u.id 
            JOIN pasos p ON e.paso_id = p.id 
            WHERE e.empresa_id = ? 
            ORDER BY e.created_at DESC
        `, [req.usuario.empresa_id]);
    }
    res.json(evidencias);
});

router.post('/', verificarToken, async (req, res) => {
    const { paso_id, estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion } = req.body;
    if (!paso_id) return res.status(400).json({ error: 'El paso es requerido' });

    const result = await queryRun(`
        INSERT INTO evidencias (paso_id, empresa_id, usuario_id, estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [paso_id, req.usuario.empresa_id, req.usuario.id, estado || 'pendiente', descripcion || '', archivo_nombre || '', archivo_ruta || '', observaciones || '', fecha_ejecucion || null]);

    res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Evidencia creada' });
});

router.put('/:id', verificarToken, async (req, res) => {
    const { estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion } = req.body;
    await queryRun(`
        UPDATE evidencias SET estado=?, descripcion=?, archivo_nombre=?, archivo_ruta=?, observaciones=?, fecha_ejecucion=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND empresa_id=?
    `, [estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion, req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Evidencia actualizada' });
});

router.delete('/:id', verificarToken, async (req, res) => {
    await queryRun('DELETE FROM evidencias WHERE id=? AND empresa_id=?', [req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Evidencia eliminada' });
});

module.exports = router;