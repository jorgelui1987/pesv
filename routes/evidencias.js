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
            WHERE e.paso_id = $1 AND e.empresa_id = $2 
            ORDER BY e.created_at DESC
        `, [paso_id, req.usuario.empresa_id]);
    } else {
        evidencias = await queryAll(`
            SELECT e.*, u.nombre as usuario_nombre, p.nombre as paso_nombre 
            FROM evidencias e 
            JOIN usuarios u ON e.usuario_id = u.id 
            JOIN pasos p ON e.paso_id = p.id 
            WHERE e.empresa_id = $1 
            ORDER BY e.created_at DESC
        `, [req.usuario.empresa_id]);
    }
    res.json(evidencias);
});

router.post('/', verificarToken, async (req, res) => {
    const { paso_id, estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion } = req.body;
    if (!paso_id) return res.status(400).json({ error: 'El paso es requerido' });

    const fechaValida = fecha_ejecucion && fecha_ejecucion.trim() !== '' ? fecha_ejecucion : null;
    const result = await queryRun(`
        INSERT INTO evidencias (paso_id, empresa_id, usuario_id, estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [paso_id, req.usuario.empresa_id, req.usuario.id, estado || 'pendiente', descripcion || '', archivo_nombre || '', archivo_ruta || '', observaciones || '', fechaValida]);

    res.status(201).json({ id: result.lastInsertRowid, mensaje: 'Evidencia creada' });
});

router.put('/:id', verificarToken, async (req, res) => {
    const { estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion } = req.body;
    const fechaValida2 = fecha_ejecucion && fecha_ejecucion.trim() !== '' ? fecha_ejecucion : null;
    await queryRun(`
        UPDATE evidencias SET estado=$1, descripcion=$2, archivo_nombre=$3, archivo_ruta=$4, observaciones=$5, fecha_ejecucion=$6, updated_at=CURRENT_TIMESTAMP
        WHERE id=$7 AND empresa_id=$8
    `, [estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fechaValida2, req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Evidencia actualizada' });
});

router.delete('/:id', verificarToken, async (req, res) => {
    await queryRun('DELETE FROM evidencias WHERE id=$1 AND empresa_id=$2', [req.params.id, req.usuario.empresa_id]);
    res.json({ mensaje: 'Evidencia eliminada' });
});

module.exports = router;