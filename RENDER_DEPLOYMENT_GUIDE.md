# 🚀 Guía de Despliegue en Render

Esta guía te lleva paso a paso para desplegar tu API REST con integraciones de Supabase y Background Workers en Render.

## 📋 Prerrequisitos

- [ ] Cuenta en [Render.com](https://render.com)
- [ ] Cuenta en [Supabase.com](https://supabase.com)
- [ ] Repositorio Git con tu código
- [ ] Configuración local funcionando

## 🛠️ Paso 1: Preparación del Repositorio

### 1.1. Verificar Archivos de Configuración

Asegúrate de que estos archivos estén en tu repositorio:

```
✅ .render.yaml              # Configuración de servicios
✅ package.json              # Scripts actualizados
✅ scripts/render-setup.js   # Script de setup para producción
✅ index.js                  # Servidor principal
✅ config/                   # Configuraciones
✅ services/                 # Servicios de Supabase y Workers
✅ routes/                   # Nuevas rutas
```

### 1.2. Verificar package.json

Tu `package.json` debe incluir:

```json
{
  "scripts": {
    "start": "node index.js",
    "build": "npm install",
    "postbuild": "node scripts/render-setup.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## 🌐 Paso 2: Configuración en Render

### 2.1. Crear Nuevo Web Service

1. **Accede a Render Dashboard**
   - Ve a [dashboard.render.com](https://dashboard.render.com)
   - Haz clic en "New +"

2. **Conectar Repositorio**
   - Selecciona "Web Service"
   - Conecta tu repositorio de GitHub/GitLab
   - Selecciona la rama `main` o `master`

3. **Configuración Básica**
   ```
   Name: mi-api
   Environment: Node
   Region: Oregon (US West) - o la más cercana
   Branch: main
   Build Command: npm install
   Start Command: npm start
   ```

### 2.2. Configurar Variables de Entorno

En la sección "Environment", agrega estas variables:

#### ✅ Variables Requeridas:

```bash
# Base de datos (se configurará automáticamente)
DATABASE_URL=postgresql://... # Auto-configurado por Render

# Supabase (obtén de tu proyecto Supabase)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Autenticación
JWT_SECRET=tu-jwt-secret-super-seguro-aqui

# Configuración del servidor
NODE_ENV=production
PORT=3000
```

#### ⚠️ Variables Opcionales:

```bash
# Redis (se configurará automáticamente si usas .render.yaml)
REDIS_URL=redis://... # Auto-configurado por Render

# Background Worker (si tienes uno separado)
WORKER_API_URL=https://tu-worker.onrender.com
WORKER_API_TOKEN=tu-token-del-worker
```

### 2.3. Configurar Health Check

```
Health Check Path: /health
```

## 🗄️ Paso 3: Configurar Servicios Adicionales

### 3.1. PostgreSQL Database

Si usas `.render.yaml`:
```yaml
databases:
  - name: mi-api-db
    databaseName: mi_api_production
    user: mi_api_user
    plan: free
```

O manualmente:
1. Ve a "New +" → "PostgreSQL"
2. Configura:
   ```
   Name: mi-api-db
   Database: mi_api_production
   User: mi_api_user
   Plan: Free
   ```

### 3.2. Redis (Para Background Jobs)

Si usas `.render.yaml`:
```yaml
services:
  - type: redis
    name: mi-api-redis
    plan: free
    maxmemoryPolicy: allkeys-lru
```

O manualmente:
1. Ve a "New +" → "Redis"
2. Configura:
   ```
   Name: mi-api-redis
   Plan: Free
   Max Memory Policy: allkeys-lru
   ```

## 🔧 Paso 4: Configuración de Supabase

### 4.1. Obtener Credenciales

1. **Ve a tu proyecto Supabase**
   - Settings → API
   - Copia: URL, anon key, service_role key

2. **Configurar en Render**
   - Agrega las variables de entorno como se mostró arriba

### 4.2. Crear Tablas Necesarias

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Tabla de usuarios (sincronizada con Sequelize)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR UNIQUE NOT NULL,
  nombre VARCHAR NOT NULL,
  email VARCHAR,
  sequelize_id INTEGER,
  login_count INTEGER DEFAULT 0,
  last_login TIMESTAMPTZ,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by INTEGER,
  updated_by INTEGER
);

-- Habilitar Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política básica de acceso
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Tabla de ejemplo para productos (opcional)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  price DECIMAL(10,2),
  category VARCHAR,
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER,
  updated_by INTEGER
);

-- Tabla para logs de eventos (opcional)
CREATE TABLE IF NOT EXISTS event_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  user_id INTEGER,
  data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3. Configurar RLS (Row Level Security)

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de ejemplo
CREATE POLICY "Public products are viewable by everyone" 
ON products FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own events" 
ON event_logs FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);
```

## 🚀 Paso 5: Despliegue

### 5.1. Deploy Automático con .render.yaml

1. **Commit y Push**
   ```bash
   git add .
   git commit -m "Configure for Render deployment"
   git push origin main
   ```

2. **En Render Dashboard**
   - Ve a "Blueprint" → "New Blueprint Instance"
   - Selecciona tu repositorio
   - Render creará automáticamente todos los servicios

### 5.2. Deploy Manual

1. **Crear Web Service**
   - Sigue los pasos del Paso 2

2. **Deploy**
   - Render iniciará el build automáticamente
   - Monitor en la pestaña "Logs"

## 🔍 Paso 6: Verificación Post-Despliegue

### 6.1. Health Check

```bash
curl https://tu-api.onrender.com/health
```

Respuesta esperada:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "sequelize": "Connected",
    "redis": "Configured",
    "supabase": "Configured",
    "worker": "Configured"
  },
  "environment": "production"
}
```

### 6.2. Probar Endpoints Principales

```bash
# Documentación API
curl https://tu-api.onrender.com/api-docs

# Registro de usuario
curl -X POST https://tu-api.onrender.com/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123",
    "nombre": "Usuario Test",
    "email": "test@example.com"
  }'

# Estado de worker
curl https://tu-api.onrender.com/api/worker/queue/stats \
  -H "Authorization: Bearer tu-jwt-token"
```

### 6.3. Verificar Logs

En Render Dashboard:
- Ve a tu servicio → "Logs"
- Busca mensajes como:
  ```
  ✅ Sequelize connected and synced
  ✅ Redis connected for background job processing
  ✅ Supabase configured
  🚀 Servidor corriendo en puerto 3000
  ```

## 🐛 Troubleshooting

### Errores Comunes:

#### 1. **Build Failed**
```
Error: Cannot find module '@supabase/supabase-js'
```

**Solución:**
- Verifica que `package.json` tiene todas las dependencias
- Ejecuta `npm install` localmente para verificar

#### 2. **Database Connection Failed**
```
Error: connect ECONNREFUSED
```

**Solución:**
- Verifica que `DATABASE_URL` esté configurado
- Asegúrate de que la base de datos PostgreSQL esté creada

#### 3. **Supabase Not Configured**
```
Error: Missing Supabase environment variables
```

**Solución:**
- Verifica `SUPABASE_URL` y `SUPABASE_ANON_KEY`
- Comprueba que no hay espacios extra en las variables

#### 4. **Redis Connection Issues**
```
Error: Redis connection failed
```

**Solución:**
- Verifica que el servicio Redis esté creado
- Comprueba que `REDIS_URL` se esté configurando automáticamente

### Comandos de Debug:

```bash
# Ver logs en tiempo real
render logs follow --service tu-servicio

# Verificar variables de entorno
render env list --service tu-servicio

# Forzar nuevo deploy
render deploy --service tu-servicio
```

## 🔄 Paso 7: Background Worker (Opcional)

Si necesitas un background worker separado:

### 7.1. Crear Segundo Servicio

```yaml
# En .render.yaml
services:
  - type: web
    name: mi-api-worker
    env: node
    plan: free
    buildCommand: "npm install"
    startCommand: "npm run worker"
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        fromService:
          type: redis
          name: mi-api-redis
          property: connectionString
```

### 7.2. Script del Worker

```javascript
// worker.js
const queueService = require('./services/queueService');

// Procesar jobs
queueService.processQueue('background-tasks', 'process-data', async (job) => {
  console.log('Processing:', job.data);
  // Tu lógica aquí
  return { success: true };
});

console.log('🔧 Background worker started');
```

## 📊 Monitoreo

### Métricas en Render:
- CPU y memoria usage
- Response times
- Error rates

### Health Checks Personalizados:
```javascript
// Agregar más checks en /health
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    supabase: await checkSupabase(),
    worker: await checkWorker()
  };
  
  res.json({
    status: Object.values(checks).every(c => c) ? 'OK' : 'ERROR',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

## 🎯 Optimizaciones para Producción

### 1. Configurar CORS correctamente
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://tu-frontend.onrender.com',
  credentials: true
}));
```

### 2. Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // requests por IP
});

app.use('/api/', limiter);
```

### 3. Logging estructurado
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});
```

## 🔐 Seguridad

### Variables de Entorno Críticas:
- `JWT_SECRET`: Debe ser único y complejo
- `SUPABASE_SERVICE_ROLE_KEY`: Solo para operaciones admin
- `DATABASE_URL`: Nunca compartir

### Buenas Prácticas:
- Usar HTTPS en producción (automático en Render)
- Configurar CORS correctamente
- Validar todas las entradas
- Usar Rate Limiting
- Logs sin información sensible

## 📞 Soporte

Si tienes problemas:

1. **Verifica logs en Render Dashboard**
2. **Usa el script de diagnóstico:**
   ```bash
   node scripts/render-setup.js
   ```
3. **Revisa la documentación de Render:** [docs.render.com](https://docs.render.com)

## 🎉 ¡Despliegue Completado!

Una vez que todo esté funcionando:

- ✅ API corriendo en: `https://tu-api.onrender.com`
- ✅ Documentación en: `https://tu-api.onrender.com/api-docs`
- ✅ Health check en: `https://tu-api.onrender.com/health`

¡Tu API con Supabase y Background Workers está lista para producción en Render! 🚀