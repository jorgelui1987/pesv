const express = require('express');
const bcrypt = require('bcryptjs');
const { queryGet, queryRun } = require('../database');
const { generarToken, verificarToken } = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        const usuario = await queryGet(`
            SELECT u.*, e.nombre as empresa_nombre 
            FROM usuarios u 
            JOIN empresas e ON u.empresa_id = e.id 
            WHERE u.email = ? AND u.activo = 1 AND e.activo = 1
        `, [email]);

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const valido = bcrypt.compareSync(password, usuario.password);
        if (!valido) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = generarToken(usuario);
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: usuario.rol,
                empresa_id: usuario.empresa_id,
                empresa_nombre: usuario.empresa_nombre
            }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { empresa_nombre, nit, nombre, email, password } = req.body;
        if (!empresa_nombre || !nit || !nombre || !email || !password) {
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        const existe = await queryGet('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existe) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const empResult = await queryRun('INSERT INTO empresas (nombre, nit) VALUES (?, ?)', [empresa_nombre, nit]);
        const empresaId = empResult.lastInsertRowid;

        const hash = bcrypt.hashSync(password, 10);
        await queryRun('INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)',
            [empresaId, nombre, email, hash, 'admin']);

        const fases = [
            { nombre: 'Fase 1: Planificación (PHVA)', orden: 1 },
            { nombre: 'Fase 2: Implementación y Ejecución', orden: 2 },
            { nombre: 'Fase 3: Seguimiento y Evaluación', orden: 3 },
            { nombre: 'Fase 4: Mejora Continua', orden: 4 }
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
            const fResult = await queryRun('INSERT INTO fases (empresa_id, nombre, orden) VALUES (?, ?, ?)',
                [empresaId, fases[i].nombre, fases[i].orden]);
            const pasos = pasosPorFase[i];
            for (let j = 0; j < pasos.length; j++) {
                await queryRun('INSERT INTO pasos (fase_id, empresa_id, codigo, nombre, orden) VALUES (?, ?, ?, ?, ?)',
                    [fResult.lastInsertRowid, empresaId, pasos[j].codigo, pasos[j].nombre, j + 1]);
            }
        }

        res.status(201).json({ mensaje: 'Empresa registrada exitosamente', empresa_id: empresaId });
    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error al registrar empresa' });
    }
});

// GET /api/auth/perfil
router.get('/perfil', verificarToken, async (req, res) => {
    const usuario = await queryGet(`
        SELECT u.id, u.nombre, u.email, u.rol, u.empresa_id, e.nombre as empresa_nombre
        FROM usuarios u JOIN empresas e ON u.empresa_id = e.id
        WHERE u.id = ?
    `, [req.usuario.id]);
    res.json(usuario);
});

module.exports = router;