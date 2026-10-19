"""
UniFleet Safety - Realtime Operations Backend & Database Server
جامعة السويدي للتكنولوجيا (Elsewedy University of Technology - SUT)
Zero-dependency, pure Python 3.12 (Standard Library: http.server, sqlite3, json)
Supports:
 - REST API for Incident Submissions & Action Logs
 - Realtime Server-Sent Events (SSE) for Sub-second Admin Notifications
 - SQLite Database Persistence (fleet_safety.db)
 - Static File Serving for Web Application
"""

import http.server
import socketserver
import sqlite3
import json
import os
import sys
import socket
import threading
import time
from urllib.parse import urlparse, parse_qs

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import subprocess
import re
import atexit

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "fleet_safety.db")

# Thread-safe list of active SSE subscriber response streams
sse_clients = []
sse_lock = threading.Lock()

# Public Cloudflare HTTPS Tunnel Status
PUBLIC_URL = None
tunnel_process = None

def get_local_ip():
    """Detect LAN IPv4 address for local network access"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

LOCAL_IP = get_local_ip()

def start_tunnel_thread():
    """Permanent hosting on Vercel/Netlify is used for external 4G access"""
    global PUBLIC_URL
    PUBLIC_URL = None

def cleanup_tunnel():
    pass

# ==========================================================
# DATABASE INITIALIZATION & MIGRATION
# ==========================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Incidents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        bus_id TEXT NOT NULL,
        bus_plate TEXT,
        line_name TEXT,
        vendor_id TEXT,
        vendor_name TEXT,
        driver_name TEXT,
        driver_phone TEXT,
        violation_code TEXT,
        violation_title TEXT,
        violation_icon TEXT,
        severity TEXT,
        location TEXT,
        notes TEXT,
        has_attachment INTEGER DEFAULT 0,
        attachment_type TEXT,
        attachment_url TEXT,
        is_anonymous INTEGER DEFAULT 0,
        student_name TEXT,
        student_phone TEXT,
        status TEXT DEFAULT 'NEW',
        actions_taken TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        iso_date TEXT
    )
    """)

    # Seed with initial realistic SUT samples if database is empty
    cursor.execute("SELECT COUNT(*) FROM incidents")
    count = cursor.fetchone()[0]
    if count == 0:
        initial_samples = [
            (
                "SUT-9102", "101", "باص 101", "خط العاشر 1", "VEND-01", "شركة النيل للنقل",
                "محمد عبد السلام", "01011223344", "PHONE_USAGE", "استخدام الموبايل أثناء السير", "📱",
                "CRITICAL", "طريق مصر الإسماعيلية الصحراوي قبل بوابة العاشر",
                "السائق ماسك الموبايل بيتفرج على فيديوهات والسرعة عالية على الصحراوي والأتوبيس بيحود.",
                1, "image", "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop&q=80",
                0, "أحمد تامر - كلية تكنولوجيا الهندسة SUT", "01099887711", "NEW", "[]",
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 360))
            ),
            (
                "SUT-9098", "106", "باص 106", "خط التجمع", "VEND-01", "شركة النيل للنقل",
                "سامح الأباصيري", "01066778899", "RECKLESS_SPEED", "سرعة زائدة وغرز متهورة", "⚡",
                "CRITICAL", "الطريق الدائري الأوسطي مخرج السويس",
                "سرعة الأتوبيس فوق 110 كم/س وتجاوز خطر وغرز مفاجئة بين الشاحنات.",
                1, "image", "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&auto=format&fit=crop&q=80",
                1, "طالب بجامعة السويدي (مجهول)", "", "INVESTIGATING",
                json.dumps([{"time": "منذ 10 دقائق", "user": "غرفة عمليات SUT", "text": "تم التواصل مع مشرف خط التجمع لإلزام السائق بالتهدئة ومراقبة عداد السرعة عبر الـ GPS."}], ensure_ascii=False),
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 1320))
            ),
            (
                "SUT-9085", "123", "باص 123", "خط بنها منيا القمح", "VEND-01", "شركة النيل للنقل",
                "فتحي الدمرداش", "01033442266", "SMOKING_CABIN", "التدخين داخل الحافلة", "🚬",
                "MEDIUM", "طريق بنها - الزقازيق الزراعي",
                "السائق يقوم بالتدخين داخل الكابينة والدخان يملأ الصالون رغم اعتراض الطلاب.",
                0, None, None, 0, "مريم حسام - SUT", "01122334455", "FINED",
                json.dumps([{"time": "منذ 25 دقيقة", "user": "إدارة الحركة بجامعة السويدي", "text": "توقيع غرامة فورية بقيمة 1,500 ج.م على شركة النيل للنقل وتحذير السائق."}], ensure_ascii=False),
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 2700))
            )
        ]
        cursor.executemany("""
        INSERT INTO incidents (
            id, bus_id, bus_plate, line_name, vendor_id, vendor_name,
            driver_name, driver_phone, violation_code, violation_title, violation_icon,
            severity, location, notes, has_attachment, attachment_type, attachment_url,
            is_anonymous, student_name, student_phone, status, actions_taken, iso_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_samples)
        conn.commit()
    conn.close()

# ==========================================================
# SSE BROADCASTER
# ==========================================================
def broadcast_sse(event_name, data):
    """Broadcast an event payload to all open admin dashboard SSE streams"""
    payload = f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")
    with sse_lock:
        dead_clients = []
        for client in sse_clients:
            try:
                client.wfile.write(payload)
                client.wfile.flush()
            except Exception:
                dead_clients.append(client)
        for dead in dead_clients:
            if dead in sse_clients:
                sse_clients.remove(dead)

# ==========================================================
# CUSTOM REQUEST HANDLER
# ==========================================================
class FleetSafetyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for dynamic data
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        
        # 1. Server-Sent Events (SSE) Live Feed for Admin Dashboard
        if parsed.path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            
            # Send initial keepalive
            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()
            except Exception:
                return

            with sse_lock:
                sse_clients.append(self)

            # Keep connection alive in a loop until client disconnects
            try:
                while True:
                    time.sleep(25)
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                with sse_lock:
                    if self in sse_clients:
                        sse_clients.remove(self)
            return

        # 2. Get All Incidents (REST API)
        if parsed.path == "/api/incidents":
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM incidents ORDER BY created_at DESC")
                rows = cursor.fetchall()
                
                results = []
                for row in rows:
                    results.append({
                        "id": row["id"],
                        "busId": row["bus_id"],
                        "busPlate": row["bus_plate"],
                        "lineName": row["line_name"],
                        "vendorId": row["vendor_id"],
                        "vendorName": row["vendor_name"],
                        "driverName": row["driver_name"],
                        "driverPhone": row["driver_phone"],
                        "violationCode": row["violation_code"],
                        "violationTitle": row["violation_title"],
                        "violationIcon": row["violation_icon"],
                        "severity": row["severity"],
                        "location": row["location"],
                        "notes": row["notes"],
                        "hasAttachment": bool(row["has_attachment"]),
                        "attachmentType": row["attachment_type"],
                        "attachmentUrl": row["attachment_url"],
                        "isAnonymous": bool(row["is_anonymous"]),
                        "studentName": row["student_name"],
                        "studentPhone": row["student_phone"],
                        "status": row["status"],
                        "actionsTaken": json.loads(row["actions_taken"] or "[]"),
                        "isoDate": row["iso_date"] or row["created_at"],
                        "timestamp": "مسجل بالنظام"
                    })
                conn.close()

                response_body = json.dumps({"success": True, "incidents": results}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
                return
            except Exception as e:
                self.send_error(500, f"Database error: {str(e)}")
                return

        # 3. System Health & Network Info
        if parsed.path == "/api/health":
            data = {
                "status": "healthy",
                "university": "Elsewedy University of Technology (SUT)",
                "localIp": LOCAL_IP,
                "publicUrl": PUBLIC_URL,
                "port": PORT,
                "activeSseClients": len(sse_clients),
                "timestamp": time.time()
            }
            body = json.dumps(data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        # Clean URL rewrite: /report -> /report.html
        if parsed.path == "/report":
            self.path = "/report.html"
            if parsed.query:
                self.path += "?" + parsed.query

        # Default: Serve static HTML, CSS, JS files
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode("utf-8")) if post_data else {}
        except Exception:
            self.send_error(400, "Invalid JSON payload")
            return

        # 1. New Incident from Student Phone
        if parsed.path == "/api/incidents":
            try:
                ticket_id = payload.get("id") or f"#SUT-{int(time.time() * 1000) % 9000 + 1000}"
                iso_date = payload.get("isoDate") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                INSERT INTO incidents (
                    id, bus_id, bus_plate, line_name, vendor_id, vendor_name,
                    driver_name, driver_phone, violation_code, violation_title, violation_icon,
                    severity, location, notes, has_attachment, attachment_type, attachment_url,
                    is_anonymous, student_name, student_phone, status, actions_taken, iso_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    ticket_id,
                    payload.get("busId", "101"),
                    payload.get("busPlate", "باص 101"),
                    payload.get("lineName", "خط العاشر"),
                    payload.get("vendorId", "VEND-01"),
                    payload.get("vendorName", "شركة النيل للنقل"),
                    payload.get("driverName", "سائق الحافلة"),
                    payload.get("driverPhone", ""),
                    payload.get("violationCode", "GENERAL"),
                    payload.get("violationTitle", "ملاحظة أمان"),
                    payload.get("violationIcon", "⚠️"),
                    payload.get("severity", "MEDIUM"),
                    payload.get("location", "طريق مصر الإسماعيلية الصحراوي"),
                    payload.get("notes", ""),
                    1 if payload.get("hasAttachment") else 0,
                    payload.get("attachmentType"),
                    payload.get("attachmentUrl"),
                    1 if payload.get("isAnonymous") else 0,
                    payload.get("studentName", "طالب بجامعة السويدي"),
                    payload.get("studentPhone", ""),
                    payload.get("status", "NEW"),
                    json.dumps(payload.get("actionsTaken", []), ensure_ascii=False),
                    iso_date
                ))
                conn.commit()
                conn.close()

                # Build full incident object for SSE broadcast
                incident_obj = dict(payload)
                incident_obj["id"] = ticket_id
                incident_obj["timestamp"] = "الآن (منذ لحظات)"
                incident_obj["isoDate"] = iso_date

                # Broadcast immediately to all connected admin dashboards!
                broadcast_sse("new_incident", incident_obj)

                response_body = json.dumps({"success": True, "ticketId": ticket_id}).encode("utf-8")
                self.send_response(201)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
                return
            except Exception as e:
                self.send_error(500, f"Failed to save incident: {str(e)}")
                return

        # 2. Update Incident Action or Status from Admin Dashboard
        if parsed.path == "/api/incidents/action":
            try:
                incident_id = payload.get("incidentId")
                new_status = payload.get("status")
                action_entry = payload.get("actionEntry")

                if not incident_id:
                    self.send_error(400, "Missing incidentId")
                    return

                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT actions_taken, status FROM incidents WHERE id = ?", (incident_id,))
                row = cursor.fetchone()
                if not row:
                    conn.close()
                    self.send_error(404, "Incident not found")
                    return

                actions = json.loads(row["actions_taken"] or "[]")
                if action_entry:
                    actions.append(action_entry)
                
                status_to_save = new_status if new_status else row["status"]

                cursor.execute("""
                UPDATE incidents 
                SET status = ?, actions_taken = ?
                WHERE id = ?
                """, (status_to_save, json.dumps(actions, ensure_ascii=False), incident_id))
                conn.commit()
                conn.close()

                # Broadcast update to all dashboards
                broadcast_sse("incident_updated", {
                    "incidentId": incident_id,
                    "status": status_to_save,
                    "actionsTaken": actions
                })

                response_body = json.dumps({"success": True}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
                return
            except Exception as e:
                self.send_error(500, f"Failed to update incident: {str(e)}")
                return

        self.send_error(404, "Endpoint not found")

# ==========================================================
# SERVER STARTUP
# ==========================================================
class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def run():
    init_db()
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadedHTTPServer(server_address, FleetSafetyHandler)

    print("\n" + "=" * 68)
    print("  🚀 خادم منظومة سلامة أسطول جامعة السويدي للتكنولوجيا (SUT)")
    print("  Elsewedy University of Technology - Fleet Safety Live Backend")
    print("=" * 68)
    print(f"  🟢 شاشة غرفة العمليات (الكمبيوتر):   http://localhost:{PORT}/index.html?view=operations-center")
    print(f"  📱 رابط تليفونات الطلاب (نفس الشبكة): http://{LOCAL_IP}:{PORT}/index.html")
    print(f"  💾 قاعدة البيانات:                    fleet_safety.db (SQLite)")
    print(f"  ⚡ البث المباشر الفوري:               Server-Sent Events (SSE) جاهز ونشط")
    print("=" * 68)

    # Start Cloudflare Public HTTPS Tunnel for 4G/5G mobile access
    start_tunnel_thread()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nتم إيقاف السيرفر بنجاح.")
        httpd.server_close()
        cleanup_tunnel()

if __name__ == "__main__":
    run()
