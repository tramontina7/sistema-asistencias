# Plan de Preparación para Producción
## Sistema de Asistencias · React + Node/Express + SQLite

**Arquitectura de producción:**
```
[LAN] → :80 → Nginx (static front + proxy /api/) → :3000 → PM2 (Node/Express) → SQLite
```

---

## Fase 1 — PM2 + Nginx

### Archivos a crear

**`ecosystem.config.cjs`** (raíz del proyecto):

```js
module.exports = {
  apps: [{
    name: 'asistencias-back',
    script: 'src/server.js',
    cwd: './back',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_PATH: './data/school.db',
    },
    max_memory_restart: '256M',
    instances: 1,  // SQLite es single-writer
    autorestart: true,
    watch: false,
  }]
}
```

**`deploy/nginx.conf`**:

```nginx
server {
    listen 80;
    root /var/www/asistencias;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/css application/javascript application/json;

    location ~* \.(js|css|png|jpg|svg|ico)$ {
        expires 30d;
    }
}
```

**`deploy/install.sh`** (instalación inicial):

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Instalando dependencias del backend ==="
cd back && npm ci --omit=dev
cd ..

echo "=== Instalando dependencias del frontend y buildeando ==="
cd front && npm ci && npm run build
cd ..

echo "=== Copiando build a /var/www/asistencias ==="
sudo rm -rf /var/www/asistencias
sudo cp -r front/dist /var/www/asistencias

echo "=== Configurando Nginx ==="
sudo cp deploy/nginx.conf /etc/nginx/sites-available/asistencias
sudo ln -sf /etc/nginx/sites-available/asistencias /etc/nginx/sites-enabled/asistencias
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "=== Iniciando backend con PM2 ==="
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

echo "=== Listo ==="
echo "Acceso: http://<ip-del-server>:80"
```

**`deploy/update.sh`** (actualizaciones):

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Pull最新 cambios ==="
git pull

echo "=== Actualizando dependencias del backend ==="
cd back && npm ci --omit=dev
cd ..

echo "=== Rebuildeando frontend ==="
cd front && npm ci && npm run build
cd ..

echo "=== Copiando build ==="
sudo rm -rf /var/www/asistencias
sudo cp -r front/dist /var/www/asistencias

echo "=== Reiniciando backend ==="
pm2 restart asistencias-back

echo "=== Listo ==="
```

---

## Fase 2 — Secretos y configuración de producción

### Archivos a crear

**`back/.env.example`**:

```
PORT=3000
JWT_SECRET=<generar con: openssl rand -hex 32>
ENCRYPTION_KEY=<generar con: openssl rand -hex 32>
QR_SECRET=<generar con: openssl rand -hex 32>
DB_PATH=./data/school.db
ALLOWED_ORIGINS=http://localhost:5173
SEED_DEMO=false
SEED_PRECEPTORES=[]
```

**`back/.env.production`** (fuera de git):

```bash
openssl rand -hex 32  # copiar resultado como JWT_SECRET
openssl rand -hex 32  # copiar resultado como ENCRYPTION_KEY
openssl rand -hex 32  # copiar resultado como QR_SECRET
```

Contenido:
```
PORT=3000
JWT_SECRET=<resultado1>
ENCRYPTION_KEY=<resultado2>
QR_SECRET=<resultado3>
DB_PATH=./data/school.db
ALLOWED_ORIGINS=http://<ip-del-server>
SEED_DEMO=false
SEED_PRECEPTORES=[{"username":"admin","password":"Cambiar123!","nombre":"Nombre","apellido":"Apellido","dni":"12345678","telefono":"1234-5678","turno":"Mañana"}]
```

### Archivo a modificar

**`back/.gitignore`** — agregar línea:
```
.env.production
```

---

## Fase 3 — Seed con usuarios reales

**Sin cambios necesarios.** El `back/src/seed.js` ya soporta:
- `SEED_DEMO=false` para no crear datos demo (línea 49)
- `SEED_PRECEPTORES` con JSON de preceptores reales (línea 50)
- Idempotencia por username (línea 36)

---

## Fase 4 — Importación masiva (CSV + pegado)

### Archivos a crear

**`back/src/services/importService.js`** — Lógica de parseo CSV + validación + inserción transaccional.

**`back/src/controllers/importController.js`** — Controlador POST `/api/import/:tipo`.

**`back/src/routes/import.js`** — Rutas de importación.

**`front/src/pages/CargarDatos.jsx`** — Página con tabs: Cursos / Materias / Alumnos. Área de pegado de texto + input de archivo CSV. Botones Validar/Importar.

**`back/__tests__/unit/importService.test.js`** — Tests unitarios del servicio.

**`back/__tests__/integration/importController.test.js`** — Tests de integración del controlador.

### Archivos a modificar

**`back/src/routes/index.js`** — Agregar:
```js
import importRoutes from './import.js'
// ...
router.use('/import', importRoutes)
```

**`front/src/components/layout/Sidebar.jsx`** — Agregar link "Importar Datos" con ícono.

### Formatos CSV soportados

- **cursos**: `anio,division,especialidad,turno`
- **materias**: `anio,division,especialidad,nombre_materia,tipo,horarios`
  - horarios formato: `"Dia HH:MM-HH:MM"` separados por `";"`, comisión opcional `"|comision"`
- **alumnos**: `anio,division,especialidad,comision,apellido,nombre,dni`

---

## Fase 5 — Backup automático

### Archivos a crear

**`back/src/backup.js`**:

```js
import db from './db/index.js'
import { readdirSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'

const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 14
const BACKUP_DIR = join(process.cwd(), 'data', 'backups')

function runBackup() {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
  const filename = `school-${timestamp}.db`
  const dest = join(BACKUP_DIR, filename)

  db.backup(dest)
    .then(() => {
      console.log(`[backup] Creado: ${filename}`)
      purgarAntiguos()
    })
    .catch(err => {
      console.error('[backup] Error:', err.message)
      process.exit(1)
    })
}

function purgarAntiguos() {
  const cutoff = Date.now() - RETENTION_DAYS * 86400000
  try {
    for (const f of readdirSync(BACKUP_DIR)) {
      if (!f.startsWith('school-')) continue
      const path = join(BACKUP_DIR, f)
      if (statSync(path).mtimeMs < cutoff) {
        unlinkSync(path)
        console.log(`[backup] Eliminado: ${f}`)
      }
    }
  } catch {}
}

runBackup()
```

### Archivo a modificar

**`back/src/config/env.js`** — agregar export:
```js
backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 14,
```

### Cron en el servidor

```bash
crontab -e
# Agregar:
0 3 * * * cd /home/USER/asistencias/back && node src/backup.js >> /var/log/backup-asistencias.log 2>&1
```

---

## Fase 6 — Scripts de despliegue y documentación

### Archivos a crear

**`deploy/install.sh`** — Ya definido en Fase 1.

**`deploy/update.sh`** — Ya definido en Fase 1.

**`README.md`** (raíz):

```md
# Sistema de Asistencias - Escuela Técnica

## Requisitos
- Node.js >= 18
- Nginx
- PM2 (`npm install -g pm2`)

## Instalación
1. Clonar el repositorio
2. Configurar `back/.env` (ver `back/.env.example`)
3. Ejecutar `bash deploy/install.sh`

## Deploy
- Instalación inicial: `bash deploy/install.sh`
- Actualizaciones: `bash deploy/update.sh`

## Estructura
- `back/` — Backend (Express + SQLite)
- `front/` — Frontend (React + Vite)
- `deploy/` — Scripts de despliegue
- `ecosystem.config.cjs` — Configuración PM2

## Base de datos
- Ubicación: `back/data/school.db`
- Backups: `back/data/backups/`
- Retención: 14 días (configurable con `BACKUP_RETENTION_DAYS`)

## Desarrollo
- Backend: `cd back && npm run dev`
- Frontend: `cd front && npm run dev`
- Tests: `cd back && npm run test:run`
- Build: `cd front && npm run build`
```

---

## Fase 7 — Limpieza de código

### Archivos a modificar

**`front/src/pages/Login.jsx:49`** — Cambiar:
```jsx
// Antes:
placeholder="preceptor123"
// Después:
placeholder="Contraseña"
```

**`front/src/pages/Reportes.jsx:103`** — Reemplazar:
```jsx
// Antes:
console.error(err)
// Después:
setError('Error al generar el reporte')
```

**`back/src/limpiarDia.js`** — Envolver logs con flag:
```js
// Agregar variable VERBOSE o simplemente quitar console.log
// si el script solo se ejecuta por cron
```

---

## Fase 8 — Testing y verificación

### Comandos

```bash
# Backend
cd back && npm run test:run
cd back && npm run test:coverage

# Frontend
cd front && npm run build
cd front && npm run lint

# PM2
pm2 status
pm2 logs asistencias-back

# Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Smoke test post-deploy

1. Abrir `http://<ip-del-server>:80` en el navegador
2. Login con preceptor real (credenciales de `SEED_PRECEPTORES`)
3. Navegar por las secciones (asistencia, alumnos, cursos, reportes)
4. Verificar que el QR se genera y escanea correctamente
5. Importar un CSV de prueba
6. Verificar backup manual: `cd back && node src/backup.js`

---

## Resumen de archivos

| Fase | Archivos nuevos | Archivos a modificar |
|------|----------------|---------------------|
| 1 (PM2+Nginx) | `ecosystem.config.cjs`, `deploy/nginx.conf`, `deploy/install.sh`, `deploy/update.sh` | — |
| 2 (Secretos) | `back/.env.example`, `back/.env.production` | `back/.gitignore` |
| 3 (Seed) | — | — |
| 4 (Import) | `importService.js`, `importController.js`, `routes/import.js`, `CargarDatos.jsx`, 2 tests | `routes/index.js`, `Sidebar.jsx` |
| 5 (Backup) | `back/src/backup.js` | `back/src/config/env.js` |
| 6 (Docs) | `README.md` | — |
| 7 (Limpieza) | — | `Login.jsx`, `Reportes.jsx`, `limpiarDia.js` |
| **Total** | **14 archivos** | **7 archivos** |
