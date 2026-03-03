import {
  listSheets,
  readSheet,
  appendRow,
  updateCell,
  RowData,
} from "./sheets-client";
import { startAlertMonitor, AlertRule } from "./alerts";

interface PluginConfig {
  spreadsheetId: string;
  credentialsFile: string;
  alertPhoneNumber?: string;
  alertIntervalMinutes?: number;
  alertRules?: AlertRule[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const register = (api: any) => {
  const cfg: PluginConfig = api.config;

  const { spreadsheetId, credentialsFile } = cfg;

  // ── Tool: listar_planillas ──────────────────────────────────────────────────
  api.registerTool("listar_planillas", {
    description:
      "Lista todas las hojas (tabs) disponibles en el Google Spreadsheet configurado.",
    input: {
      type: "object",
      properties: {},
    },
    execute: async () => {
      const sheets = await listSheets(credentialsFile, spreadsheetId);
      if (sheets.length === 0) return { planillas: [] };
      return {
        planillas: sheets.map((s) => ({
          nombre: s.name,
          filas: s.rowCount,
          columnas: s.columnCount,
        })),
      };
    },
  });

  // ── Tool: consultar_datos ───────────────────────────────────────────────────
  api.registerTool("consultar_datos", {
    description:
      "Lee datos de una hoja del spreadsheet. Puede filtrar por columna/valor y limitar cantidad de filas.",
    input: {
      type: "object",
      required: ["sheetName"],
      properties: {
        sheetName: {
          type: "string",
          description: "Nombre exacto de la hoja (tab) a consultar",
        },
        filterColumn: {
          type: "string",
          description: "Nombre de la columna por la que filtrar (opcional)",
        },
        filterValue: {
          type: "string",
          description:
            "Valor a buscar en filterColumn. Coincidencia parcial, sin mayúsculas (opcional)",
        },
        limit: {
          type: "number",
          description: "Máximo de filas a devolver (opcional, default: 50)",
        },
      },
    },
    execute: async (input: {
      sheetName: string;
      filterColumn?: string;
      filterValue?: string;
      limit?: number;
    }) => {
      let rows: RowData[] = await readSheet(
        credentialsFile,
        spreadsheetId,
        input.sheetName
      );

      if (input.filterColumn && input.filterValue) {
        const needle = input.filterValue.toLowerCase();
        rows = rows.filter((r) =>
          (r[input.filterColumn!] ?? "").toLowerCase().includes(needle)
        );
      }

      const limit = input.limit ?? 50;
      const truncated = rows.length > limit;
      rows = rows.slice(0, limit);

      return {
        hoja: input.sheetName,
        total: rows.length,
        truncado: truncated,
        datos: rows,
      };
    },
  });

  // ── Tool: agregar_fila ──────────────────────────────────────────────────────
  api.registerTool("agregar_fila", {
    description:
      "Agrega una fila nueva al final de una hoja del spreadsheet. Los valores deben pasarse como un objeto { columna: valor }.",
    input: {
      type: "object",
      required: ["sheetName", "values"],
      properties: {
        sheetName: {
          type: "string",
          description: "Nombre de la hoja donde agregar la fila",
        },
        values: {
          type: "object",
          description:
            "Objeto con los valores a agregar. Las claves deben ser los nombres de las columnas (headers).",
          additionalProperties: { type: "string" },
        },
      },
    },
    execute: async (input: {
      sheetName: string;
      values: Record<string, string>;
    }) => {
      // Read headers to know column order
      const existing = await readSheet(
        credentialsFile,
        spreadsheetId,
        input.sheetName
      );
      if (existing.length === 0) {
        // Sheet is empty — append values in provided order
        const row = Object.values(input.values);
        const result = await appendRow(
          credentialsFile,
          spreadsheetId,
          input.sheetName,
          row
        );
        return { ok: true, rango: result.updatedRange };
      }

      const headers = Object.keys(existing[0]);
      const row = headers.map((h) => input.values[h] ?? "");

      const result = await appendRow(
        credentialsFile,
        spreadsheetId,
        input.sheetName,
        row
      );
      return { ok: true, rango: result.updatedRange };
    },
  });

  // ── Tool: modificar_celda ───────────────────────────────────────────────────
  api.registerTool("modificar_celda", {
    description:
      "Modifica el valor de una celda o rango específico en una hoja. cellRange usa notación A1, ej: 'B3' o 'C5:D6'.",
    input: {
      type: "object",
      required: ["sheetName", "cellRange", "value"],
      properties: {
        sheetName: {
          type: "string",
          description: "Nombre de la hoja",
        },
        cellRange: {
          type: "string",
          description: "Celda o rango en notación A1, ej: 'B3', 'C5'",
        },
        value: {
          type: "string",
          description: "Nuevo valor para la celda",
        },
      },
    },
    execute: async (input: {
      sheetName: string;
      cellRange: string;
      value: string;
    }) => {
      const result = await updateCell(
        credentialsFile,
        spreadsheetId,
        input.sheetName,
        input.cellRange,
        input.value
      );
      return { ok: true, rango: result.updatedRange };
    },
  });

  // ── Alert monitor ───────────────────────────────────────────────────────────
  startAlertMonitor(
    {
      spreadsheetId,
      credentialsFile,
      alertPhoneNumber: cfg.alertPhoneNumber ?? "",
      alertIntervalMinutes: cfg.alertIntervalMinutes ?? 30,
      alertRules: cfg.alertRules ?? [],
    },
    async (phone: string, text: string) => {
      // api.sendMessage sends a WhatsApp message through the configured channel
      await api.sendMessage(phone, text);
    }
  );

  api.log("[sheets-plugin] Plugin cargado correctamente.");
};

export default register;
