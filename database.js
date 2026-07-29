const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pesv_integral',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;

async function getPool() {
    if (!pool) {
        // First connect without database to create it if needed
        const tempConn = await mysql.createConnection({
            host: DB_CONFIG.host,
            user: DB_CONFIG.user,
            password: DB_CONFIG.password,
            port: DB_CONFIG.port
        });
        await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await tempConn.end();

        pool = mysql.createPool(DB_CONFIG);
        await createTables();
        await seedData();
    }
    return pool;
}

async function createTables() {
    const conn = await pool.getConnection();
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS empresas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                nit VARCHAR(50) UNIQUE NOT NULL,
                direccion VARCHAR(255),
                telefono VARCHAR(50),
                email_contacto VARCHAR(255),
                logo_url VARCHAR(500),
                activo TINYINT DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol ENUM('admin','coordinador','consultor','auditor') DEFAULT 'coordinador',
                activo TINYINT DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS fases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                orden INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS pasos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fase_id INT NOT NULL,
                empresa_id INT NOT NULL,
                codigo VARCHAR(10) NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                responsable VARCHAR(255),
                fecha_limite DATE,
                orden INT DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fase_id) REFERENCES fases(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS evidencias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                paso_id INT NOT NULL,
                empresa_id INT NOT NULL,
                usuario_id INT NOT NULL,
                estado ENUM('pendiente','en_proceso','finalizado','no_aplica') DEFAULT 'pendiente',
                descripcion TEXT,
                archivo_nombre VARCHAR(255),
                archivo_ruta VARCHAR(500),
                observaciones TEXT,
                fecha_ejecucion DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (paso_id) REFERENCES pasos(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS indicadores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                formula TEXT,
                meta DECIMAL(10,2),
                periodo ENUM('mensual','trimestral','semestral','anual') DEFAULT 'mensual',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS registros_indicadores (
                id INT AUTO_INCREMENT PRIMARY KEY,
                indicador_id INT NOT NULL,
                empresa_id INT NOT NULL,
                valor DECIMAL(10,2) NOT NULL,
                fecha DATE NOT NULL,
                observaciones TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (indicador_id) REFERENCES indicadores(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS auditorias (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                tipo ENUM('interna','externa') DEFAULT 'interna',
                fecha DATE NOT NULL,
                auditor VARCHAR(255),
                hallazgos TEXT,
                resultado TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await conn.execute(`
            CREATE TABLE IF NOT EXISTS acciones_mejora (
                id INT AUTO_INCREMENT PRIMARY KEY,
                empresa_id INT NOT NULL,
                origen VARCHAR(255),
                descripcion TEXT NOT NULL,
                responsable VARCHAR(255),
                fecha_compromiso DATE,
                estado ENUM('abierta','en_proceso','cerrada') DEFAULT 'abierta',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    } finally {
        conn.release();
    }
}

async function seedData() {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.execute('SELECT COUNT(*) as c FROM empresas');
        if (rows[0].c > 0) return;

        // Empresa demo
        const [empResult] = await conn.execute('INSERT INTO empresas (nombre, nit) VALUES (?, ?)', ['Empresa Demo PESV', '900.123.456-7']);
        const empresaId = empResult.insertId;

        // Usuarios demo
        const hash = bcrypt.hashSync('admin123', 10);
        await conn.execute('INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)',
            [empresaId, 'Admin PESV', 'admin@pesv.com', hash, 'admin']);

        const hash2 = bcrypt.hashSync('coord123', 10);
        await conn.execute('INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)',
            [empresaId, 'Coordinador Demo', 'coordinador@pesv.com', hash2, 'coordinador']);

        // Fases y pasos
        const fases = [
            { nombre: 'Fase 1: Planificación (PHVA)', desc: 'Planificar la gestión de seguridad vial en la organización', orden: 1 },
            { nombre: 'Fase 2: Implementación y Ejecución', desc: 'Ejecutar las actividades planificadas del PESV', orden: 2 },
            { nombre: 'Fase 3: Seguimiento y Evaluación', desc: 'Monitorear y evaluar el desempeño del PESV', orden: 3 },
            { nombre: 'Fase 4: Mejora Continua', desc: 'Implementar acciones correctivas y de mejora', orden: 4 }
        ];

        const pasosPorFase = [
            [
                { codigo: 'P1', nombre: 'Designar Líder del PESV', desc: 'Designar el líder responsable del Plan Estratégico de Seguridad Vial' },
                { codigo: 'P2', nombre: 'Conformar Comité de Seguridad Vial', desc: 'Conformar el comité de seguridad vial con representantes de todas las áreas' },
                { codigo: 'P3', nombre: 'Definir Política de Seguridad Vial', desc: 'Establecer la política de seguridad vial de la organización' },
                { codigo: 'P4', nombre: 'Liderazgo y Compromiso Directivo', desc: 'Obtener el compromiso y liderazgo de la alta dirección' },
                { codigo: 'P5', nombre: 'Diagnóstico Línea Base', desc: 'Realizar diagnóstico inicial de la situación actual en seguridad vial' },
                { codigo: 'P6', nombre: 'Identificación de Peligros y Riesgos', desc: 'Identificar peligros y valorar riesgos de seguridad vial' },
                { codigo: 'P7', nombre: 'Definir Objetivos y Metas', desc: 'Establecer objetivos y metas medibles del PESV' },
                { codigo: 'P8', nombre: 'Plan de Gestión de Riesgos', desc: 'Elaborar el plan para gestionar los riesgos identificados' }
            ],
            [
                { codigo: 'P9', nombre: 'Plan Anual de Trabajo', desc: 'Elaborar y ejecutar el plan anual de trabajo del PESV' },
                { codigo: 'P10', nombre: 'Plan Anual de Formación', desc: 'Capacitar a todos los niveles de la organización en seguridad vial' },
                { codigo: 'P11', nombre: 'Gestión de Conductores', desc: 'Seleccionar, evaluar y hacer seguimiento a conductores' },
                { codigo: 'P12', nombre: 'Gestión de Desplazamientos', desc: 'Gestionar los desplazamientos laborales de forma segura' },
                { codigo: 'P13', nombre: 'Gestión de la Velocidad', desc: 'Implementar controles para la gestión de la velocidad' },
                { codigo: 'P14', nombre: 'Gestión de Fatiga y Distracción', desc: 'Prevenir fatiga y distracción en conductores' },
                { codigo: 'P15', nombre: 'Gestión de Alcohol y Drogas', desc: 'Prevenir el consumo de alcohol y drogas en conductores' },
                { codigo: 'P16', nombre: 'Inspección de Vehículos', desc: 'Realizar inspecciones periódicas a los vehículos' },
                { codigo: 'P17', nombre: 'Mantenimiento Preventivo', desc: 'Implementar programa de mantenimiento preventivo de vehículos' },
                { codigo: 'P18', nombre: 'Gestión de Proveedores', desc: 'Gestionar la seguridad vial de proveedores de transporte' },
                { codigo: 'P19', nombre: 'Preparación para Emergencias', desc: 'Establecer plan de respuesta ante emergencias viales' }
            ],
            [
                { codigo: 'P20', nombre: 'Indicadores de Gestión', desc: 'Definir y medir indicadores de gestión del PESV' },
                { codigo: 'P21', nombre: 'Análisis de Siniestros Viales', desc: 'Investigar y analizar los siniestros viales ocurridos' },
                { codigo: 'P22', nombre: 'Auditoría Anual del PESV', desc: 'Realizar auditoría anual al sistema de gestión de seguridad vial' }
            ],
            [
                { codigo: 'P23', nombre: 'Acciones Correctivas y Preventivas', desc: 'Implementar acciones correctivas y preventivas derivadas del análisis' },
                { codigo: 'P24', nombre: 'Revisión por la Dirección', desc: 'Realizar revisión del PESV por parte de la alta dirección' },
                { codigo: 'P25', nombre: 'Comunicación y Participación', desc: 'Comunicar resultados y fomentar la participación en seguridad vial' }
            ]
        ];

        for (let i = 0; i < fases.length; i++) {
            const [fResult] = await conn.execute('INSERT INTO fases (empresa_id, nombre, descripcion, orden) VALUES (?, ?, ?, ?)',
                [empresaId, fases[i].nombre, fases[i].desc, fases[i].orden]);
            const pasos = pasosPorFase[i];
            for (let j = 0; j < pasos.length; j++) {
                await conn.execute('INSERT INTO pasos (fase_id, empresa_id, codigo, nombre, descripcion, orden) VALUES (?, ?, ?, ?, ?, ?)',
                    [fResult.insertId, empresaId, pasos[j].codigo, pasos[j].nombre, pasos[j].desc, j + 1]);
            }
        }
    } finally {
        conn.release();
    }
}

// Helper functions
async function queryAll(sql, params = []) {
    const p = await getPool();
    const [rows] = await p.execute(sql, params);
    return rows;
}

async function queryGet(sql, params = []) {
    const rows = await queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

async function queryRun(sql, params = []) {
    const p = await getPool();
    const [result] = await p.execute(sql, params);
    return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

module.exports = { getPool, queryAll, queryGet, queryRun };