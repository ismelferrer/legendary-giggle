# 🚀 Deployment en Render - Guía Completa

Esta guía te ayudará a desplegar el WhatsApp Bot Worker en Render de forma exitosa.

## 📋 Prerrequisitos

1. **Cuenta de Render**: [render.com](https://render.com)
2. **Cuenta de Supabase**: [supabase.com](https://supabase.com)
3. **Repositorio Git**: El código debe estar en GitHub, GitLab o Bitbucket
4. **Webservice principal**: Ya desplegado y funcionando

## 🛠️ Paso 1: Configurar Supabase

### 1.1 Crear proyecto en Supabase
```bash
1. Ve a https://supabase.com
2. Crea un nuevo proyecto
3. Anota la URL del proyecto y las API keys
```

### 1.2 Crear tabla de sesiones
```sql
-- Ejecuta este script en el SQL Editor de Supabase
-- (Archivo: scripts/create_supabase_table.sql)

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(255) UNIQUE NOT NULL,
    session_data JSONB NOT NULL,
    authenticated BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_name 
ON public.whatsapp_sessions(session_name);

-- Habilitar RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Política para service role
CREATE POLICY "Service role can manage all sessions" 
ON public.whatsapp_sessions 
FOR ALL 
TO service_role 
USING (true);
```

### 1.3 Obtener credenciales
```bash
# En Supabase Dashboard > Settings > API
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=eyJ... (anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role key)
```

## 🚀 Paso 2: Preparar el Código

### 2.1 Ejecutar script de preparación
```bash
cd whatsapp-worker
./scripts/deploy-render.sh
```

### 2.2 Subir a Git
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

## 🌐 Paso 3: Crear Servicio en Render

### 3.1 Crear nuevo Web Service
```bash
1. Ve a https://render.com/dashboard
2. Click "New +" > "Web Service"
3. Conecta tu repositorio Git
4. Selecciona la rama (main/master)
```

### 3.2 Configuración del servicio
```yaml
# Render detectará automáticamente estas configuraciones:
Build Command: npm install
Start Command: npm start
Environment: Node
```

### 3.3 Configurar variables de entorno
**Variables REQUERIDAS:**
```bash
NODE_ENV=production
USE_SUPABASE_AUTH=true
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
WEBSERVICE_API_URL=https://tu-webservice.onrender.com
```

**Variables OPCIONALES:**
```bash
WHATSAPP_SESSION_NAME=render-bot-session
BOT_PREFIX=!
BOT_AUTO_REPLY_ENABLED=true
LOG_LEVEL=info
WORKER_CONCURRENCY=3
WORKER_MAX_RETRIES=3
```

## 🔴 Paso 4: Agregar Redis

### 4.1 Agregar Redis Add-on
```bash
1. En tu servicio > "Environment" > "Add-ons"
2. Click "Add" en Redis
3. Selecciona el plan (Free tier disponible)
4. Render configurará automáticamente REDIS_URL
```

## ⚙️ Paso 5: Deployment

### 5.1 Deploy automático
```bash
# Render desplegará automáticamente cuando:
1. Pushees código a la rama conectada
2. Cambies variables de entorno
3. Hagas deploy manual desde el dashboard
```

### 5.2 Verificar deployment
```bash
# Endpoints para verificar:
https://tu-app.onrender.com/health
https://tu-app.onrender.com/api/status
https://tu-app.onrender.com/api/whatsapp/info
```

## 📱 Paso 6: Configurar WhatsApp

### 6.1 Obtener código QR
```bash
# Accede a:
https://tu-app.onrender.com/api/whatsapp/info

# El response incluirá:
{
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "isReady": false,
  "authType": "supabase"
}
```

### 6.2 Escanear QR con WhatsApp
```bash
1. Abre WhatsApp en tu teléfono
2. Ve a "Dispositivos vinculados"
3. Escanea el código QR
4. Confirma la vinculación
```

### 6.3 Verificar autenticación
```bash
# Después de escanear, verifica:
https://tu-app.onrender.com/api/whatsapp/info

# Debería mostrar:
{
  "isReady": true,
  "isConnected": true,
  "number": "1234567890",
  "authType": "supabase"
}
```

## 🔧 Configuración Avanzada

### Health Checks
```bash
# Render verificará automáticamente /health cada 30 segundos
# Si falla 3 veces consecutivas, reiniciará el servicio
```

### Logs
```bash
# Ver logs en tiempo real:
1. Dashboard > Tu servicio > "Logs"
2. O usa Render CLI: render logs -f tu-servicio
```

### Escalado
```bash
# Para mayor tráfico, upgradeaa:
- Plan Starter ($7/mes): 512MB RAM
- Plan Standard ($25/mes): 2GB RAM
```

## 🐛 Troubleshooting

### Error: "Puppeteer failed to launch"
```bash
# Solución: Verifica que USE_SUPABASE_AUTH=true
# El Dockerfile incluye Chromium optimizado para Render
```

### Error: "Supabase connection failed"
```bash
# Verifica:
1. SUPABASE_URL correcto
2. SUPABASE_SERVICE_ROLE_KEY correcto
3. Tabla whatsapp_sessions creada
4. RLS configurado correctamente
```

### Error: "Redis connection failed"
```bash
# Solución:
1. Asegúrate de tener Redis add-on activado
2. REDIS_URL se configura automáticamente
3. Reinicia el servicio si es necesario
```

### WhatsApp no se conecta
```bash
# Soluciones:
1. Regenera QR: DELETE /api/whatsapp/session
2. Verifica logs del navegador Puppeteer
3. Asegúrate de que el teléfono tenga internet
```

## 📊 Monitoreo

### Endpoints útiles
```bash
# Estado general
GET /health

# Info de WhatsApp
GET /api/whatsapp/info

# Estadísticas
GET /api/stats

# Estado de colas
GET /api/queue/stats

# Sesiones (Supabase)
GET /api/whatsapp/sessions
```

### Métricas importantes
```bash
- Uptime del servicio
- Memoria utilizada
- Estado de WhatsApp (connected/disconnected)
- Trabajos en cola
- Errores de autenticación
```

## 💰 Costos Estimados

### Render (por mes)
```bash
- Free Tier: $0 (con limitaciones)
- Starter: $7 (recomendado)
- Redis Add-on: $7 (plan básico)
```

### Supabase (por mes)
```bash
- Free Tier: $0 (hasta 500MB, 2 million edge requests)
- Pro: $25 (si necesitas más recursos)
```

### Total estimado: $14-32/mes

## 🎉 ¡Listo!

Una vez completados todos los pasos:

1. ✅ Servicio desplegado en Render
2. ✅ WhatsApp conectado y funcionando
3. ✅ Sesiones guardadas en Supabase
4. ✅ Integración con webservice principal
5. ✅ Bot respondiendo a mensajes

**URLs importantes:**
- Worker: https://tu-whatsapp-worker.onrender.com
- Health: https://tu-whatsapp-worker.onrender.com/health
- QR Code: https://tu-whatsapp-worker.onrender.com/api/whatsapp/info