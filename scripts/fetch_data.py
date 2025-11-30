import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import sys
import re

# Configuration
BASE_URL = "https://www.airport.kr/ap_ko/883/subview.do"
PARKING_SHORT_URL = "https://www.airport.kr/ap_ko/964/subview.do"
PARKING_LONG_URL = "https://www.airport.kr/ap_ko/965/subview.do"

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "latest_data.json")
PARKING_OUTPUT_FILE = os.path.join(OUTPUT_DIR, "parking_data.json")

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
        save_data(data, OUTPUT_FILE)
        print("Airport data successfully fetched and saved.")
    except Exception as e:
        print(f"Error parsing or saving airport data: {e}")
        # Don't exit here, try to fetch parking data even if airport data fails

def fetch_parking_data():
    print("Fetching parking data...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    result = {
        "id": datetime.now().strftime("%Y%m%d%H%M%S"),
        "lastUpdated": datetime.now().isoformat(),
        "shortTerm": None,
        "longTerm": None,
        "errors": []
    }

    # 1. Short Term Parking
    try:
        print(f"Fetching short-term parking from {PARKING_SHORT_URL}...")
        resp = requests.get(PARKING_SHORT_URL, headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        container = soup.select_one("#menu964_obj1181")
        if not container:
            raise ValueError("Short term container not found")

        # Initialize with defaults
        st_data = {
            "floor1": {"available": 0, "name": "지상 1층"},
            "basement1": {"available": 0, "name": "지하 1층"},
            "basement2": {"available": 0, "name": "지하 2층"}
        }

        # Iterate all list items to find matches
        items = container.select("ul > li")
        for item in items:
            label_el = item.select_one(".num-txt")
            val_el = item.select_one(".num-noti strong")
            
            if not label_el or not val_el:
                continue
                
            label = label_el.get_text(strip=True)
            val_text = val_el.get_text(strip=True)
            val = int(re.sub(r'[^0-9]', '', val_text)) if val_text else 0
            
            if "지상 1층" in label:
                st_data["floor1"]["available"] = val
            elif "지하 1층" in label:
                st_data["basement1"]["available"] = val
            elif "지하 2층" in label:
                st_data["basement2"]["available"] = val

        result["shortTerm"] = st_data

    except Exception as e:
        print(f"Error fetching short-term parking: {e}")
        result["errors"].append(f"Short-term: {str(e)}")

    # 2. Long Term Parking
    try:
        print(f"Fetching long-term parking from {PARKING_LONG_URL}...")
        resp = requests.get(PARKING_LONG_URL, headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        container = soup.select_one("#menu965_obj1182")
        if not container:
            raise ValueError("Long term container not found")

        lt_data = {
            "east": {
                "p1": {"available": 0, "name": "장기주차장 P1"},
                "tower": {"available": 0, "name": "주차타워 동편"},
                "p3": {"available": 0, "name": "장기주차장 P3"}
            },
            "west": {
                "p2": {"available": 0, "name": "장기주차장 P2"},
                "tower": {"available": 0, "name": "주차타워 서편"},
                "p4": {"available": 0, "name": "장기주차장 P4"}
            }
        }

        # We need to distinguish East vs West.
        # Usually they are in separate divs.
        # Let's iterate through the main divs and check their content.
        
        # Strategy: Find all ULs, check the labels inside.
        # If P1/P3 -> East
        # If P2/P4 -> West
        
        uls = container.select("ul")
        for ul in uls:
            items = ul.select("li")
            is_east = False
            is_west = False
            
            # First pass to identify section
            for item in items:
                label = item.select_one(".num-txt")
                if not label: continue
                txt = label.get_text(strip=True)
                if "P1" in txt or "P3" in txt:
                    is_east = True
                if "P2" in txt or "P4" in txt:
                    is_west = True
            
            # Second pass to extract data
            for item in items:
                label_el = item.select_one(".num-txt")
                val_el = item.select_one(".num-noti strong")
                
                if not label_el or not val_el:
                    continue
                    
                label = label_el.get_text(strip=True)
                val_text = val_el.get_text(strip=True)
                val = int(re.sub(r'[^0-9]', '', val_text)) if val_text else 0
                
                if is_east:
                    if "P1" in label:
                        lt_data["east"]["p1"]["available"] = val
                    elif "P3" in label:
                        lt_data["east"]["p3"]["available"] = val
                    elif "주차타워" in label:
                        lt_data["east"]["tower"]["available"] = val
                elif is_west:
                    if "P2" in label:
                        lt_data["west"]["p2"]["available"] = val
                    elif "P4" in label:
                        lt_data["west"]["p4"]["available"] = val
                    elif "주차타워" in label:
                        lt_data["west"]["tower"]["available"] = val

        result["longTerm"] = lt_data

    except Exception as e:
        print(f"Error fetching long-term parking: {e}")
        result["errors"].append(f"Long-term: {str(e)}")

    save_data(result, PARKING_OUTPUT_FILE)
    print("Parking data successfully fetched and saved.")


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

def save_data(data, filepath):
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved data to {filepath}")

if __name__ == "__main__":
    fetch_airport_data()
    fetch_parking_data()
