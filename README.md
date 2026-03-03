# Garra — Bot OpenClaw.ai en VPS

Bot de IA personal corriendo en un VPS via SSH, conectado a **WhatsApp** y usando **Claude (Anthropic)** como modelo.

## Requisitos

- VPS con Ubuntu/Debian y acceso SSH
- Cuenta de WhatsApp activa (número que usarás para el bot)
- API key de Anthropic: [console.anthropic.com](https://console.anthropic.com)

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

Completar con tu API key real:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Ejecutar el setup

```bash
sudo bash setup.sh
```

El script:
- Instala Node.js 22+ si no está presente
- Instala OpenClaw globalmente
- Copia los archivos de configuración a `/opt/openclaw`
- Registra e inicializa el servicio systemd

### 4. Iniciar el servicio y vincular WhatsApp

```bash
sudo systemctl start openclaw
sudo journalctl -u openclaw -f
```

En los logs va a aparecer un **QR de WhatsApp**. Escanealo desde tu teléfono:

> WhatsApp → Dispositivos vinculados → Vincular un dispositivo

Una vez vinculado, el bot queda activo y responde mensajes de WhatsApp usando Claude.

## Comandos útiles

```bash
sudo systemctl status openclaw      # estado del servicio
sudo journalctl -u openclaw -f      # logs en tiempo real
sudo systemctl restart openclaw     # reiniciar
sudo systemctl stop openclaw        # detener
```

## Estructura del proyecto

```
.
├── config.yaml          # Configuración de OpenClaw (canal, modelo)
├── setup.sh             # Script de instalación en el VPS
├── openclaw.service     # Definición del servicio systemd
├── .env.example         # Plantilla de variables de entorno
└── README.md            # Este archivo
```

## Seguridad

- El archivo `.env` **nunca** se sube al repositorio (está en `.gitignore`)
- La API key de Anthropic vive solo en el VPS
- El acceso al bot está restringido por WhatsApp (solo quien tenga el número)
