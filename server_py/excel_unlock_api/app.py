from __future__ import annotations

import io
import os
from flask import Flask, request, send_file
from openpyxl import load_workbook
from openpyxl.styles import Protection
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Allow larger uploads (adjust as needed)
app.config["MAX_CONTENT_LENGTH"] = 150 * 1024 * 1024  # 150MB


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/unlock")
def unlock_excel():
    if "file" not in request.files:
        return "Chyba: Žádný soubor nebyl nahrán", 400

    uploaded = request.files["file"]
    if not uploaded or uploaded.filename is None or uploaded.filename == "":
        return "Chyba: Prázdné jméno souboru", 400

    filename = secure_filename(uploaded.filename)
    _, ext = os.path.splitext(filename.lower())
    if ext not in (".xlsx", ".xlsm"):
        return "Chyba: Podporované jsou pouze soubory .xlsx a .xlsm", 400

    try:
        data = uploaded.read()
        if not data:
            return "Chyba: Soubor je prázdný", 400

        # keep_vba preserves macros for .xlsm; for .xlsx it is harmless but unnecessary.
        keep_vba = ext == ".xlsm"
        wb = load_workbook(io.BytesIO(data), keep_vba=keep_vba)

        for sheet in wb.worksheets:
            # Disable sheet protection
            sheet.protection.enabled = False

            # Optionally unlock cell styles. This is the behavior you validated in Python/openpyxl.
            # It can take longer on huge sheets, but preserves file size and formatting reliably.
            for row in sheet.iter_rows():
                for cell in row:
                    cell.protection = Protection(locked=False, hidden=False)

        out = io.BytesIO()
        wb.save(out)
        out.seek(0)

        base = os.path.splitext(filename)[0]
        download_name = f"{base}-odemceno.xlsm"

        return send_file(
            out,
            mimetype="application/vnd.ms-excel.sheet.macroEnabled.12",
            as_attachment=True,
            download_name=download_name,
            max_age=0,
        )

    except Exception as e:
        return f"Chyba při zpracování: {str(e)}", 500


if __name__ == "__main__":
    port = int(os.environ.get("EXCEL_UNLOCK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port)

