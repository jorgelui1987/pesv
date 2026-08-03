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

// POST /api/empresas/restaurar-backup - Restaurar los datos del PESV desde un backup JSON
// (solo admin de la empresa). Limpia los datos actuales y recrea fases, pasos,
// indicadores, registros, acciones, auditorías y evidencias desde el backup.
// Los usuarios y la cuenta de la empresa se conservan.
router.post('/restaurar-backup', verificarToken, verificarRol('admin'), async (req, res) => {
    try {
        const empresaId = req.usuario.empresa_id;
        const backup = req.body;

        // Validar que el backup tenga la estructura esperada
        if (!backup || !Array.isArray(backup.fases) || !Array.isArray(backup.pasos)) {
            return res.status(400).json({ error: 'El archivo de backup no es válido o está incompleto' });
        }

        // 1. Limpiar los datos operativos actuales de la empresa
        await queryRun('DELETE FROM evidencias WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM registros_indicadores WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM indicadores WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM acciones_mejora WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM auditorias WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM pasos WHERE empresa_id = $1', [empresaId]);
        await queryRun('DELETE FROM fases WHERE empresa_id = $1', [empresaId]);

        // 2. Recrear fases y pasos desde el backup (mapeando IDs antiguos a nuevos)
        const faseIdMap = {};
        for (const fase of backup.fases) {
            const fResult = await queryRun(
                'INSERT INTO fases (empresa_id, nombre, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING id',
                [empresaId, fase.nombre, fase.descripcion || '', fase.orden || 0]
            );
            faseIdMap[fase.id] = fResult.lastInsertRowid;
        }

        const pasoIdMap = {};
        for (const paso of backup.pasos) {
            const nuevaFaseId = faseIdMap[paso.fase_id];
            if (!nuevaFaseId) continue;
            const pResult = await queryRun(
                'INSERT INTO pasos (fase_id, empresa_id, codigo, nombre, descripcion, responsable, fecha_limite, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
                [nuevaFaseId, empresaId, paso.codigo, paso.nombre, paso.descripcion || '', paso.responsable || null, paso.fecha_limite || null, paso.orden || 0]
            );
            pasoIdMap[paso.id] = pResult.lastInsertRowid;
        }

        // 3. Recrear indicadores y sus registros
        const indicadorIdMap = {};
        if (Array.isArray(backup.indicadores)) {
            for (const ind of backup.indicadores) {
                const iResult = await queryRun(
                    'INSERT INTO indicadores (empresa_id, nombre, descripcion, formula, meta, periodo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [empresaId, ind.nombre, ind.descripcion || '', ind.formula || '', ind.meta || null, ind.periodo || 'mensual']
                );
                indicadorIdMap[ind.id] = iResult.lastInsertRowid;
            }
        }
        if (Array.isArray(backup.registros_indicadores)) {
            for (const reg of backup.registros_indicadores) {
                const nuevoIndId = indicadorIdMap[reg.indicador_id];
                if (!nuevoIndId) continue;
                await queryRun(
                    'INSERT INTO registros_indicadores (indicador_id, empresa_id, valor, fecha, observaciones) VALUES ($1, $2, $3, $4, $5)',
                    [nuevoIndId, empresaId, reg.valor, reg.fecha, reg.observaciones || '']
                );
            }
        }

        // 4. Recrear acciones de mejora
        if (Array.isArray(backup.acciones_mejora)) {
            for (const acc of backup.acciones_mejora) {
                await queryRun(
                    'INSERT INTO acciones_mejora (empresa_id, origen, descripcion, responsable, fecha_compromiso, estado) VALUES ($1, $2, $3, $4, $5, $6)',
                    [empresaId, acc.origen || '', acc.descripcion, acc.responsable || null, acc.fecha_compromiso || null, acc.estado || 'abierta']
                );
            }
        }

        // 5. Recrear auditorías
        if (Array.isArray(backup.auditorias)) {
            for (const aud of backup.auditorias) {
                await queryRun(
                    'INSERT INTO auditorias (empresa_id, tipo, fecha, auditor, hallazgos, resultado) VALUES ($1, $2, $3, $4, $5, $6)',
                    [empresaId, aud.tipo || 'interna', aud.fecha, aud.auditor || null, aud.hallazgos || '', aud.resultado || '']
                );
            }
        }

        // 6. Recrear evidencias (mapeando paso_id)
        if (Array.isArray(backup.evidencias)) {
            for (const ev of backup.evidencias) {
                const nuevoPasoId = pasoIdMap[ev.paso_id];
                if (!nuevoPasoId) continue;
                await queryRun(
                    'INSERT INTO evidencias (paso_id, empresa_id, usuario_id, estado, descripcion, archivo_nombre, archivo_ruta, observaciones, fecha_ejecucion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                    [nuevoPasoId, empresaId, req.usuario.id, ev.estado || 'pendiente', ev.descripcion || '', ev.archivo_nombre || null, ev.archivo_ruta || null, ev.observaciones || '', ev.fecha_ejecucion || null]
                );
            }
        }

        res.json({ mensaje: 'Backup restaurado correctamente. Los datos del PESV fueron recuperados.' });
    } catch (err) {
        console.error('Error al restaurar backup:', err);
        res.status(500).json({ error: 'Error al restaurar el backup: ' + err.message });
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
