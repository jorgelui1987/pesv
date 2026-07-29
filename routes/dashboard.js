const express = require('express');
const { queryAll, queryGet } = require('../database');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    const empresaId = req.usuario.empresa_id;

    const fases = await queryAll('SELECT * FROM fases WHERE empresa_id = ? ORDER BY orden', [empresaId]);
    const resumenFases = [];
    for (const f of fases) {
        const total = await queryGet('SELECT COUNT(*) as t FROM pasos WHERE fase_id = ?', [f.id]);
        const completados = await queryGet(`
            SELECT COUNT(DISTINCT p.id) as t FROM pasos p 
            JOIN evidencias e ON e.paso_id = p.id 
            WHERE p.fase_id = ? AND e.estado = 'finalizado'
        `, [f.id]);
        resumenFases.push({
            id: f.id,
            nombre: f.nombre,
            total: total.t,
            completados: completados.t,
            pendientes: total.t - completados.t,
            porcentaje: total.t > 0 ? Math.round((completados.t / total.t) * 100) : 0
        });
    }

    const totalEvidencias = await queryGet('SELECT COUNT(*) as t FROM evidencias WHERE empresa_id = ?', [empresaId]);
    const pendiente = await queryGet("SELECT COUNT(*) as t FROM evidencias WHERE empresa_id = ? AND estado='pendiente'", [empresaId]);
    const enProceso = await queryGet("SELECT COUNT(*) as t FROM evidencias WHERE empresa_id = ? AND estado='en_proceso'", [empresaId]);
    const finalizado = await queryGet("SELECT COUNT(*) as t FROM evidencias WHERE empresa_id = ? AND estado='finalizado'", [empresaId]);

    const accionesAbiertas = await queryGet("SELECT COUNT(*) as t FROM acciones_mejora WHERE empresa_id = ? AND estado != 'cerrada'", [empresaId]);

    const ultimasEvidencias = await queryAll(`
        SELECT e.*, p.nombre as paso_nombre, u.nombre as usuario_nombre
        FROM evidencias e 
        JOIN pasos p ON e.paso_id = p.id 
        JOIN usuarios u ON e.usuario_id = u.id 
        WHERE e.empresa_id = ? 
        ORDER BY e.updated_at DESC LIMIT 5
    `, [empresaId]);

    res.json({
        resumen_fases: resumenFases,
        total_evidencias: totalEvidencias.t,
        evidencias_por_estado: {
            pendiente: pendiente.t,
            en_proceso: enProceso.t,
            finalizado: finalizado.t
        },
        acciones_abiertas: accionesAbiertas.t,
        ultimas_evidencias: ultimasEvidencias
    });
});

module.exports = router;