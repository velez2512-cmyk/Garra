import { google, sheets_v4 } from "googleapis";
import * as fs from "fs";

export interface SheetInfo {
  id: number;
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface RowData {
  [column: string]: string;
}

let sheetsClient: sheets_v4.Sheets | null = null;

function getClient(credentialsFile: string): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  if (!fs.existsSync(credentialsFile)) {
    throw new Error(
      `Archivo de credenciales no encontrado: ${credentialsFile}\n` +
        `Asegurate de copiar el JSON del Service Account de Google.`
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export async function listSheets(
  credentialsFile: string,
  spreadsheetId: string
): Promise<SheetInfo[]> {
  const sheets = getClient(credentialsFile);
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  return (res.data.sheets ?? []).map((s) => ({
    id: s.properties?.sheetId ?? 0,
    name: s.properties?.title ?? "",
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    columnCount: s.properties?.gridProperties?.columnCount ?? 0,
  }));
}

export async function readSheet(
  credentialsFile: string,
  spreadsheetId: string,
  sheetName: string,
  range?: string
): Promise<RowData[]> {
  const sheets = getClient(credentialsFile);
  const fullRange = range ? `${sheetName}!${range}` : sheetName;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  const values = res.data.values;
  if (!values || values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1).map((row) => {
    const obj: RowData = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? String(row[i]) : "";
    });
    return obj;
  });
}

export async function appendRow(
  credentialsFile: string,
  spreadsheetId: string,
  sheetName: string,
  values: string[]
): Promise<{ updatedRange: string; updatedRows: number }> {
  const sheets = getClient(credentialsFile);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetName,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return {
    updatedRange: res.data.updates?.updatedRange ?? "",
    updatedRows: res.data.updates?.updatedRows ?? 0,
  };
}

export async function updateCell(
  credentialsFile: string,
  spreadsheetId: string,
  sheetName: string,
  cellRange: string,
  value: string
): Promise<{ updatedRange: string }> {
  const sheets = getClient(credentialsFile);
  const fullRange = `${sheetName}!${cellRange}`;

  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: fullRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });

  return { updatedRange: res.data.updatedRange ?? fullRange };
}
