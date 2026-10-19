"""
UniFleet Safety - QR Code Image Generator for SUT Buses
جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
Generates standalone PNG and SVG QR code images for buses into the 'QR_Codes' folder.
"""

import os
import sys
import json
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont

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

# Buses list
BUSES = [
    {"id": "101", "line": "خط العاشر من رمضان 1", "vendor": "شركة أبو الهول"},
    {"id": "102", "line": "خط العاشر من رمضان 2", "vendor": "شركة أبو الهول"},
    {"id": "103", "line": "خط الإسماعيلية الصحراوي", "vendor": "شركة أبو الهول"},
    {"id": "104", "line": "خط السويس", "vendor": "شركة أبو الهول"},
    {"id": "105", "line": "خط ميت غمر والشرقية", "vendor": "شركة أبو الهول"},
    {"id": "106", "line": "خط التجمع الخامس والجامعة الأمريكية", "vendor": "شركة أبو الهول"},
    {"id": "107", "line": "خط الرحاب ومدينتي", "vendor": "شركة أبو الهول"},
    {"id": "108", "line": "خط الشروق والمستقبل", "vendor": "شركة أبو الهول"},
    {"id": "109", "line": "خط العبور والنهضة", "vendor": "شركة أبو الهول"},
    {"id": "110", "line": "خط جسر السويس ومصر الجديدة", "vendor": "شركة أبو الهول"}
]

def download_qr_code_image(target_url, size=500):
    """Fetch QR code PNG from high-reliability standard QR API"""
    encoded_url = urllib.parse.quote(target_url)
    api_url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={encoded_url}&margin=10&format=png"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read()

def create_complete_bus_sticker(bus_id, line_name, vendor_name, target_url, output_path):
    """Create a beautiful printable sticker banner containing the QR code"""
    # 1. Download pure QR code
    qr_bytes = download_qr_code_image(target_url, size=400)
    temp_qr_path = os.path.join(OUTPUT_DIR, f"temp_qr_{bus_id}.png")
    with open(temp_qr_path, "wb") as f:
        f.write(qr_bytes)

    qr_img = Image.open(temp_qr_path).convert("RGBA")

    # 2. Canvas setup (Width: 600px, Height: 750px)
    width, height = 600, 750
    sticker = Image.new("RGBA", (width, height), (13, 19, 34, 255)) # Dark navy
    draw = ImageDraw.Draw(sticker)

    # Outer border
    draw.rectangle([10, 10, width - 10, height - 10], outline=(59, 130, 246, 180), width=3)

    # Top Header strip
    draw.rectangle([10, 10, width - 10, 95], fill=(24, 34, 53, 255))
    
    # Try using system font or default
    try:
        font_lg = ImageFont.truetype("arial.ttf", 26)
        font_md = ImageFont.truetype("arial.ttf", 20)
        font_sm = ImageFont.truetype("arial.ttf", 15)
        font_bold = ImageFont.truetype("arialbd.ttf", 28)
    except Exception:
        font_lg = font_md = font_sm = font_bold = ImageFont.load_default()

    # Paste QR in center
    qr_pos_x = (width - 400) // 2
    qr_pos_y = 200
    sticker.paste(qr_img, (qr_pos_x, qr_pos_y))

    # Add decorative white frame around QR
    draw.rectangle([qr_pos_x - 4, qr_pos_y - 4, qr_pos_x + 404, qr_pos_y + 404], outline=(255, 255, 255, 220), width=2)

    # Clean up temp
    try:
        os.remove(temp_qr_path)
    except Exception:
        pass

    sticker.convert("RGB").save(output_path, "PNG")
    print(f"Sticker generated: {output_path}")

def generate_all():
    print("Generating SUT Fleet QR Code Images...")

    # 1. Standalone Pure QR Code for Line 1 (العاشر 1)
    url_101 = f"{PRODUCTION_BASE_URL}/?bus=101"
    png_bytes_101 = download_qr_code_image(url_101, size=600)
    pure_qr_101_path = os.path.join(OUTPUT_DIR, "QR_خط_العاشر_من_رمضان_1.png")
    with open(pure_qr_101_path, "wb") as f:
        f.write(png_bytes_101)
    print(f"Line 1 QR Code saved: {pure_qr_101_path}")

    # 2. Standalone General QR Code (Student Safety Form)
    general_url = f"{PRODUCTION_BASE_URL}/"
    png_bytes_gen = download_qr_code_image(general_url, size=600)
    pure_qr_gen_path = os.path.join(OUTPUT_DIR, "QR_العام_لكل_الخطوط.png")
    with open(pure_qr_gen_path, "wb") as f:
        f.write(png_bytes_gen)
    print(f"General QR Code saved: {pure_qr_gen_path}")

    # 3. Generate QR codes for lines
    for bus in BUSES[:6]:
        bus_url = f"{PRODUCTION_BASE_URL}/?bus={bus['id']}"
        bus_bytes = download_qr_code_image(bus_url, size=500)
        clean_name = f"QR_{bus['line'].replace(' ', '_')}.png"
        file_path = os.path.join(OUTPUT_DIR, clean_name)
        with open(file_path, "wb") as f:
            f.write(bus_bytes)
        print(f"Saved: {file_path}")

    # 4. Generate an HTML Viewer sheet for easy printing and viewing
    cards_html = ""
    # General card
    cards_html += f"""
    <div class="qr-card">
      <div class="line-tag-main">باركود عام (لكافة الخطوط)</div>
      <div class="vendor-sub">الشركة المشغلة: شركة أبو الهول</div>
      <img src="QR_العام_لكل_الخطوط.png" class="qr-img" alt="General QR">
      <div class="scan-hint">📷 امسح بكاميرا الهاتف للفتح المباشر</div>
      <div class="safety-pledge">🔒 بلاغك يصل مباشرة لمسؤولي السيفتي بالجامعة</div>
      <div class="room-notice">🏢 في حالة وجود شكوى تخص السلامة احنا في روم 112</div>
      <div class="emergency-badge">🚨 إدارة النقل: 01040772030</div>
    </div>
    """

    for bus in BUSES[:6]:
        clean_name = f"QR_{bus['line'].replace(' ', '_')}.png"
        cards_html += f"""
    <div class="qr-card">
      <div class="line-tag-main">{bus['line']}</div>
      <div class="vendor-sub">الشركة المشغلة: شركة أبو الهول</div>
      <img src="{clean_name}" class="qr-img" alt="{bus['line']}">
      <div class="scan-hint">📷 امسح بكاميرا الهاتف للفتح المباشر</div>
      <div class="safety-pledge">🔒 بلاغك يصل مباشرة لمسؤولي السيفتي بالجامعة</div>
      <div class="room-notice">🏢 في حالة وجود شكوى تخص السلامة احنا في روم 112</div>
      <div class="emergency-badge">🚨 إدارة النقل: 01040772030</div>
    </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>استيكرات باركود حافلات جامعة السويدي للتكنولوجيا (SUT)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body {{
      font-family: 'Cairo', system-ui, sans-serif;
      background: #0b1120;
      color: #f8fafc;
      padding: 2rem 1rem;
      text-align: center;
      margin: 0;
    }}
    .header-bar {{
      max-width: 900px;
      margin: 0 auto 2rem;
      background: #1e293b;
      padding: 1.25rem 2rem;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }}
    .brand-wrap {{
      display: flex;
      align-items: center;
      gap: 1rem;
      text-align: right;
    }}
    .logo-box {{
      background: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
    }}
    .logo-box img {{
      height: 42px;
      max-width: 150px;
      object-fit: contain;
    }}
    h1 {{
      font-size: 1.2rem;
      margin: 0 0 4px;
      color: #f8fafc;
    }}
    .sub-head {{
      color: #94a3b8;
      font-size: 0.85rem;
      margin: 0;
    }}
    .btn-print {{
      background: #3b82f6;
      color: #fff;
      border: none;
      padding: 10px 24px;
      font-size: 0.95rem;
      font-weight: bold;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
    }}
    .cards-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }}
    .qr-card {{
      background: #151e2e;
      border: 2px solid #3b82f6;
      border-radius: 16px;
      padding: 1.5rem 1.25rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
    }}
    .line-tag-main {{
      font-size: 1.15rem;
      font-weight: 800;
      color: #60a5fa;
      margin-bottom: 4px;
    }}
    .vendor-sub {{
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 1rem;
    }}
    .qr-img {{
      width: 220px;
      height: 220px;
      background: #fff;
      border-radius: 12px;
      padding: 8px;
      margin: 0 auto 0.85rem;
      display: block;
    }}
    .scan-hint {{
      font-size: 0.85rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 0.5rem;
    }}
    .safety-pledge {{
      font-size: 0.78rem;
      color: #cbd5e1;
      margin-bottom: 0.35rem;
    }}
    .room-notice {{
      background: rgba(59, 130, 246, 0.12);
      border: 1px dashed rgba(59, 130, 246, 0.4);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 0.78rem;
      color: #93c5fd;
      margin: 0.4rem 0;
      width: 100%;
      box-sizing: border-box;
    }}
    .emergency-badge {{
      font-size: 0.8rem;
      font-weight: 700;
      color: #f87171;
      margin-top: 0.4rem;
    }}
    @media print {{
      body {{ background: #fff; color: #000; padding: 0; }}
      .btn-print {{ display: none; }}
      .header-bar {{ border: 1px solid #ccc; background: #f8fafc; color: #000; }}
      .header-bar h1 {{ color: #000; }}
      .header-bar .sub-head {{ color: #555; }}
      .qr-card {{ background: #fff; border: 2px solid #000; color: #000; break-inside: avoid; page-break-inside: avoid; }}
      .line-tag-main {{ color: #000; }}
      .vendor-sub {{ color: #444; }}
      .scan-hint {{ color: #222; }}
      .safety-pledge {{ color: #333; }}
      .room-notice {{ background: #f1f5f9; border-color: #94a3b8; color: #000; }}
      .emergency-badge {{ color: #dc2626; }}
    }}
  </style>
</head>
<body>
  <div class="header-bar">
    <div class="brand-wrap">
      <div class="logo-box">
        <img src="../assets/sutech-logo.png" alt="SUTech Logo">
      </div>
      <div>
        <h1>جامعة السويدي للتكنولوجيا - منظومة السلامة والأمان</h1>
        <p class="sub-head">استيكرات باركود الحافلات الرسمية • إدارة النقل الطلابي والسلامة (غرفة 112)</p>
      </div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨️ طباعة الاستيكرات</button>
  </div>

  <div class="cards-grid">
    {cards_html}
  </div>
</body>
</html>
"""
    sheet_path = os.path.join(OUTPUT_DIR, "عرض_وطباعة_الباركود.html")
    with open(sheet_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Printable sheet generated: {sheet_path}")

if __name__ == "__main__":
    generate_all()
