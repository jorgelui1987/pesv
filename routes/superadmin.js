const express = require('express');
const { queryAll, queryGet, queryRun } = require('../database');
const { verificarToken, verificarSuperAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/superadmin/empresas - Listar todas las empresas
router.get('/empresas', verificarToken, verificarSuperAdmin, async (req, res) => {
    const empresas = await queryAll(`
        SELECT e.*, 
            (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id) as total_usuarios,
            (SELECT COUNT(*) FROM fases f WHERE f.empresa_id = e.id) as total_fases,
            (SELECT COUNT(*) FROM pasos p WHERE p.empresa_id = e.id) as total_pasos,
            (SELECT COUNT(*) FROM evidencias ev WHERE ev.empresa_id = e.id) as total_evidencias,
            (SELECT COUNT(*) FROM evidencias ev WHERE ev.empresa_id = e.id AND ev.estado = 'finalizado') as evidencias_completadas
        FROM empresas e 
        ORDER BY e.created_at DESC
    `);
    res.json(empresas);
});

// PUT /api/superadmin/empresas/:id/estado - Activar/Desactivar empresa
router.put('/empresas/:id/estado', verificarToken, verificarSuperAdmin, async (req, res) => {
    const { activo } = req.body;
    await queryRun('UPDATE empresas SET activo = $1 WHERE id = $2', [activo ? 1 : 0, req.params.id]);
    res.json({ mensaje: activo ? 'Empresa activada' : 'Empresa desactivada' });
});

// PUT /api/superadmin/empresas/:id - Editar empresa
router.put('/empresas/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
    const { nombre, nit, direccion, telefono, email_contacto } = req.body;
    await queryRun('UPDATE empresas SET nombre=$1, nit=$2, direccion=$3, telefono=$4, email_contacto=$5 WHERE id=$6',
        [nombre, nit, direccion, telefono, email_contacto, req.params.id]);
    res.json({ mensaje: 'Empresa actualizada' });
});

// DELETE /api/superadmin/empresas/:id - Eliminar empresa
router.delete('/empresas/:id', verificarToken, verificarSuperAdmin, async (req, res) => {
    await queryRun('DELETE FROM empresas WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Empresa eliminada' });
});

// GET /api/superadmin/stats - Estadísticas globales
router.get('/stats', verificarToken, verificarSuperAdmin, async (req, res) => {
    const totalEmpresas = await queryGet('SELECT COUNT(*) as t FROM empresas');
    const activas = await queryGet('SELECT COUNT(*) as t FROM empresas WHERE activo = 1');
    const inactivas = await queryGet('SELECT COUNT(*) as t FROM empresas WHERE activo = 0');
    const totalUsuarios = await queryGet('SELECT COUNT(*) as t FROM usuarios');
    const totalEvidencias = await queryGet('SELECT COUNT(*) as t FROM evidencias');
    const completadas = await queryGet("SELECT COUNT(*) as t FROM evidencias WHERE estado='finalizado'");

    const empresasPorMes = await queryAll(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as mes, COUNT(*) as total 
        FROM empresas 
        GROUP BY TO_CHAR(created_at, 'YYYY-MM') 
        ORDER BY mes DESC LIMIT 12
    `);

    res.json({
        total_empresas: totalEmpresas.t,
        empresas_activas: activas.t,
        empresas_inactivas: inactivas.t,
        total_usuarios: totalUsuarios.t,
        total_evidencias: totalEvidencias.t,
        evidencias_completadas: completadas.t,
        empresas_por_mes: empresasPorMes
    });
});

module.exports = router;