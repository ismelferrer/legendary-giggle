# WhatsApp Bot Background Worker

Un worker de fondo completo que integra un bot de WhatsApp usando `whatsapp-web.js` con un webservice REST. El worker procesa mensajes de WhatsApp, maneja colas de trabajos en segundo plano y se comunica con el webservice principal.

## 🚀 Características

- **Bot de WhatsApp completo** con `whatsapp-web.js`
- **Procesamiento de colas** con Redis y Bull
- **API REST** para comunicación con el webservice
- **Manejo de diferentes tipos de mensajes** (texto, imagen, video, audio, documentos, etc.)
- **Comandos de bot** personalizables
- **Auto-respuestas** configurables
- **Logging completo** con Winston
- **Monitoreo de salud** y métricas
- **Reconexión automática** de WhatsApp
- **Manejo graceful de shutdown**

## 📋 Prerrequisitos

- Node.js >= 18.0.0
- Redis Server
- Webservice API ejecutándose (puerto 3000 por defecto)

## 🛠️ Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` con tus configuraciones:
   ```env
   # Configuración del Worker
   NODE_ENV=development
   PORT=4000
   
   # API del Webservice
   WEBSERVICE_API_URL=http://localhost:3000
   WEBSERVICE_API_TOKEN=tu-token-api
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # WhatsApp
   WHATSAPP_SESSION_NAME=whatsapp-session
   BOT_PREFIX=!
   BOT_AUTO_REPLY_ENABLED=true
   ```

3. **Asegurar que Redis esté ejecutándose:**
   ```bash
   # Ubuntu/Debian
   sudo systemctl start redis-server
   
   # macOS con Homebrew
   brew services start redis
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

## 🏃 Ejecución

### Desarrollo Local
```bash
npm run dev
```

### Producción Local
```bash
npm start
```

### Con PM2 (para servidores VPS)
```bash
npm install -g pm2
pm2 start index.js --name whatsapp-worker
pm2 startup
pm2 save
```

### 🌐 Deployment en Render (Recomendado)
```bash
# 1. Preparar para deployment
./scripts/deploy-render.sh

# 2. Seguir la guía completa
ver RENDER_DEPLOYMENT.md
```

**¿Por qué Render?**
- ✅ Deployment automático desde Git
- ✅ Escalado automático
- ✅ Health checks integrados
- ✅ Redis add-on incluido
- ✅ SSL/HTTPS automático
- ✅ Free tier disponible

## 📱 Configuración de WhatsApp

1. **Ejecutar el worker** - aparecerá un código QR en la terminal
2. **Escanear el QR** con WhatsApp en tu teléfono
3. **Confirmar la conexión** - el bot estará listo

El código QR también está disponible en formato data URL a través de la API en `/api/whatsapp/info`.

## 🔧 API Endpoints

### Estado y Salud
- `GET /health` - Estado general del worker
- `GET /api/status` - Estado detallado de servicios
- `GET /api/stats` - Estadísticas y métricas

### WhatsApp
- `GET /api/whatsapp/info` - Información del cliente WhatsApp
- `POST /api/whatsapp/send` - Enviar mensaje de texto
- `POST /api/whatsapp/send-media` - Enviar archivo multimedia

### Gestión de Colas
- `GET /api/queue/stats` - Estadísticas de la cola
- `POST /api/queue/pause` - Pausar procesamiento
- `POST /api/queue/resume` - Reanudar procesamiento
- `POST /api/queue/clean` - Limpiar trabajos completados

### Trabajos
- `POST /api/jobs` - Agregar trabajo a la cola
- `GET /api/jobs/:jobId/status` - Estado de trabajo específico

### Webhooks
- `POST /webhook/whatsapp` - Webhook para el webservice

## 🤖 Comandos del Bot

El bot responde a comandos que comienzan con el prefijo configurado (por defecto `!`):

- `!help` - Muestra comandos disponibles
- `!status` - Estado del bot y estadísticas
- `!ping` - Prueba de conectividad
- `!info` - Información del mensaje actual

## 📊 Tipos de Mensajes Soportados

El worker procesa diferentes tipos de mensajes de WhatsApp:

- **Texto** - Mensajes de texto plano
- **Imagen** - Fotos con o sin caption
- **Video** - Videos con o sin caption
- **Audio** - Archivos de audio
- **Voz** - Notas de voz
- **Documento** - Archivos PDF, Word, etc.
- **Sticker** - Stickers/pegatinas
- **Ubicación** - Coordenadas GPS
- **Contacto** - Tarjetas de contacto
- **Encuesta** - Encuestas de WhatsApp
- **Invitación de grupo** - Enlaces de grupo

## 🔄 Integración con Webservice

El worker se comunica con el webservice principal a través de:

### Registro del Worker
```javascript
// El worker se registra automáticamente
{
  "type": "whatsapp-bot",
  "status": "active",
  "capabilities": [
    "whatsapp-messaging",
    "media-processing", 
    "queue-processing",
    "webhook-handling"
  ]
}
```

### Envío de Eventos
```javascript
// Eventos de WhatsApp enviados al webservice
await webserviceClient.logWhatsAppEvent('message_received', {
  messageId: '...',
  from: '+1234567890',
  type: 'text',
  timestamp: '2024-01-01T00:00:00.000Z'
});
```

### Procesamiento de Trabajos
```javascript
// Trabajos enviados al webservice para procesamiento
await webserviceClient.queueJob('process-whatsapp-message', {
  messageId: '...',
  from: '+1234567890',
  body: 'Mensaje de texto',
  type: 'text'
});
```

## 📁 Estructura del Proyecto

```
whatsapp-worker/
├── src/
│   ├── config/
│   │   └── index.js          # Configuración principal
│   ├── services/
│   │   ├── whatsappBot.js     # Cliente WhatsApp
│   │   ├── queueService.js    # Gestión de colas Redis
│   │   ├── webserviceClient.js # Cliente HTTP para webservice
│   │   └── apiServer.js       # Servidor Express
│   ├── handlers/
│   │   └── messageHandler.js  # Manejadores de mensajes
│   └── utils/
│       └── logger.js          # Sistema de logging
├── logs/                      # Archivos de log
├── .wwebjs_auth/             # Datos de sesión WhatsApp
├── index.js                  # Punto de entrada principal
├── package.json
├── .env.example
└── README.md
```

## 🔍 Logging y Monitoreo

### Niveles de Log
- `error` - Errores críticos
- `warn` - Advertencias
- `info` - Información general
- `http` - Requests HTTP
- `debug` - Información de debugging

### Logs Especializados
```javascript
logger.whatsapp('Mensaje recibido', { from: '+1234567890' });
logger.queue('Trabajo procesado', { jobId: 123 });
logger.webservice('API call completada', { endpoint: '/api/test' });
logger.bot('Comando ejecutado', { command: 'help' });
```

### Archivos de Log
- `logs/worker.log` - Log principal
- `logs/worker.error.log` - Solo errores

## 🛡️ Seguridad

- **Rate limiting** en endpoints API
- **CORS** configurado para origins permitidos
- **Helmet** para headers de seguridad
- **Validación de entrada** en todos los endpoints
- **Tokens de autenticación** para webservice

## 🔧 Troubleshooting

### WhatsApp no se conecta
```bash
# Limpiar sesión y reiniciar
rm -rf .wwebjs_auth/
npm start
```

### Redis no conecta
```bash
# Verificar que Redis esté ejecutándose
redis-cli ping
# Debe responder: PONG
```

### Problemas de memoria
```bash
# Monitorear uso de memoria
pm2 monit
# O revisar logs
tail -f logs/worker.log | grep "Memory usage"
```

### Worker no se registra con webservice
1. Verificar que el webservice esté ejecutándose
2. Confirmar URL y token en `.env`
3. Revisar logs de conectividad

## 📈 Métricas y Estadísticas

El worker proporciona métricas detalladas:

```javascript
// GET /api/stats
{
  "success": true,
  "stats": {
    "uptime": 3600,
    "memory": {
      "rss": 150,
      "heapTotal": 100, 
      "heapUsed": 80
    },
    "whatsapp": {
      "isReady": true,
      "isConnected": true,
      "number": "1234567890"
    },
    "handlers": {
      "totalHandlers": 14,
      "supportedTypes": ["chat", "image", "video", ...]
    }
  }
}
```

## 🚀 Escalabilidad

### Múltiples Workers
Puedes ejecutar múltiples instancias del worker en diferentes puertos:

```bash
# Worker 1
PORT=4000 npm start

# Worker 2  
PORT=4001 npm start
```

### Load Balancing
Usa nginx o un load balancer para distribuir requests:

```nginx
upstream whatsapp_workers {
    server localhost:4000;
    server localhost:4001;
}
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear branch para feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit cambios (`git commit -am 'Agregar nueva característica'`)
4. Push al branch (`git push origin feature/nueva-caracteristica`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs en `logs/worker.log`
2. Verificar estado en `/health`
3. Consultar documentación del webservice
4. Crear issue en el repositorio