const express = require('express');
const { verificarToken } = require('../middleware/auth');
const router = express.Router();

// GET /api/resoluciones/40595 - Información de la Resolución 40595 de 2022
router.get('/40595', verificarToken, (req, res) => {
    res.json({
        titulo: 'Resolución 40595 de 2022',
        entidad: 'Ministerio de Transporte de Colombia',
        fecha: '22 de diciembre de 2022',
        descripcion: 'Por la cual se adopta el Plan Estratégico de Seguridad Vial (PESV) y se establecen los lineamientos para su implementación en las organizaciones públicas y privadas.',
        ambito: 'Aplica a todas las organizaciones públicas y privadas que tengan flotas de vehículos igual o superior a diez (10) vehículos, o que contraten servicios de transporte.',
        objetivos: [
            'Reducir la siniestralidad vial en las organizaciones',
            'Promover una cultura de seguridad vial',
            'Cumplir con la normativa nacional de tránsito y transporte',
            'Proteger la vida de los trabajadores y la comunidad'
        ],
        estructura: [
            {
                fase: 'Fase 1: Planificación (PHVA)',
                pasos: 'P1 al P8',
                descripcion: 'Planificar la gestión de seguridad vial: designar líder, conformar comité, definir política, diagnóstico, riesgos, objetivos y metas.'
            },
            {
                fase: 'Fase 2: Implementación y Ejecución',
                pasos: 'P9 al P19',
                descripcion: 'Ejecutar el plan: plan anual de trabajo, formación, gestión de conductores, vehículos, velocidad, fatiga, alcohol, inspecciones, mantenimiento, proveedores y emergencias.'
            },
            {
                fase: 'Fase 3: Seguimiento y Evaluación',
                pasos: 'P20 al P22',
                descripcion: 'Monitorear y evaluar: indicadores de gestión, análisis de siniestros, auditoría anual.'
            },
            {
                fase: 'Fase 4: Mejora Continua',
                pasos: 'P23 al P25',
                descripcion: 'Actuar para mejorar: acciones correctivas, revisión por la dirección, comunicación y participación.'
            }
        ],
        enlace_oficial: 'https://www.mintransporte.gov.co/',
        articulos_destacados: [
            'Artículo 1: Adoptar el Plan Estratégico de Seguridad Vial (PESV)',
            'Artículo 2: Establecer los lineamientos técnicos para la implementación del PESV',
            'Artículo 3: Definir las fases y pasos del PESV según el ciclo PHVA',
            'Artículo 4: Establecer los indicadores mínimos de gestión',
            'Artículo 5: Definir las responsabilidades de la alta dirección',
            'Artículo 6: Establecer el plazo para la implementación progresiva'
        ]
    });
});

module.exports = router;