#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Configurando para despliegue en Render...\n');

// Check if we're in production
if (process.env.NODE_ENV !== 'production') {
  console.log('⚠️  Este script está diseñado para ejecutarse en producción');
  console.log('NODE_ENV actual:', process.env.NODE_ENV || 'undefined');
}

// Verify required environment variables for production
const requiredProductionVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET'
];

const optionalProductionVars = [
  'REDIS_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WORKER_API_URL',
  'WORKER_API_TOKEN'
];

console.log('📋 Verificación de variables de entorno de producción:');

let missingRequired = [];
requiredProductionVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Configurado`);
  } else {
    console.log(`❌ ${envVar}: FALTANTE (Requerido)`);
    missingRequired.push(envVar);
  }
});

optionalProductionVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Configurado`);
  } else {
    console.log(`⚠️  ${envVar}: No configurado (Opcional pero recomendado)`);
  }
});

if (missingRequired.length > 0) {
  console.log('\n❌ Variables de entorno requeridas faltantes:');
  missingRequired.forEach(env => console.log(`   - ${env}`));
  console.log('\nConfigura estas variables en el dashboard de Render antes de continuar.');
  process.exit(1);
}

// Check database connection
console.log('\n🔍 Verificando conexión a base de datos...');
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL configurado');
  if (process.env.DATABASE_URL.includes('postgres://')) {
    console.log('✅ Usando PostgreSQL (recomendado para producción)');
  }
} else {
  console.log('❌ DATABASE_URL no configurado');
}

// Check Redis connection
console.log('\n🔍 Verificando conexión a Redis...');
if (process.env.REDIS_URL) {
  console.log('✅ REDIS_URL configurado para background jobs');
} else {
  console.log('⚠️  REDIS_URL no configurado - background jobs no funcionarán');
}

// Check Supabase configuration
console.log('\n🔍 Verificando configuración de Supabase...');
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  console.log('✅ Configuración básica de Supabase completa');
  
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('✅ Service Role Key configurado (funcionalidad completa)');
  } else {
    console.log('⚠️  Service Role Key no configurado (funcionalidad limitada)');
  }
} else {
  console.log('❌ Configuración de Supabase incompleta');
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('\n✅ Directorio logs/ creado para producción');
}

// Verify critical files exist
const criticalFiles = [
  'index.js',
  'config/supabase.js',
  'config/redis.js',
  'services/supabaseService.js',
  'services/workerService.js',
  'services/queueService.js'
];

console.log('\n🔍 Verificando archivos críticos...');
let missingFiles = [];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file}: Encontrado`);
  } else {
    console.log(`❌ ${file}: FALTANTE`);
    missingFiles.push(file);
  }
});

if (missingFiles.length > 0) {
  console.log('\n❌ Archivos críticos faltantes:');
  missingFiles.forEach(file => console.log(`   - ${file}`));
  console.log('\nVerifica que todos los archivos fueron incluidos en el despliegue.');
  process.exit(1);
}

// Display service URLs and health checks
console.log('\n🌐 URLs de servicio en Render:');
console.log(`📱 API: https://mi-api.onrender.com`);
console.log(`🔍 Health: https://mi-api.onrender.com/health`);
console.log(`📚 Docs: https://mi-api.onrender.com/api-docs`);

console.log('\n🎉 Configuración para Render completada exitosamente!');
console.log('\n📋 Checklist post-despliegue:');
console.log('1. ✓ Variables de entorno configuradas en Render');
console.log('2. ✓ Servicios Redis y PostgreSQL creados');
console.log('3. ⚠️  Crear tablas en Supabase (ver RENDER_DEPLOYMENT_GUIDE.md)');
console.log('4. ⚠️  Configurar background worker si es necesario');
console.log('5. ⚠️  Probar endpoints principales');
console.log('\n🔗 Próximo: Accede a https://mi-api.onrender.com/health para verificar');