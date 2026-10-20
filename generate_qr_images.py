"""
UniFleet Safety - Unified QR Code & Sticker Generator
جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
شركة أبو الهول لنقل الركاب
"""

import os
import sys
import urllib.request
import urllib.parse

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "QR_Codes")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Official SUT Production URL
PRODUCTION_BASE_URL = "https://sut-fleet.vercel.app"

def download_qr_code_image(target_url, size=800):
    """Fetch high-resolution QR code PNG"""
    encoded_url = urllib.parse.quote(target_url)
    api_url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={encoded_url}&margin=10&format=png"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read()

def generate_unified_qr():
    print("Generating Unified SUT Fleet QR Code & Sticker...")

    # 1. Download pure high-res unified QR code (points to root /)
    qr_bytes = download_qr_code_image(f"{PRODUCTION_BASE_URL}/", size=800)
    unified_qr_path = os.path.join(OUTPUT_DIR, "الباركود_الموحد_لحافلات_السويدي.png")
    with open(unified_qr_path, "wb") as f:
        f.write(qr_bytes)
    print(f"Unified QR Image saved: {unified_qr_path}")

    # 2. Generate the unified official printable sticker HTML
    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>استيكر السلامة الموحد | جامعة السويدي للتكنولوجيا (SUT)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {{
      --primary: #3b82f6;
      --navy: #0f172a;
      --card-bg: #1e293b;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Cairo', system-ui, sans-serif;
      background: #0b1120;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }}
    .print-actions {{
      margin-bottom: 2rem;
      display: flex;
      gap: 1rem;
    }}
    .btn {{
      padding: 12px 28px;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      border: none;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }}
    .btn-print {{
      background: #3b82f6;
      color: #fff;
    }}
    .btn-print:hover {{
      background: #2563eb;
    }}
    .btn-download {{
      background: #10b981;
      color: #fff;
      text-decoration: none;
    }}
    .btn-download:hover {{
      background: #059669;
    }}
    /* The Official Sticker Sheet */
    .sticker-sheet {{
      width: 100%;
      max-width: 580px;
      background: #ffffff;
      color: #0f172a;
      border-radius: 20px;
      padding: 2.2rem;
      box-shadow: 0 20px 45px rgba(0,0,0,0.5);
      border: 3px solid #1e40af;
      text-align: center;
      position: relative;
    }}
    .sheet-header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 1.25rem;
      margin-bottom: 1.5rem;
    }}
    .logo-img {{
      height: 48px;
      max-width: 170px;
      object-fit: contain;
    }}
    .dept-title {{
      text-align: left;
    }}
    .dept-title h2 {{
      font-size: 1.05rem;
      font-weight: 800;
      color: #1e3a8a;
    }}
    .dept-title p {{
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
    }}
    .cta-banner {{
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      margin-bottom: 1.5rem;
    }}
    .cta-banner h3 {{
      font-size: 1.15rem;
      color: #1d4ed8;
      font-weight: 800;
      margin-bottom: 4px;
    }}
    .cta-banner p {{
      font-size: 0.82rem;
      color: #475569;
    }}
    .qr-container {{
      background: #f8fafc;
      border: 2px dashed #94a3b8;
      border-radius: 16px;
      padding: 1.25rem;
      display: inline-block;
      margin-bottom: 1.25rem;
    }}
    .qr-img {{
      width: 250px;
      height: 250px;
      display: block;
      margin: 0 auto;
    }}
    .scan-hint {{
      font-size: 0.95rem;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0.5rem;
    }}
    .company-badge {{
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 5px 16px;
      font-size: 0.9rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 1rem;
    }}
    .info-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
      text-align: right;
    }}
    .info-card {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.75rem;
      font-size: 0.85rem;
    }}
    .info-card strong {{
      display: block;
      color: #1e3a8a;
      font-size: 0.92rem;
      margin-top: 2px;
    }}
    .room-notice {{
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      font-size: 0.88rem;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 1.25rem;
    }}
    .footer-bar {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 2px solid #e2e8f0;
      padding-top: 1rem;
      font-size: 0.85rem;
      color: #475569;
    }}
    .hotline-highlight {{
      font-weight: 800;
      color: #dc2626;
      font-size: 0.95rem;
    }}
    @media print {{
      body {{ background: #fff; padding: 0; }}
      .print-actions {{ display: none; }}
      .sticker-sheet {{ box-shadow: none; border-width: 2px; width: 100%; max-width: 100%; }}
    }}
  </style>
</head>
<body>

  <div class="print-actions">
    <button class="btn btn-print" onclick="window.print()">🖨️ طباعة الاستيكر الموحد</button>
    <a href="الباركود_الموحد_لحافلات_السويدي.png" download="SUT_Bus_QR.png" class="btn btn-download">⬇️ تحميل صورة الباركود PNG</a>
  </div>

  <div class="sticker-sheet">
    <div class="sheet-header">
      <img src="../assets/sutech-logo.png" alt="SUTech Logo" class="logo-img">
      <div class="dept-title">
        <h2>جامعة السويدي للتكنولوجيا</h2>
        <p>إدارة السلامة والصحة المهنية والنقل الطلابي</p>
      </div>
    </div>

    <div class="cta-banner">
      <h3>لحمايتك.. أبلغ فوراً عن أي تجاوز أو مخالفة بالباص</h3>
      <p>يتابع مسؤولو السلامة بالجامعة بلاغك لحظياً لضمان سلامتك طوال الطريق</p>
    </div>

    <div class="company-badge">
      الشركة المشغلة المعتمدة: <strong>شركة أبو الهول لنقل الركاب</strong>
    </div>

    <div class="qr-container">
      <img src="الباركود_الموحد_لحافلات_السويدي.png" alt="Unified QR Code" class="qr-img">
      <div class="scan-hint">📷 وجّه كاميرا الموبايل للمسح الفوري</div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <span>🔒 خصوصية البلاغ:</span>
        <strong>سري ومحمي لمسؤولي السيفتي</strong>
      </div>
      <div class="info-card">
        <span>🚨 إدارة النقل (اتصال أو واتساب):</span>
        <strong class="hotline-highlight">01040772030</strong>
      </div>
    </div>

    <div class="room-notice">
      🏢 في حالة وجود أي شكوى أو استفسار: مكتب إدارة النقل (غرفة رقم 039 بالدور الأرضي) أو مكتب السيفتي (الدور الأول غرفة رقم 112)
    </div>

    <div class="footer-bar">
      <span>جامعة السويدي للتكنولوجيا - مصر</span>
      <span>Elsewedy University of Technology</span>
    </div>
  </div>

</body>
</html>
"""
    sheet_path = os.path.join(OUTPUT_DIR, "استيكر_السلامة_الموحد_للطباعة.html")
    with open(sheet_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Unified Sticker Sheet created: {sheet_path}")

if __name__ == "__main__":
    generate_unified_qr()
