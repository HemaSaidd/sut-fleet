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
    {"id": "101", "line": "خط العاشر من رمضان 1", "vendor": "شركة النيل للنقل"},
    {"id": "102", "line": "خط العاشر من رمضان 2", "vendor": "شركة النيل للنقل"},
    {"id": "103", "line": "خط الإسماعيلية الصحراوي", "vendor": "ترافيل لاين"},
    {"id": "104", "line": "خط السويس", "vendor": "شركة السلام"},
    {"id": "105", "line": "خط ميت غمر والشرقية", "vendor": "إيجي باص"},
    {"id": "106", "line": "خط التجمع الخامس والجامعة الأمريكية", "vendor": "شركة النيل للنقل"},
    {"id": "107", "line": "خط الرحاب ومدينتي", "vendor": "ترافيل لاين"},
    {"id": "108", "line": "خط الشروق والمستقبل", "vendor": "شركة السلام"},
    {"id": "109", "line": "خط العبور والنهضة", "vendor": "إيجي باص"},
    {"id": "110", "line": "خط جسر السويس ومصر الجديدة", "vendor": "شركة النيل للنقل"}
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

    # 1. Standalone Pure QR Code for Bus 101
    url_101 = f"{PRODUCTION_BASE_URL}/?bus=101"
    png_bytes_101 = download_qr_code_image(url_101, size=600)
    pure_qr_101_path = os.path.join(OUTPUT_DIR, "QR_باص_101_العاشر.png")
    with open(pure_qr_101_path, "wb") as f:
        f.write(png_bytes_101)
    print(f"Pure QR Code saved: {pure_qr_101_path}")

    # 2. Standalone General QR Code (Student Safety Form)
    general_url = f"{PRODUCTION_BASE_URL}/"
    png_bytes_gen = download_qr_code_image(general_url, size=600)
    pure_qr_gen_path = os.path.join(OUTPUT_DIR, "QR_العام_لجميع_الباصات.png")
    with open(pure_qr_gen_path, "wb") as f:
        f.write(png_bytes_gen)
    print(f"General QR Code saved: {pure_qr_gen_path}")

    # 3. Generate QR codes for top 5 lines
    for bus in BUSES[:5]:
        bus_url = f"{PRODUCTION_BASE_URL}/?bus={bus['id']}"
        bus_bytes = download_qr_code_image(bus_url, size=500)
        clean_name = f"QR_باص_{bus['id']}_{bus['line'].replace(' ', '_')}.png"
        file_path = os.path.join(OUTPUT_DIR, clean_name)
        with open(file_path, "wb") as f:
            f.write(bus_bytes)
        print(f"Saved: {file_path}")

    # 4. Generate an HTML Viewer sheet for easy printing and viewing
    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>استيكرات باركود حافلات جامعة السويدي للتكنولوجيا (SUT)</title>
  <style>
    body {{
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 2rem;
      text-align: center;
    }}
    h1 {{ color: #60a5fa; margin-bottom: 0.5rem; }}
    p {{ color: #94a3b8; margin-bottom: 2rem; }}
    .cards-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
    }}
    .qr-card {{
      background: #1e293b;
      border: 2px solid #3b82f6;
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }}
    .qr-card h2 {{
      font-size: 1.3rem;
      color: #fff;
      margin-bottom: 0.25rem;
    }}
    .qr-card .line-tag {{
      display: inline-block;
      background: #2563eb;
      color: #fff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: bold;
      margin-bottom: 1rem;
    }}
    .qr-img {{
      width: 240px;
      height: 240px;
      background: #fff;
      border-radius: 12px;
      padding: 10px;
      margin: 0 auto 1rem;
      display: block;
    }}
    .scan-hint {{
      font-size: 0.85rem;
      color: #cbd5e1;
      margin-bottom: 0.5rem;
    }}
    .url-text {{
      font-size: 0.75rem;
      color: #60a5fa;
      direction: ltr;
      word-break: break-all;
    }}
    .btn-print {{
      background: #22c55e;
      color: #fff;
      border: none;
      padding: 12px 28px;
      font-size: 1rem;
      font-weight: bold;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 2rem;
    }}
  </style>
</head>
<body>
  <h1>⚡ استيكرات باركود حافلات جامعة السويدي للتكنولوجيا (SUT)</h1>
  <p>امسح أي كود بكاميرا الموبايل لتفتح صفحة البلاغ المباشرة للطالب بدون أي وصول للوحة الإدارة</p>
  <button class="btn-print" onclick="window.print()">🖨️ طباعة الاستيكرات</button>

  <div class="cards-grid">
    <div class="qr-card">
      <h2>باص 101</h2>
      <span class="line-tag">خط العاشر من رمضان 1</span>
      <img src="QR_باص_101_العاشر.png" class="qr-img" alt="QR Code Bus 101">
      <div class="scan-hint">📷 امسح بكاميرا الهاتف للفتح الفوري</div>
      <div class="url-text">{PRODUCTION_BASE_URL}/?bus=101</div>
    </div>

    <div class="qr-card">
      <h2>كود عام (لكافة الحافلات)</h2>
      <span class="line-tag">منظومة النقل الطلابي SUT</span>
      <img src="QR_العام_لجميع_الباصات.png" class="qr-img" alt="General QR Code">
      <div class="scan-hint">📷 يتيح للطالب اختيار خطه وحافلته</div>
      <div class="url-text">{PRODUCTION_BASE_URL}/</div>
    </div>

    <div class="qr-card">
      <h2>باص 102</h2>
      <span class="line-tag">خط العاشر من رمضان 2</span>
      <img src="QR_باص_102_خط_العاشر_من_رمضان_2.png" class="qr-img" alt="QR Code Bus 102">
      <div class="scan-hint">📷 امسح بكاميرا الهاتف للفتح الفوري</div>
      <div class="url-text">{PRODUCTION_BASE_URL}/?bus=102</div>
    </div>

    <div class="qr-card">
      <h2>باص 103</h2>
      <span class="line-tag">خط الإسماعيلية الصحراوي</span>
      <img src="QR_باص_103_خط_الإسماعيلية_الصحراوي.png" class="qr-img" alt="QR Code Bus 103">
      <div class="scan-hint">📷 امسح بكاميرا الهاتف للفتح الفوري</div>
      <div class="url-text">{PRODUCTION_BASE_URL}/?bus=103</div>
    </div>
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
