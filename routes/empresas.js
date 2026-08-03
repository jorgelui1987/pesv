const express = require('express');
const { queryAll, queryGet, queryRun } = require('../database');
const { verificarToken, verificarRol } = require('../middleware/auth');
const router = express.Router();

router.get('/', verificarToken, verificarRol('admin'), async (req, res) => {
    const empresas = await queryAll('SELECT * FROM empresas ORDER BY nombre');
    res.json(empresas);
});

router.get('/mi-empresa', verificarToken, async (req, res) => {
    const empresa = await queryGet('SELECT * FROM empresas WHERE id = $1', [req.usuario.empresa_id]);
    res.json(empresa);
});

router.put('/mi-empresa', verificarToken, verificarRol('admin'), async (req, res) => {
    const { nombre, nit, direccion, telefono, email_contacto } = req.body;
    await queryRun('UPDATE empresas SET nombre=$1, nit=$2, direccion=$3, telefono=$4, email_contacto=$5 WHERE id=$6',
        [nombre, nit, direccion, telefono, email_contacto, req.usuario.empresa_id]);
    res.json({ mensaje: 'Empresa actualizada' });
});

router.get('/usuarios', verificarToken, async (req, res) => {
    const usuarios = await queryAll('SELECT id, nombre, email, rol, activo FROM usuarios WHERE empresa_id = $1 ORDER BY nombre',
        [req.usuario.empresa_id]);
    res.json(usuarios);
});

router.post('/usuarios', verificarToken, verificarRol('admin'), async (req, res) => {
    const { nombre, email, password, rol } = req.body;
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    await queryRun('INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)',
        [req.usuario.empresa_id, nombre, email, hash, rol || 'coordinador']);
    res.status(201).json({ mensaje: 'Usuario creado' });
});

// GET /api/empresas/backup - Exportar todos los datos de la empresa como JSON
// (solo admin de la empresa). Permite descargar un respaldo antes de un reset.
router.get('/backup', verificarToken, verificarRol('admin'), async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;

        const empresa = await queryGet('SELECT * FROM empresas WHERE id = $1', [empresaId]);
        const usuarios = await queryAll('SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE empresa_id = $1', [empresaId]);
        const fases = await queryAll('SELECT * FROM fases WHERE empresa_id = $1 ORDER BY orden', [empresaId]);
        const pasos = await queryAll('SELECT * FROM pasos WHERE empresa_id = $1 ORDER BY orden', [empresaId]);
        const evidencias = await queryAll('SELECT * FROM evidencias WHERE empresa_id = $1', [empresaId]);
        const indicadores = await queryAll('SELECT * FROM indicadores WHERE empresa_id = $1', [empresaId]);
        const registros = await queryAll('SELECT * FROM registros_indicadores WHERE empresa_id = $1', [empresaId]);
        const acciones = await queryAll('SELECT * FROM acciones_mejora WHERE empresa_id = $1', [empresaId]);
        const auditorias = await queryAll('SELECT * FROM auditorias WHERE empresa_id = $1', [empresaId]);

        const backup = {
            sistema: 'PESV Integral',
            version: '1.0.0',
            fecha_generacion: new Date().toISOString(),
            empresa,
            usuarios,
            fases,
            pasos,
            evidencias,
            indicadores,
            registros_indicadores: registros,
            acciones_mejora: acciones,
            auditorias
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="backup_pesv_${empresaId}_${Date.now()}.json"`);
        res.json(backup);
    } catch (err) {
        console.error('Error al generar backup:', err);
        res.status(500).json({ error: 'Error al generar el backup' });
    }
});

// POST /api/empresas/limpiar-datos - Eliminar todos los datos del PESV de la empresa
// conservando los usuarios y la cuenta de la empresa. Luego recrea las fases y
// pasos por defecto para que la empresa pueda empezar de nuevo.
router.post('/limpiar-datos', verificarToken, verificarRol('admin'), async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;

        // 1. Eliminar todos los datos operativos de la empresa
        await queryRun('DELETE FROM evidencias WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM registros_indicadores WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM indicadores WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM acciones_mejora WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM auditorias WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM pasos WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM fases WHERE empresa_id = $1', [empresaId]);

        // 2. Recrear las fases y pasos por defecto
        const fases = [
            { nombre: 'Fase 1: Planificación (PHVA)', desc: 'Planificar la gestión de seguridad vial en la organización', orden: 1 },
            { nombre: 'Fase 2: Implementación y Ejecución', desc: 'Ejecutar las actividades planificadas del PESV', orden: 2 },
            { nombre: 'Fase 3: Seguimiento y Evaluación', desc: 'Monitorear y evaluar el desempeño del PESV', orden: 3 },
            { nombre: 'Fase 4: Mejora Continua', desc: 'Implementar acciones correctivas y de mejora', orden: 4 }
        ];

        const pasosPorFase = [
            [
                { codigo: 'P1', nombre: 'Designar Líder del PESV' },
                { codigo: 'P2', nombre: 'Conformar Comité de Seguridad Vial' },
                { codigo: 'P3', nombre: 'Definir Política de Seguridad Vial' },
                { codigo: 'P4', nombre: 'Liderazgo y Compromiso Directivo' },
                { codigo: 'P5', nombre: 'Diagnóstico Línea Base' },
                { codigo: 'P6', nombre: 'Identificación de Peligros y Riesgos' },
                { codigo: 'P7', nombre: 'Definir Objetivos y Metas' },
                { codigo: 'P8', nombre: 'Plan de Gestión de Riesgos' }
            ],
            [
                { codigo: 'P9', nombre: 'Plan Anual de Trabajo' },
                { codigo: 'P10', nombre: 'Plan Anual de Formación' },
                { codigo: 'P11', nombre: 'Gestión de Conductores' },
                { codigo: 'P12', nombre: 'Gestión de Desplazamientos' },
                { codigo: 'P13', nombre: 'Gestión de la Velocidad' },
                { codigo: 'P14', nombre: 'Gestión de Fatiga y Distracción' },
                { codigo: 'P15', nombre: 'Gestión de Alcohol y Drogas' },
                { codigo: 'P16', nombre: 'Inspección de Vehículos' },
                { codigo: 'P17', nombre: 'Mantenimiento Preventivo' },
                { codigo: 'P18', nombre: 'Gestión de Proveedores' },
                { codigo: 'P19', nombre: 'Preparación para Emergencias' }
            ],
            [
                { codigo: 'P20', nombre: 'Indicadores de Gestión' },
                { codigo: 'P21', nombre: 'Análisis de Siniestros Viales' },
                { codigo: 'P22', nombre: 'Auditoría Anual del PESV' }
            ],
            [
                { codigo: 'P23', nombre: 'Acciones Correctivas y Preventivas' },
                { codigo: 'P24', nombre: 'Revisión por la Dirección' },
                { codigo: 'P25', nombre: 'Comunicación y Participación' }
            ]
        ];

        for (let i = 0; i < fases.length; i++) {
            const fResult = await queryRun(
                'INSERT INTO fases (empresa_id, nombre, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING id',
                [empresaId, fases[i].nombre, fases[i].desc, fases[i].orden]
            );
            const pasos = pasosPorFase[i];
            for (let j = 0; j < pasos.length; j++) {
                await queryRun(
                    'INSERT INTO pasos (fase_id, empresa_id, codigo, nombre, orden) VALUES ($1, $2, $3, $4, $5)',
                    [fResult.lastInsertRowid, empresaId, pasos[j].codigo, pasos[j].nombre, j + 1]
                );
            }
        }

        res.json({ mensaje: 'Datos del PESV eliminados. Las fases y pasos fueron restablecidos. Los usuarios y la empresa se conservan.' });
    } catch (err) {
        console.error('Error al limpiar datos de la empresa:', err);
        res.status(500).json({ error: 'Error al limpiar los datos de la empresa' });
    }
});

// DELETE /api/empresas/usuarios/:id - Eliminar un usuario de la propia empresa
router.delete('/usuarios/:id', verificarToken, verificarRol('admin'), async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);

        // 1. Verificar que el usuario existe y pertenece a la misma empresa
        const usuario = await queryGet(
            'SELECT id, email FROM usuarios WHERE id = $1 AND empresa_id = $2',
            [userId, req.usuario.empresa_id]
        );

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 2. No permitir eliminarse a sí mismo (evita dejar la empresa sin admin)
        if (userId === req.usuario.id) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        // 3. Proteger al super admin global
        const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'jesuscastrosg@gmail.com';
        if (usuario.email === SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'No se puede eliminar la cuenta de super administrador' });
        }

        // 4. Eliminar el usuario
        await queryRun('DELETE FROM usuarios WHERE id = $1', [userId]);
        res.json({ mensaje: 'Usuario eliminado' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

module.exports = router;
