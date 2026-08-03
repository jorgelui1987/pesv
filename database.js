const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Mensajes de error típicos cuando el servidor PostgreSQL no soporta SSL
const SSL_ERROR_MESSAGES = [
    'The server does not support SSL connections',
    'no pg_hba.conf entry',
    'SSL connection is required'
];

// Determina la configuración SSL de forma segura.
// Prioridad: DB_SSL explícito > PGSSLMODE estándar > sin SSL por defecto.
// Esto evita el error "The server does not support SSL connections"
// cuando el proveedor de BD no soporta SSL.
function getSSLConfig() {
    // 1. Configuración explícita con DB_SSL
    if (process.env.DB_SSL !== undefined && process.env.DB_SSL !== '') {
        const val = process.env.DB_SSL.toLowerCase();
        if (val === 'true' || val === '1' || val === 'require' || val === 'required') {
            return { rejectUnauthorized: false };
        }
        return undefined; // SSL desactivado explícitamente
    }

    // 2. PGSSLMODE estándar de PostgreSQL
    if (process.env.PGSSLMODE) {
        const mode = process.env.PGSSLMODE.toLowerCase();
        if (['require', 'verify-ca', 'verify-full', 'no-verify', 'prefer'].includes(mode)) {
            return { rejectUnauthorized: false };
        }
        return undefined;
    }

    // 3. Por defecto: SIN SSL (compatible con PostgreSQL local y proveedores sin SSL)
    return undefined;
}

function getDBConfig() {
    const config = {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    };

    // Soporte para DATABASE_URL estándar (Railway, Docploy, Heroku, etc.)
    if (process.env.DATABASE_URL) {
        const parsed = new URL(process.env.DATABASE_URL);
        config.host = parsed.hostname;
        config.port = parseInt(parsed.port, 10) || 5432;
        config.user = decodeURIComponent(parsed.username);
        config.password = decodeURIComponent(parsed.password);
        config.database = parsed.pathname.replace(/^\//, '');

        // Respetar ?sslmode=... si viene en la URL
        const sslModeParam = parsed.searchParams.get('sslmode');
        if (sslModeParam) {
            const mode = sslModeParam.toLowerCase();
            if (['require', 'verify-ca', 'verify-full', 'no-verify', 'prefer'].includes(mode)) {
                config.ssl = { rejectUnauthorized: false };
            }
        } else {
            config.ssl = getSSLConfig();
        }
        return config;
    }

    config.host = process.env.DB_HOST || 'localhost';
    config.user = process.env.DB_USERNAME || process.env.DB_USER || 'postgres';
    config.password = process.env.DB_PASSWORD || '';
    config.database = process.env.DB_DATABASE || process.env.DB_NAME || 'pesv_integral';
    config.port = parseInt(process.env.DB_PORT, 10) || 5432;

    config.ssl = getSSLConfig();

    return config;
}

const DB_CONFIG = getDBConfig();

// Log de diagnóstico (sin exponer la contraseña)
console.log(`🔌 Config PostgreSQL → host: ${DB_CONFIG.host}, db: ${DB_CONFIG.database}, user: ${DB_CONFIG.user}, ssl: ${DB_CONFIG.ssl ? 'activado' : 'desactivado'}`);

let pool = null;

// Configura los manejadores de eventos del pool.
// En entornos gestionados (Docploy, Railway, Heroku, etc.) el proveedor puede
// cerrar conexiones por mantenimiento o timeout ("terminating connection due to
// administrator command"). El pool de pg los detecta y reconecta automáticamente,
// por lo que se muestra como aviso y no como error fatal.
function setupPoolHandlers(pool) {
    pool.on('error', (err) => {
        if (err.message && err.message.includes('terminating connection')) {
            console.warn('🔄 PostgreSQL cerró una conexión (mantenimiento/reinicio del proveedor). El pool reconectará automáticamente.');
        } else {
            console.error('Error inesperado en el pool de PostgreSQL:', err.message);
        }
    });
    return pool;
}

// Si el servidor no soporta SSL pero teníamos SSL activado, reintenta sin SSL.
// Esto cubre proveedores que inyectan DATABASE_URL con ?sslmode=require
// pero cuyo PostgreSQL no soporta conexiones SSL.
async function getPool() {
    if (!pool) {
        pool = setupPoolHandlers(new Pool(DB_CONFIG));

        try {
            await createTables();
            await seedData();
        } catch (err) {
            const isSslError = SSL_ERROR_MESSAGES.some(msg => err.message && err.message.includes(msg));

            if (isSslError && DB_CONFIG.ssl) {
                console.warn('⚠️  El servidor no soporta SSL. Reintentando sin SSL...');
                DB_CONFIG.ssl = undefined;
                pool = setupPoolHandlers(new Pool(DB_CONFIG));
                await createTables();
                await seedData();
            } else {
                throw err;
            }
        }
    }
    return pool;
}

async function createTables() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS empresas (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                nit VARCHAR(50) UNIQUE NOT NULL,
                direccion VARCHAR(255),
                telefono VARCHAR(50),
                email_contacto VARCHAR(255),
                logo_url VARCHAR(500),
                activo SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                rol VARCHAR(20) DEFAULT 'coordinador' CHECK (rol IN ('admin','coordinador','consultor','auditor')),
                activo SMALLINT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS fases (
                id SERIAL PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                orden INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS pasos (
                id SERIAL PRIMARY KEY,
                fase_id INT NOT NULL,
                empresa_id INT NOT NULL,
                codigo VARCHAR(10) NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                responsable VARCHAR(255),
                fecha_limite DATE,
                orden INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (fase_id) REFERENCES fases(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS evidencias (
                id SERIAL PRIMARY KEY,
                paso_id INT NOT NULL,
                empresa_id INT NOT NULL,
                usuario_id INT NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','finalizado','no_aplica')),
                descripcion TEXT,
                archivo_nombre VARCHAR(255),
                archivo_ruta VARCHAR(500),
                observaciones TEXT,
                fecha_ejecucion DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (paso_id) REFERENCES pasos(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS indicadores (
                id SERIAL PRIMARY KEY,
                empresa_id INT NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                descripcion TEXT,
                formula TEXT,
                meta DECIMAL(10,2),
                periodo VARCHAR(20) DEFAULT 'mensual' CHECK (periodo IN ('mensual','trimestral','semestral','anual')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS registros_indicadores (
                id SERIAL PRIMARY KEY,
                indicador_id INT NOT NULL,
                empresa_id INT NOT NULL,
                valor DECIMAL(10,2) NOT NULL,
                fecha DATE NOT NULL,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (indicador_id) REFERENCES indicadores(id) ON DELETE CASCADE,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS auditorias (
                id SERIAL PRIMARY KEY,
                empresa_id INT NOT NULL,
                tipo VARCHAR(20) DEFAULT 'interna' CHECK (tipo IN ('interna','externa')),
                fecha DATE NOT NULL,
                auditor VARCHAR(255),
                hallazgos TEXT,
                resultado TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS acciones_mejora (
                id SERIAL PRIMARY KEY,
                empresa_id INT NOT NULL,
                origen VARCHAR(255),
                descripcion TEXT NOT NULL,
                responsable VARCHAR(255),
                fecha_compromiso DATE,
                estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta','en_proceso','cerrada')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
            )
        `);

        // Trigger para actualizar updated_at en evidencias
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await client.query(`
            DROP TRIGGER IF EXISTS update_evidencias_updated_at ON evidencias;
            CREATE TRIGGER update_evidencias_updated_at
            BEFORE UPDATE ON evidencias
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        `);
    } finally {
        client.release();
    }
}

async function seedData() {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT COUNT(*) as c FROM empresas');
        if (parseInt(result.rows[0].c) > 0) {
            // Migración del super admin:
            // Cambiar el correo personal (jesuscastrosg@gmail.com) por el correo
            // genérico admin@pesv.com, manteniendo la contraseña Castro161219@.
            const hash = bcrypt.hashSync('Castro161219@', 10);

            // 1. Buscar si existe el usuario con el correo personal
            const personalAdmin = await client.query(
                'SELECT id FROM usuarios WHERE email = $1',
                ['jesuscastrosg@gmail.com']
            );

            if (personalAdmin.rows.length > 0) {
                // 2. Eliminar cualquier admin@pesv.com duplicado (evita violar UNIQUE)
                await client.query(
                    'DELETE FROM usuarios WHERE email = $1 AND id != $2',
                    ['admin@pesv.com', personalAdmin.rows[0].id]
                );
                // 3. Renombrar el correo personal a admin@pesv.com y fijar contraseña
                await client.query(
                    'UPDATE usuarios SET email = $1, password = $2 WHERE id = $3',
                    ['admin@pesv.com', hash, personalAdmin.rows[0].id]
                );
            } else {
                // 4. Si no existe el correo personal, asegurar que admin@pesv.com
                //    tenga la contraseña correcta
                await client.query(
                    'UPDATE usuarios SET password = $1 WHERE email = $2 AND rol = $3',
                    [hash, 'admin@pesv.com', 'admin']
                );
            }
            return;
        }

        // Empresa demo
        const empResult = await client.query(
            'INSERT INTO empresas (nombre, nit) VALUES ($1, $2) RETURNING id',
            ['Empresa Demo PESV', '900.123.456-7']
        );
        const empresaId = empResult.rows[0].id;

        // Usuarios demo
        const hash = bcrypt.hashSync('Castro161219@', 10);
        await client.query(
            'INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)',
            [empresaId, 'Admin PESV', 'admin@pesv.com', hash, 'admin']
        );

        const hash2 = bcrypt.hashSync('coord123', 10);
        await client.query(
            'INSERT INTO usuarios (empresa_id, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)',
            [empresaId, 'Coordinador Demo', 'coordinador@pesv.com', hash2, 'coordinador']
        );

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
            const fResult = await client.query(
                'INSERT INTO fases (empresa_id, nombre, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING id',
                [empresaId, fases[i].nombre, fases[i].desc, fases[i].orden]
            );
            const pasos = pasosPorFase[i];
            for (let j = 0; j < pasos.length; j++) {
                await client.query(
                    'INSERT INTO pasos (fase_id, empresa_id, codigo, nombre, descripcion, orden) VALUES ($1, $2, $3, $4, $5, $6)',
                    [fResult.rows[0].id, empresaId, pasos[j].codigo, pasos[j].nombre, pasos[j].desc, j + 1]
                );
            }
        }
    } finally {
        client.release();
    }
}

// Helper functions
async function queryAll(sql, params = []) {
    const p = await getPool();
    const result = await p.query(sql, params);
    return result.rows;
}

async function queryGet(sql, params = []) {
    const rows = await queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

async function queryRun(sql, params = []) {
    const p = await getPool();
    const result = await p.query(sql, params);
    return { lastInsertRowid: result.rows[0]?.id || null, changes: result.rowCount };
}

module.exports = { getPool, queryAll, queryGet, queryRun };