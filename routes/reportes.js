const express = require('express');
const { queryAll, queryGet } = require('../database');
const { verificarToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const router = express.Router();

router.get('/avance', verificarToken, async (req, res) => {
    const empresaId = req.usuario.empresa_id;

    const totalPasos = await queryGet('SELECT COUNT(*) as total FROM pasos WHERE empresa_id = $1', [empresaId]);
    const pasosConEvidencia = await queryGet(`
        SELECT COUNT(DISTINCT p.id) as total FROM pasos p 
        JOIN evidencias e ON e.paso_id = p.id 
        WHERE p.empresa_id = $1 AND e.estado = 'finalizado'
    `, [empresaId]);

    const fases = await queryAll('SELECT * FROM fases WHERE empresa_id = $1 ORDER BY orden', [empresaId]);
    const detalleFases = [];
    for (const f of fases) {
        const total = await queryGet('SELECT COUNT(*) as t FROM pasos WHERE fase_id = $1', [f.id]);
        const completados = await queryGet(`
            SELECT COUNT(DISTINCT p.id) as t FROM pasos p 
            JOIN evidencias e ON e.paso_id = p.id 
            WHERE p.fase_id = $1 AND e.estado = 'finalizado'
        `, [f.id]);
        detalleFases.push({
            ...f,
            total_pasos: total.t,
            pasos_completados: completados.t,
            porcentaje: total.t > 0 ? Math.round((completados.t / total.t) * 100) : 0
        });
    }

    const evidenciasRecientes = await queryAll(`
        SELECT e.*, p.nombre as paso_nombre, u.nombre as usuario_nombre
        FROM evidencias e 
        JOIN pasos p ON e.paso_id = p.id 
        JOIN usuarios u ON e.usuario_id = u.id 
        WHERE e.empresa_id = $1 
        ORDER BY e.updated_at DESC LIMIT 10
    `, [empresaId]);

    res.json({
        total_pasos: totalPasos.total,
        pasos_con_evidencia: pasosConEvidencia.total,
        porcentaje_global: totalPasos.total > 0 ? Math.round((pasosConEvidencia.total / totalPasos.total) * 100) : 0,
        detalle_fases: detalleFases,
        evidencias_recientes: evidenciasRecientes
    });
});

router.get('/pdf', verificarToken, async (req, res) => {
    const empresaId = req.usuario.empresa_id;
    const empresa = await queryGet('SELECT * FROM empresas WHERE id = $1', [empresaId]);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=PESV_${empresa.nombre.replace(/\s+/g, '_')}.pdf`);
    doc.pipe(res);

    doc.fontSize(24).font('Helvetica-Bold').text('Plan Estratégico de Seguridad Vial', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).font('Helvetica').text(empresa.nombre, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`NIT: ${empresa.nit || 'N/A'}`, { align: 'center' });
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(16).font('Helvetica-Bold').text('Resumen de Avance');
    doc.moveDown();

    const totalPasos = await queryGet('SELECT COUNT(*) as t FROM pasos WHERE empresa_id = $1', [empresaId]);
    const completados = await queryGet(`
        SELECT COUNT(DISTINCT p.id) as t FROM pasos p 
        JOIN evidencias e ON e.paso_id = p.id 
        WHERE p.empresa_id = $1 AND e.estado = 'finalizado'
    `, [empresaId]);

    doc.fontSize(12).font('Helvetica').text(`Total de pasos: ${totalPasos.t}`);
    doc.text(`Pasos completados: ${completados.t}`);
    doc.text(`Avance global: ${totalPasos.t > 0 ? Math.round((completados.t / totalPasos.t) * 100) : 0}%`);
    doc.moveDown(2);

    const fases = await queryAll('SELECT * FROM fases WHERE empresa_id = $1 ORDER BY orden', [empresaId]);
    doc.fontSize(16).font('Helvetica-Bold').text('Detalle por Fase');
    doc.moveDown();

    for (const fase of fases) {
        const pasos = await queryAll('SELECT * FROM pasos WHERE fase_id = $1 ORDER BY orden', [fase.id]);
        doc.fontSize(14).font('Helvetica-Bold').text(fase.nombre);
        doc.moveDown(0.5);

        for (const paso of pasos) {
            const evidencia = await queryGet(`
                SELECT e.*, u.nombre as usuario_nombre 
                FROM evidencias e 
                JOIN usuarios u ON e.usuario_id = u.id 
                WHERE e.paso_id = $1 AND e.empresa_id = $2 
                ORDER BY e.updated_at DESC LIMIT 1
            `, [paso.id, empresaId]);

            const estado = evidencia ? evidencia.estado : 'pendiente';
            const icono = estado === 'finalizado' ? '✓' : estado === 'en_proceso' ? '◐' : '○';
            doc.fontSize(10).font('Helvetica').text(`  ${icono} ${paso.codigo}: ${paso.nombre} - ${estado}`);
        }
        doc.moveDown();
    }

    doc.end();
});

module.exports = router;