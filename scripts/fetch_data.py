import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import sys

# Configuration
BASE_URL = "https://www.airport.kr/ap_ko/883/subview.do"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "latest_data.json")

def fetch_airport_data():
    print(f"Fetching data from {BASE_URL}...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    try:
        response = requests.get(BASE_URL, headers=headers)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch data: {e}")
        sys.exit(1)

    soup = BeautifulSoup(response.text, 'html.parser')
    
    try:
        data = parse_airport_html(soup)
        save_data(data)
        print("Data successfully fetched and saved.")
    except Exception as e:
        print(f"Error parsing or saving data: {e}")
        sys.exit(1)

def parse_airport_html(soup):
    # Logic adapted from server.py
    target_table = soup.find('table', id='userEx')
    
    if not target_table:
        # Fallback strategies
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
        cell_texts = [cell.get_text(strip=True).replace(',', '') for cell in cells]
        
        if len(cell_texts) < 12: 
            continue

        try:
            hour = cell_texts[0].replace('시', '')
            
            # Exclude "Total" row
            if "합" in hour or "계" in hour or "Total" in hour:
                continue

            def to_int(val):
                return int(val) if val.isdigit() else 0

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
            
            # Parse start hour
            hour_start = 0
            try:
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
            print(f"Row parsing error: {e} for row: {cell_texts}")
            continue

    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "terminal": "T1",
        "lastUpdated": datetime.now().isoformat(),
        "hourlyData": hourly_data
    }

def save_data(data):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved data to {OUTPUT_FILE}")

if __name__ == "__main__":
    fetch_airport_data()
