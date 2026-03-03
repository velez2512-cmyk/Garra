# Garra — Bot OpenClaw.ai en VPS

Bot de IA personal corriendo en un VPS via SSH, conectado a **WhatsApp** y usando **Claude (Anthropic)** como modelo. Incluye integración con **Google Sheets** para consultar, modificar planillas y recibir alertas automáticas.

## Requisitos

- VPS con Ubuntu/Debian y acceso SSH
- Cuenta de WhatsApp activa (número que usarás para el bot)
- API key de Anthropic: [console.anthropic.com](https://console.anthropic.com)
- Proyecto en Google Cloud con Sheets API habilitada (ver sección Google Sheets)

## Deploy

### 1. Clonar el repo en el VPS

```bash
ssh usuario@tu-vps
git clone <url-del-repo> /opt/garra
cd /opt/garra
```

### 2. Crear el archivo `.env`

```bash
cp .env.example .env
nano .env
```

Completar todas las variables (ver `.env.example` para referencia):

```
ANTHROPIC_API_KEY=sk-ant-...
SPREADSHEET_ID=<ID de tu Google Sheet>
GOOGLE_CREDENTIALS_FILE=/opt/openclaw/google-credentials.json
ALERT_PHONE_NUMBER=+5491112345678
```

### 3. Configurar Google Sheets (Service Account)

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto (o usar uno existente)
3. Habilitar la **Google Sheets API**: Buscar "Google Sheets API" → Habilitar
4. Ir a **Credenciales** → Crear credenciales → **Cuenta de servicio**
5. Completar los datos y crear la cuenta
6. Click en la cuenta creada → pestaña **Claves** → Agregar clave → JSON → Descargar
7. Copiar el archivo JSON al VPS:

```bash
scp google-credentials.json usuario@tu-vps:/opt/openclaw/google-credentials.json
```

8. Abrir tu Google Sheet → click en **Compartir** → pegar el `client_email` del JSON (tiene formato `nombre@proyecto.iam.gserviceaccount.com`) → darle acceso de **Editor**

### 4. Configurar alertas automáticas (opcional)

Editar `config.yaml` y descomentar/agregar reglas bajo `alertRules`:

```yaml
alertRules:
  - sheetName: "Stock"
    column: "Cantidad"
    condition: "< 10"
    message: "⚠️ Stock bajo — Fila {row}: {Producto} tiene {Cantidad} unidades"
  - sheetName: "Tareas"
    column: "Estado"
    condition: "=== \"PENDIENTE\""
    message: "📋 Tarea pendiente — {Descripcion}"
```

Variables disponibles en `message`: `{row}` (número de fila) y `{NombreColumna}` para cualquier columna de la hoja.

### 5. Ejecutar el setup

```bash
sudo bash setup.sh
```

El script instala Node.js, OpenClaw, las dependencias del plugin de Sheets y registra el servicio systemd.

### 6. Iniciar el servicio y vincular WhatsApp

```bash
sudo systemctl start openclaw
sudo journalctl -u openclaw -f
```

En los logs aparece un **QR de WhatsApp**. Escanealo desde tu teléfono:

> WhatsApp → Dispositivos vinculados → Vincular un dispositivo

Una vez vinculado, el bot queda activo.

## Uso desde WhatsApp

| Mensaje | Qué hace |
|---|---|
| "mostrá las planillas disponibles" | Lista todas las hojas del spreadsheet |
| "mostrá los datos de Stock" | Devuelve los datos de la hoja Stock |
| "buscá en Ventas donde Producto sea Camisa" | Filtra por columna |
| "agregá en Stock: Producto=Buzo, Cantidad=15" | Agrega una fila nueva |
| "en Stock cambiá la celda B3 a 20" | Modifica una celda específica |

## Comandos útiles

```bash
sudo systemctl status openclaw      # estado del servicio
sudo journalctl -u openclaw -f      # logs en tiempo real
sudo systemctl restart openclaw     # reiniciar (necesario al cambiar config.yaml)
sudo systemctl stop openclaw        # detener
```

## Estructura del proyecto

```
.
├── config.yaml                      # Configuración de OpenClaw + plugin Sheets
├── setup.sh                         # Script de instalación en el VPS
├── openclaw.service                 # Servicio systemd
├── .env.example                     # Plantilla de variables de entorno
├── extensions/
│   └── sheets-plugin/
│       ├── openclaw.plugin.json     # Manifiesto del plugin
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts             # Registro de tools (listar, consultar, agregar, modificar)
│           ├── sheets-client.ts     # Wrapper de Google Sheets API v4
│           └── alerts.ts            # Monitor de alertas con cron
└── README.md
```

## Seguridad

- `.env` y `google-credentials.json` **nunca** se suben al repositorio (están en `.gitignore`)
- Las credenciales viven solo en el VPS
- El acceso al bot está restringido por WhatsApp (solo el número vinculado)
