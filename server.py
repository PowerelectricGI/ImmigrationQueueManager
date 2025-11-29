import http.server
import socketserver
import urllib.request
import json
import re
import os
from datetime import datetime

PORT = 8080
DIRECTORY = "src"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/airport-data'):
            self.handle_airport_data()
        else:
            super().do_GET()

    def handle_airport_data(self):
        try:
            # Parse query parameters
            from urllib.parse import urlparse, parse_qs
            query_components = parse_qs(urlparse(self.path).query)
            date_param = query_components.get('date', [None])[0]

            # 1. Fetch data from airport.kr
            base_url = "https://www.airport.kr/ap_ko/883/subview.do"
            params = {}
            if date_param:
                # User specified name="pday"
                params['pday'] = date_param

            print(f"Fetching from: {base_url} with params {params}")
            
            # Use requests for better header/cookie handling
            import requests
            from bs4 import BeautifulSoup

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }

            response = requests.get(base_url, params=params, headers=headers)
            response.raise_for_status()
            
            # 2. Parse HTML with BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')
            data = self.parse_airport_html(soup, date_param)

            # 3. Send JSON response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))

        except Exception as e:
            with open("server_error.log", "a", encoding="utf-8") as f:
                f.write(f"Request error: {e}\n")
            print(f"Error handling request: {e}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))

    def parse_airport_html(self, soup, date_param=None):
        # User specified table id="userEx"
        target_table = soup.find('table', id='userEx')
        
        if not target_table:
            # Fallback logic if id changes, but prioritize user input
            tables = soup.find_all('table')
            for table in tables:
                if table.get('id') == 'userEx':
                    target_table = table
                    break
        
        if not target_table:
             # Fallback: look for table with enough rows
            tables = soup.find_all('table')
            for table in tables:
                tbody = table.find('tbody') or table
                if len(tbody.find_all('tr')) > 10:
                    target_table = table
                    break

        if not target_table:
            raise ValueError("Could not find valid data table (id='userEx') in HTML")
        
        tbody = target_table.find('tbody') or target_table
        rows = tbody.find_all('tr')
        hourly_data = []
        
        for row in rows:
            cells = row.find_all(['td', 'th'])
            # Clean text: remove tags, whitespace, commas
            cell_texts = [cell.get_text(strip=True).replace(',', '') for cell in cells]
            
            # Log for debug
            with open("server_debug.log", "a", encoding="utf-8") as f:
                f.write(f"Row len: {len(cell_texts)}, Content: {cell_texts}\n")

            if len(cell_texts) < 12: 
                continue

            try:
                hour = cell_texts[0].replace('시', '')
                
                # Exclude "Total" row (합계)
                if "합" in hour or "계" in hour or "Total" in hour:
                    continue

                def to_int(val):
                    return int(val) if val.isdigit() else 0

                # User requested to exclude totals from the graph.
                # We will exclude them from the API response to ensure they aren't plotted.
                # Indices:
                # 0: Time
                # 1: Arr AB
                # 2: Arr C
                # 3: Arr D
                # 4: Arr EF
                # 5: Arr Total (EXCLUDE) -> INCLUDE
                # 6: Dep 1
                # 7: Dep 2
                # 8: Dep 3
                # 9: Dep 4
                # 10: Dep 5,6
                # 11: Dep Total (EXCLUDE) -> INCLUDE

                arrival = {
                    "AB": to_int(cell_texts[1]),
                    "C": to_int(cell_texts[2]),
                    "D": to_int(cell_texts[3]),
                    "EF": to_int(cell_texts[4]),
                    "total": to_int(cell_texts[5])
                }
                
                departure = {
                    "AB": to_int(cell_texts[6]) + to_int(cell_texts[7]), 
                    "C": to_int(cell_texts[8]),
                    "D": to_int(cell_texts[9]),
                    "EF": to_int(cell_texts[10]),
                    "total": to_int(cell_texts[11])
                }
                
                # Parse start hour (e.g., "00~01" -> 0)
                hour_start = 0
                try:
                    # Extract first number found in the string
                    import re
                    match = re.search(r'(\d+)', hour)
                    if match:
                        hour_start = int(match.group(1))
                except:
                    pass

                hourly_data.append({
                    "hour": hour,
                    "hourStart": hour_start,
                    "arrival": arrival,
                    "departure": departure
                })
            except Exception as e:
                with open("server_error.log", "a", encoding="utf-8") as f:
                    f.write(f"Row parsing error: {e} for row: {cell_texts}\n")
                continue

        print(f"Parsed {len(hourly_data)} rows")
        
        # Use requested date if available, otherwise today
        response_date = datetime.now().strftime("%Y-%m-%d")
        if date_param:
            # date_param is YYYYMMDD, convert to YYYY-MM-DD
            try:
                response_date = f"{date_param[:4]}-{date_param[4:6]}-{date_param[6:]}"
            except:
                pass

        return {
            "date": response_date,
            "terminal": "T1",
            "lastUpdated": datetime.now().isoformat(),
            "hourlyData": hourly_data
        }

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Proxy endpoint available at /api/airport-data")
        httpd.serve_forever()
