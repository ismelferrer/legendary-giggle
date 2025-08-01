# Guía de Integración: Supabase y Background Worker

Este documento explica cómo configurar y utilizar las nuevas funcionalidades de Supabase y comunicación con background workers en tu API REST.

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Supabase Integration](#supabase-integration)
3. [Background Worker Integration](#background-worker-integration)
4. [API Endpoints](#api-endpoints)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Monitoreo y Troubleshooting](#monitoreo-y-troubleshooting)

## 🚀 Configuración Inicial

### 1. Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
# Database Configuration
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis Configuration (for background worker communication)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Background Worker Configuration
WORKER_API_URL=http://localhost:4000
WORKER_API_TOKEN=your-worker-api-token

# Server Configuration
PORT=3000
JWT_SECRET=your-jwt-secret
```

### 2. Dependencias Instaladas

Las siguientes dependencias se han agregado automáticamente:

```json
{
  "@supabase/supabase-js": "Client de Supabase",
  "bull": "Sistema de colas para background jobs",
  "redis": "Cliente Redis para comunicación",
  "axios": "Cliente HTTP para comunicación con worker externo"
}
```

### 3. Configuración de Supabase

#### Crear las tablas necesarias en Supabase:

```sql
-- Tabla de usuarios (duplica datos de Sequelize)
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

-- Habilitar Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política básica de acceso
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);
```

### 4. Configuración de Redis

#### Instalación de Redis (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Para Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

## 🗄️ Supabase Integration

### Servicios Disponibles

El servicio de Supabase (`services/supabaseService.js`) proporciona:

#### Operaciones CRUD Genéricas:
- `create(table, data)` - Crear registro
- `findById(table, id)` - Buscar por ID
- `findAll(table, options)` - Buscar todos con filtros
- `update(table, id, data)` - Actualizar registro
- `delete(table, id)` - Eliminar registro

#### Operaciones Específicas de Usuario:
- `createUser(userData)` - Crear usuario
- `getUserById(id)` - Obtener usuario por ID
- `getUserByUsername(username)` - Obtener usuario por username
- `updateUser(id, data)` - Actualizar usuario
- `deleteUser(id)` - Eliminar usuario

#### Autenticación Supabase:
- `signUp(email, password, userData)` - Registro
- `signIn(email, password)` - Inicio de sesión
- `signOut()` - Cerrar sesión
- `getCurrentUser()` - Usuario actual

### Ejemplo de Uso:

```javascript
const supabaseService = require('./services/supabaseService');

// Crear un registro
const result = await supabaseService.create('products', {
  name: 'Producto Test',
  price: 99.99,
  category: 'electronics'
});

// Buscar con filtros
const products = await supabaseService.findAll('products', {
  limit: 10,
  offset: 0,
  orderBy: 'created_at',
  order: 'desc',
  filters: { category: 'electronics' }
});
```

## 🔄 Background Worker Integration

### Servicios de Queue

El servicio de worker (`services/workerService.js`) maneja:

#### Tipos de Trabajos Disponibles:
- `process-data` - Procesamiento de datos
- `send-email` - Envío de emails
- `process-file` - Procesamiento de archivos
- `send-webhook` - Envío de webhooks
- `cleanup-task` - Tareas de limpieza

#### Métodos de Queue:
- `queueDataProcessing(data, options)` - Encolar procesamiento de datos
- `queueEmailSend(emailData, options)` - Encolar envío de email
- `queueFileProcessing(fileData, options)` - Encolar procesamiento de archivo
- `queueWebhookSend(webhookData, options)` - Encolar webhook
- `queueCleanupTask(cleanupData, options)` - Encolar limpieza

#### Métodos Síncronos (directos al worker):
- `processDataSync(data)` - Procesamiento directo
- `sendEmailSync(emailData)` - Envío directo de email
- `getWorkerStatus()` - Estado del worker
- `getWorkerHealth()` - Salud del worker

### Ejemplo de Uso:

```javascript
const workerService = require('./services/workerService');

// Encolar un email
const emailJob = await workerService.queueEmailSend({
  to: 'user@example.com',
  type: 'welcome',
  userData: { name: 'Juan', username: 'juan123' }
});

// Procesamiento directo de datos
const result = await workerService.processDataSync({
  event: 'user_action',
  userId: 123,
  data: { action: 'click', target: 'button' }
});
```

## 🛠️ API Endpoints

### Endpoints de Usuario (actualizados)

```
POST /api/register        - Registro (ahora incluye Supabase + worker)
POST /api/login          - Login (con analytics)
PUT  /api/edit           - Editar usuario (sync con Supabase)
DELETE /api/delete       - Eliminar usuario (con cleanup jobs)
GET  /api/profile        - Perfil completo (Sequelize + Supabase)
POST /api/sync           - Sincronizar datos con Supabase
```

### Endpoints de Worker

```
POST /api/worker/jobs                    - Encolar trabajo
POST /api/worker/jobs/batch              - Encolar múltiples trabajos
GET  /api/worker/jobs/:jobId/status      - Estado del trabajo
GET  /api/worker/queue/stats             - Estadísticas de la cola
POST /api/worker/queue/pause             - Pausar cola
POST /api/worker/queue/resume            - Reanudar cola
POST /api/worker/queue/clean             - Limpiar cola
GET  /api/worker/status                  - Estado del worker externo
GET  /api/worker/health                  - Salud del worker externo
POST /api/worker/schedule                - Programar trabajo recurrente
POST /api/worker/delay                   - Programar trabajo con retraso
```

### Endpoints de Supabase

```
GET    /api/supabase/tables/:table/records     - Obtener registros
POST   /api/supabase/tables/:table/records     - Crear registro
GET    /api/supabase/tables/:table/records/:id - Obtener por ID
PUT    /api/supabase/tables/:table/records/:id - Actualizar registro
DELETE /api/supabase/tables/:table/records/:id - Eliminar registro

POST /api/supabase/auth/signup    - Registro con Supabase Auth
POST /api/supabase/auth/signin    - Login con Supabase Auth
POST /api/supabase/auth/signout   - Logout
GET  /api/supabase/auth/user      - Usuario actual
```

## 💡 Ejemplos de Uso

### 1. Registro de Usuario con Analytics

```javascript
// POST /api/register
{
  "username": "juan123",
  "password": "securepassword",
  "nombre": "Juan Pérez",
  "email": "juan@example.com"
}

// Respuesta:
{
  "message": "Usuario registrado exitosamente",
  "user": {
    "id": 1,
    "username": "juan123",
    "nombre": "Juan Pérez"
  },
  "supabase": true
}

// Automáticamente se encolan:
// - Email de bienvenida
// - Analytics de registro
```

### 2. Encolar Trabajo de Procesamiento

```javascript
// POST /api/worker/jobs
{
  "type": "process-data",
  "data": {
    "event": "purchase",
    "userId": 123,
    "productId": 456,
    "amount": 99.99
  },
  "options": {
    "priority": 5,
    "delay": 0
  }
}

// Respuesta:
{
  "success": true,
  "jobId": "job_123456",
  "data": { ... }
}
```

### 3. Crear Registro en Supabase

```javascript
// POST /api/supabase/tables/products/records
{
  "name": "Laptop Gaming",
  "price": 1299.99,
  "category": "electronics",
  "stock": 10
}

// Respuesta:
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Laptop Gaming",
    "price": 1299.99,
    "category": "electronics",
    "stock": 10,
    "created_by": 1,
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

### 4. Programar Trabajo Recurrente

```javascript
// POST /api/worker/schedule
{
  "jobType": "cleanup-task",
  "data": {
    "type": "old_logs_cleanup",
    "retentionDays": 30
  },
  "cronPattern": "0 2 * * *",  // Diario a las 2 AM
  "options": {
    "priority": 1
  }
}
```

## 📊 Monitoreo y Troubleshooting

### Health Check Endpoint

```
GET /health
```

Respuesta:
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
  "environment": "development"
}
```

### Verificar Estado de la Cola

```
GET /api/worker/queue/stats
```

Respuesta:
```json
{
  "success": true,
  "stats": {
    "waiting": 5,
    "active": 2,
    "completed": 150,
    "failed": 3,
    "delayed": 1
  }
}
```

### Logs Importantes

El sistema genera logs estructurados para:

- ✅ Conexiones exitosas a servicios
- ⚠️ Advertencias de configuración
- ❌ Errores de procesamiento
- 📊 Estadísticas de trabajos

### Errores Comunes

1. **Redis no conectado**:
   ```
   Error: Redis connection failed
   ```
   Solución: Verificar que Redis esté corriendo y las credenciales sean correctas.

2. **Supabase no configurado**:
   ```
   Error: Missing Supabase environment variables
   ```
   Solución: Agregar `SUPABASE_URL` y `SUPABASE_ANON_KEY` al archivo `.env`.

3. **Worker no disponible**:
   ```
   Error: Worker API not responding
   ```
   Solución: Verificar que el background worker esté corriendo en la URL configurada.

## 🔧 Configuración del Background Worker Externo

Tu background worker debe implementar los siguientes endpoints:

```
POST /api/process-data    - Procesar datos
POST /api/send-email      - Enviar emails
POST /api/process-file    - Procesar archivos
POST /api/send-webhook    - Enviar webhooks
POST /api/cleanup         - Tareas de limpieza
GET  /api/status          - Estado del worker
GET  /api/health          - Verificación de salud
GET  /api/stats           - Estadísticas del worker
```

### Ejemplo de estructura del worker:

```javascript
// En tu repositorio del background worker
app.post('/api/process-data', async (req, res) => {
  try {
    const { event, userId, data } = req.body;
    
    // Procesar los datos según el tipo de evento
    const result = await processAnalyticsEvent(event, userId, data);
    
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 🎯 Próximos Pasos

1. Configurar las variables de entorno según tu infraestructura
2. Crear las tablas necesarias en Supabase
3. Implementar los endpoints requeridos en tu background worker
4. Probar la integración usando los endpoints documentados
5. Configurar monitoreo y alertas según tus necesidades

Para más información o soporte, consulta la documentación de cada servicio o contacta al equipo de desarrollo.