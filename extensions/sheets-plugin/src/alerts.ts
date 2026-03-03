import cron from "node-cron";
import { readSheet, RowData } from "./sheets-client";

export interface AlertRule {
  sheetName: string;
  column: string;
  condition: string;
  message: string;
}

export interface AlertConfig {
  spreadsheetId: string;
  credentialsFile: string;
  alertPhoneNumber: string;
  alertIntervalMinutes: number;
  alertRules: AlertRule[];
}

type SendMessageFn = (phone: string, text: string) => Promise<void>;

// Tracks alerts already sent in the current cycle to avoid spam.
// Key: `sheetName:rowIndex:column:value`
const sentAlerts = new Set<string>();

function evaluateCondition(value: string, condition: string): boolean {
  // condition examples: "< 10", "=== \"PENDIENTE\"", "> 0"
  // We replace 'value' placeholder if the user wrote it, or just prepend it.
  const expr = condition.trim().startsWith("value")
    ? condition.replace("value", JSON.stringify(value))
    : `${JSON.stringify(value)} ${condition}`;

  try {
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return ${expr}`)());
  } catch {
    return false;
  }
}

function interpolateMessage(template: string, row: RowData, rowIndex: number): string {
  let msg = template.replace("{row}", String(rowIndex + 2)); // +2: header + 0-index
  for (const [key, val] of Object.entries(row)) {
    msg = msg.replace(new RegExp(`\\{${key}\\}`, "g"), val);
  }
  return msg;
}

async function checkRules(
  config: AlertConfig,
  sendMessage: SendMessageFn
): Promise<void> {
  for (const rule of config.alertRules) {
    let rows: RowData[];
    try {
      rows = await readSheet(
        config.credentialsFile,
        config.spreadsheetId,
        rule.sheetName
      );
    } catch (err) {
      console.error(`[sheets-plugin] Error leyendo ${rule.sheetName}:`, err);
      continue;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cellValue = row[rule.column];
      if (cellValue === undefined) continue;

      if (!evaluateCondition(cellValue, rule.condition)) continue;

      const alertKey = `${rule.sheetName}:${i}:${rule.column}:${cellValue}`;
      if (sentAlerts.has(alertKey)) continue;

      sentAlerts.add(alertKey);
      const text = interpolateMessage(rule.message, row, i);

      try {
        await sendMessage(config.alertPhoneNumber, text);
        console.log(`[sheets-plugin] Alerta enviada: ${text}`);
      } catch (err) {
        console.error(`[sheets-plugin] Error enviando alerta:`, err);
        sentAlerts.delete(alertKey); // retry next cycle
      }
    }
  }
}

export function startAlertMonitor(
  config: AlertConfig,
  sendMessage: SendMessageFn
): void {
  if (!config.alertRules || config.alertRules.length === 0) return;
  if (!config.alertPhoneNumber) {
    console.warn("[sheets-plugin] alertPhoneNumber no configurado, alertas desactivadas.");
    return;
  }

  const minutes = config.alertIntervalMinutes ?? 30;
  const cronExpr = `*/${minutes} * * * *`;

  console.log(
    `[sheets-plugin] Monitor de alertas iniciado. Intervalo: ${minutes} min. ` +
      `Reglas: ${config.alertRules.length}`
  );

  // Run once at startup
  checkRules(config, sendMessage).catch(console.error);

  cron.schedule(cronExpr, () => {
    // Reset sent alerts each cycle so conditions that resolved and re-trigger get re-reported
    sentAlerts.clear();
    checkRules(config, sendMessage).catch(console.error);
  });
}
