#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Configurando la integración de Supabase y Background Worker...\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Archivo .env creado desde .env.example');
  } else {
    console.log('❌ Archivo .env.example no encontrado');
    process.exit(1);
  }
} else {
  console.log('ℹ️  Archivo .env ya existe');
}

// Check dependencies
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredDeps = [
  '@supabase/supabase-js',
  'bull',
  'redis',
  'axios',
  'dotenv'
];

const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

if (missingDeps.length > 0) {
  console.log('❌ Dependencias faltantes:', missingDeps.join(', '));
  console.log('Ejecuta: npm install ' + missingDeps.join(' '));
  process.exit(1);
} else {
  console.log('✅ Todas las dependencias requeridas están instaladas');
}

// Check environment variables
require('dotenv').config();

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET'
];

const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'REDIS_HOST',
  'WORKER_API_URL',
  'WORKER_API_TOKEN'
];

console.log('\n📋 Verificación de variables de entorno:');

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Configurado`);
  } else {
    console.log(`❌ ${envVar}: FALTANTE (Requerido)`);
  }
});

optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Configurado`);
  } else {
    console.log(`⚠️  ${envVar}: No configurado (Opcional)`);
  }
});

// Create services directory if it doesn't exist
const servicesDir = path.join(__dirname, '..', 'services');
if (!fs.existsSync(servicesDir)) {
  fs.mkdirSync(servicesDir);
  console.log('\n✅ Directorio services/ creado');
}

// Create config directory if it doesn't exist
const configDir = path.join(__dirname, '..', 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir);
  console.log('✅ Directorio config/ creado');
}

console.log('\n🎉 Configuración completada!');
console.log('\n📚 Próximos pasos:');
console.log('1. Configura las variables de entorno en el archivo .env');
console.log('2. Crea las tablas necesarias en Supabase (ver INTEGRATION_GUIDE.md)');
console.log('3. Configura Redis si planeas usar background workers');
console.log('4. Implementa los endpoints en tu background worker externo');
console.log('5. Ejecuta: npm start');
console.log('\n📖 Para más información, consulta: INTEGRATION_GUIDE.md');