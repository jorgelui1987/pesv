const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getPool } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' }
});
app.use('/api/', limiter);

// ============ RUTAS API ============

// --- Auth ---
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// --- Empresas ---
const empresaRoutes = require('./routes/empresas');
app.use('/api/empresas', empresaRoutes);

// --- Fases ---
const faseRoutes = require('./routes/fases');
app.use('/api/fases', faseRoutes);

// --- Pasos ---
const pasoRoutes = require('./routes/pasos');
app.use('/api/pasos', pasoRoutes);

// --- Evidencias ---
const evidenciaRoutes = require('./routes/evidencias');
app.use('/api/evidencias', evidenciaRoutes);

// --- Indicadores ---
const indicadorRoutes = require('./routes/indicadores');
app.use('/api/indicadores', indicadorRoutes);

// --- Reportes ---
const reporteRoutes = require('./routes/reportes');
app.use('/api/reportes', reporteRoutes);

// --- Dashboard ---
const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);

// --- Acciones de Mejora ---
const accionesRoutes = require('./routes/acciones');
app.use('/api/acciones', accionesRoutes);

// --- Auditorías ---
const auditoriaRoutes = require('./routes/auditorias');
app.use('/api/auditorias', auditoriaRoutes);

// --- Resoluciones ---
const resolucionRoutes = require('./routes/resoluciones');
app.use('/api/resoluciones', resolucionRoutes);

// --- Super Admin ---
const superAdminRoutes = require('./routes/superadmin');
app.use('/api/superadmin', superAdminRoutes);

// Ruta principal - Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Ruta de la aplicación SPA
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Redirigir cualquier otra ruta a la landing
app.use((req, res) => {
    res.redirect('/');
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

// Inicializar pool y arrancar servidor
getPool().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor PESV Integral corriendo en http://localhost:${PORT}`);
        console.log(`📧 Admin demo: admin@pesv.com / admin123`);
        console.log(`📧 Coordinador demo: coordinador@pesv.com / coord123`);
        console.log(`📦 Base de datos MySQL: pesv_integral`);
    });
}).catch(err => {
    console.error('Error al conectar con MySQL:', err);
    process.exit(1);
});
