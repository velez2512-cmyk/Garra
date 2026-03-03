#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/openclaw"
SERVICE_NAME="openclaw"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Verificando Node.js 22+..."
if ! command -v node &>/dev/null || [[ $(node -e "process.exit(parseInt(process.versions.node) >= 22 ? 0 : 1)" 2>/dev/null; echo $?) -ne 0 ]]; then
  echo "==> Instalando Node.js 22 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "    Node.js $(node --version) OK"

echo "==> Instalando OpenClaw..."
npm install -g openclaw@latest

echo "==> Preparando directorio $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

cp "$SCRIPT_DIR/config.yaml" "$INSTALL_DIR/config.yaml"

if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  if [[ -f "$SCRIPT_DIR/.env" ]]; then
    cp "$SCRIPT_DIR/.env" "$INSTALL_DIR/.env"
  else
    echo ""
    echo "  ADVERTENCIA: No se encontró el archivo .env"
    echo "  Creá $INSTALL_DIR/.env con tu ANTHROPIC_API_KEY antes de iniciar el servicio."
    echo "  Ejemplo:"
    echo "    echo 'ANTHROPIC_API_KEY=sk-ant-...' > $INSTALL_DIR/.env"
    echo ""
  fi
fi

echo "==> Instalando dependencias del plugin de Google Sheets..."
mkdir -p "$INSTALL_DIR/extensions"
cp -r "$SCRIPT_DIR/extensions/sheets-plugin" "$INSTALL_DIR/extensions/sheets-plugin"
cd "$INSTALL_DIR/extensions/sheets-plugin"
npm install --omit=dev
cd "$INSTALL_DIR"

echo "==> Registrando plugin en OpenClaw..."
openclaw plugins install -l "$INSTALL_DIR/extensions/sheets-plugin" || true

echo "==> Instalando servicio systemd..."
cp "$SCRIPT_DIR/openclaw.service" /etc/systemd/system/${SERVICE_NAME}.service

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo ""
echo "==> Setup completo."
echo ""
echo "Pasos siguientes:"
echo "  1. Asegurate de tener $INSTALL_DIR/.env con todas las variables (ver .env.example)"
echo "  2. Copiá el JSON del Service Account de Google a la ruta de GOOGLE_CREDENTIALS_FILE"
echo "  3. Iniciá el servicio:  systemctl start $SERVICE_NAME"
echo "  4. Mirá el QR de WhatsApp: journalctl -u $SERVICE_NAME -f"
echo "  5. Escaneá el QR con tu teléfono desde WhatsApp > Dispositivos vinculados"
echo ""
echo "Comandos útiles:"
echo "  systemctl status $SERVICE_NAME      # estado del servicio"
echo "  journalctl -u $SERVICE_NAME -f      # logs en tiempo real"
echo "  systemctl restart $SERVICE_NAME     # reiniciar"
echo "  systemctl stop $SERVICE_NAME        # detener"
