-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jul 29, 2026 at 06:44 PM
-- Server version: 8.4.3
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pesv_integral`
--

-- --------------------------------------------------------

--
-- Table structure for table `acciones_mejora`
--

CREATE TABLE `acciones_mejora` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `origen` varchar(255) DEFAULT NULL,
  `descripcion` text NOT NULL,
  `responsable` varchar(255) DEFAULT NULL,
  `fecha_compromiso` date DEFAULT NULL,
  `estado` enum('abierta','en_proceso','cerrada') DEFAULT 'abierta',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditorias`
--

CREATE TABLE `auditorias` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `tipo` enum('interna','externa') DEFAULT 'interna',
  `fecha` date NOT NULL,
  `auditor` varchar(255) DEFAULT NULL,
  `hallazgos` text,
  `resultado` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `empresas`
--

CREATE TABLE `empresas` (
  `id` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `nit` varchar(50) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `email_contacto` varchar(255) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `activo` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `empresas`
--

INSERT INTO `empresas` (`id`, `nombre`, `nit`, `direccion`, `telefono`, `email_contacto`, `logo_url`, `activo`, `created_at`) VALUES
(1, 'Empresa Demo PESV', '900.123.456-7', NULL, NULL, NULL, NULL, 1, '2026-07-29 14:31:57');

-- --------------------------------------------------------

--
-- Table structure for table `evidencias`
--

CREATE TABLE `evidencias` (
  `id` int NOT NULL,
  `paso_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `estado` enum('pendiente','en_proceso','finalizado','no_aplica') DEFAULT 'pendiente',
  `descripcion` text,
  `archivo_nombre` varchar(255) DEFAULT NULL,
  `archivo_ruta` varchar(500) DEFAULT NULL,
  `observaciones` text,
  `fecha_ejecucion` date DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fases`
--

CREATE TABLE `fases` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text,
  `orden` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `fases`
--

INSERT INTO `fases` (`id`, `empresa_id`, `nombre`, `descripcion`, `orden`, `created_at`) VALUES
(1, 1, 'Fase 1: Planificación (PHVA)', 'Planificar la gestión de seguridad vial en la organización', 1, '2026-07-29 14:31:57'),
(2, 1, 'Fase 2: Implementación y Ejecución', 'Ejecutar las actividades planificadas del PESV', 2, '2026-07-29 14:31:57'),
(3, 1, 'Fase 3: Seguimiento y Evaluación', 'Monitorear y evaluar el desempeño del PESV', 3, '2026-07-29 14:31:57'),
(4, 1, 'Fase 4: Mejora Continua', 'Implementar acciones correctivas y de mejora', 4, '2026-07-29 14:31:57');

-- --------------------------------------------------------

--
-- Table structure for table `indicadores`
--

CREATE TABLE `indicadores` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text,
  `formula` text,
  `meta` decimal(10,2) DEFAULT NULL,
  `periodo` enum('mensual','trimestral','semestral','anual') DEFAULT 'mensual',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pasos`
--

CREATE TABLE `pasos` (
  `id` int NOT NULL,
  `fase_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `codigo` varchar(10) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text,
  `responsable` varchar(255) DEFAULT NULL,
  `fecha_limite` date DEFAULT NULL,
  `orden` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pasos`
--

INSERT INTO `pasos` (`id`, `fase_id`, `empresa_id`, `codigo`, `nombre`, `descripcion`, `responsable`, `fecha_limite`, `orden`, `created_at`) VALUES
(1, 1, 1, 'P1', 'Designar Líder del PESV', 'Designar el líder responsable del Plan Estratégico de Seguridad Vial', NULL, NULL, 1, '2026-07-29 14:31:57'),
(2, 1, 1, 'P2', 'Conformar Comité de Seguridad Vial', 'Conformar el comité de seguridad vial con representantes de todas las áreas', NULL, NULL, 2, '2026-07-29 14:31:57'),
(3, 1, 1, 'P3', 'Definir Política de Seguridad Vial', 'Establecer la política de seguridad vial de la organización', NULL, NULL, 3, '2026-07-29 14:31:57'),
(4, 1, 1, 'P4', 'Liderazgo y Compromiso Directivo', 'Obtener el compromiso y liderazgo de la alta dirección', NULL, NULL, 4, '2026-07-29 14:31:57'),
(5, 1, 1, 'P5', 'Diagnóstico Línea Base', 'Realizar diagnóstico inicial de la situación actual en seguridad vial', NULL, NULL, 5, '2026-07-29 14:31:57'),
(6, 1, 1, 'P6', 'Identificación de Peligros y Riesgos', 'Identificar peligros y valorar riesgos de seguridad vial', NULL, NULL, 6, '2026-07-29 14:31:57'),
(7, 1, 1, 'P7', 'Definir Objetivos y Metas', 'Establecer objetivos y metas medibles del PESV', NULL, NULL, 7, '2026-07-29 14:31:57'),
(8, 1, 1, 'P8', 'Plan de Gestión de Riesgos', 'Elaborar el plan para gestionar los riesgos identificados', NULL, NULL, 8, '2026-07-29 14:31:57'),
(9, 2, 1, 'P9', 'Plan Anual de Trabajo', 'Elaborar y ejecutar el plan anual de trabajo del PESV', NULL, NULL, 1, '2026-07-29 14:31:57'),
(10, 2, 1, 'P10', 'Plan Anual de Formación', 'Capacitar a todos los niveles de la organización en seguridad vial', NULL, NULL, 2, '2026-07-29 14:31:57'),
(11, 2, 1, 'P11', 'Gestión de Conductores', 'Seleccionar, evaluar y hacer seguimiento a conductores', NULL, NULL, 3, '2026-07-29 14:31:57'),
(12, 2, 1, 'P12', 'Gestión de Desplazamientos', 'Gestionar los desplazamientos laborales de forma segura', NULL, NULL, 4, '2026-07-29 14:31:57'),
(13, 2, 1, 'P13', 'Gestión de la Velocidad', 'Implementar controles para la gestión de la velocidad', NULL, NULL, 5, '2026-07-29 14:31:57'),
(14, 2, 1, 'P14', 'Gestión de Fatiga y Distracción', 'Prevenir fatiga y distracción en conductores', NULL, NULL, 6, '2026-07-29 14:31:57'),
(15, 2, 1, 'P15', 'Gestión de Alcohol y Drogas', 'Prevenir el consumo de alcohol y drogas en conductores', NULL, NULL, 7, '2026-07-29 14:31:57'),
(16, 2, 1, 'P16', 'Inspección de Vehículos', 'Realizar inspecciones periódicas a los vehículos', NULL, NULL, 8, '2026-07-29 14:31:57'),
(17, 2, 1, 'P17', 'Mantenimiento Preventivo', 'Implementar programa de mantenimiento preventivo de vehículos', NULL, NULL, 9, '2026-07-29 14:31:57'),
(18, 2, 1, 'P18', 'Gestión de Proveedores', 'Gestionar la seguridad vial de proveedores de transporte', NULL, NULL, 10, '2026-07-29 14:31:57'),
(19, 2, 1, 'P19', 'Preparación para Emergencias', 'Establecer plan de respuesta ante emergencias viales', NULL, NULL, 11, '2026-07-29 14:31:57'),
(20, 3, 1, 'P20', 'Indicadores de Gestión', 'Definir y medir indicadores de gestión del PESV', NULL, NULL, 1, '2026-07-29 14:31:57'),
(21, 3, 1, 'P21', 'Análisis de Siniestros Viales', 'Investigar y analizar los siniestros viales ocurridos', NULL, NULL, 2, '2026-07-29 14:31:57'),
(22, 3, 1, 'P22', 'Auditoría Anual del PESV', 'Realizar auditoría anual al sistema de gestión de seguridad vial', NULL, NULL, 3, '2026-07-29 14:31:57'),
(23, 4, 1, 'P23', 'Acciones Correctivas y Preventivas', 'Implementar acciones correctivas y preventivas derivadas del análisis', NULL, NULL, 1, '2026-07-29 14:31:57'),
(24, 4, 1, 'P24', 'Revisión por la Dirección', 'Realizar revisión del PESV por parte de la alta dirección', NULL, NULL, 2, '2026-07-29 14:31:57'),
(25, 4, 1, 'P25', 'Comunicación y Participación', 'Comunicar resultados y fomentar la participación en seguridad vial', NULL, NULL, 3, '2026-07-29 14:31:57');

-- --------------------------------------------------------

--
-- Table structure for table `registros_indicadores`
--

CREATE TABLE `registros_indicadores` (
  `id` int NOT NULL,
  `indicador_id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `fecha` date NOT NULL,
  `observaciones` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int NOT NULL,
  `empresa_id` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` enum('admin','coordinador','consultor','auditor') DEFAULT 'coordinador',
  `activo` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `usuarios`
--

INSERT INTO `usuarios` (`id`, `empresa_id`, `nombre`, `email`, `password`, `rol`, `activo`, `created_at`) VALUES
(1, 1, 'Admin PESV', 'jesuscastrosg@gmail.com', '$2a$10$Dsrbfis1frbHueKBl3XsHuQUVDqTX/zEGbbmRyzsD8dE2nFwFsOya', 'admin', 1, '2026-07-29 14:31:57'),
(2, 1, 'Coordinador Demo', 'coordinador@pesv.com', '$2a$10$Ug7kpdr61vsABf6ILRc6OuWOYKSnHUsRw9NQQJuiX6X9XT4vCSrYu', 'coordinador', 1, '2026-07-29 14:31:57');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `acciones_mejora`
--
ALTER TABLE `acciones_mejora`
  ADD PRIMARY KEY (`id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `auditorias`
--
ALTER TABLE `auditorias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `empresas`
--
ALTER TABLE `empresas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nit` (`nit`);

--
-- Indexes for table `evidencias`
--
ALTER TABLE `evidencias`
  ADD PRIMARY KEY (`id`),
  ADD KEY `paso_id` (`paso_id`),
  ADD KEY `empresa_id` (`empresa_id`),
  ADD KEY `usuario_id` (`usuario_id`);

--
-- Indexes for table `fases`
--
ALTER TABLE `fases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `indicadores`
--
ALTER TABLE `indicadores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `pasos`
--
ALTER TABLE `pasos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fase_id` (`fase_id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `registros_indicadores`
--
ALTER TABLE `registros_indicadores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `indicador_id` (`indicador_id`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- Indexes for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `empresa_id` (`empresa_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `acciones_mejora`
--
ALTER TABLE `acciones_mejora`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditorias`
--
ALTER TABLE `auditorias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `empresas`
--
ALTER TABLE `empresas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `evidencias`
--
ALTER TABLE `evidencias`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fases`
--
ALTER TABLE `fases`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `indicadores`
--
ALTER TABLE `indicadores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pasos`
--
ALTER TABLE `pasos`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `registros_indicadores`
--
ALTER TABLE `registros_indicadores`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `acciones_mejora`
--
ALTER TABLE `acciones_mejora`
  ADD CONSTRAINT `acciones_mejora_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `auditorias`
--
ALTER TABLE `auditorias`
  ADD CONSTRAINT `auditorias_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `evidencias`
--
ALTER TABLE `evidencias`
  ADD CONSTRAINT `evidencias_ibfk_1` FOREIGN KEY (`paso_id`) REFERENCES `pasos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evidencias_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evidencias_ibfk_3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fases`
--
ALTER TABLE `fases`
  ADD CONSTRAINT `fases_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `indicadores`
--
ALTER TABLE `indicadores`
  ADD CONSTRAINT `indicadores_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pasos`
--
ALTER TABLE `pasos`
  ADD CONSTRAINT `pasos_ibfk_1` FOREIGN KEY (`fase_id`) REFERENCES `fases` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pasos_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `registros_indicadores`
--
ALTER TABLE `registros_indicadores`
  ADD CONSTRAINT `registros_indicadores_ibfk_1` FOREIGN KEY (`indicador_id`) REFERENCES `indicadores` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `registros_indicadores_ibfk_2` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
