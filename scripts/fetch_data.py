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
        
        # XPath mappings to CSS selectors
        # Floor 1: //*[@id="menu964_obj1181"]/div/div[4]/ul/li[1]/div/div[2]/div[1]/strong
        
        def get_text(selector):
            el = soup.select_one(selector)
            return el.get_text(strip=True) if el else "0"

        def extract_num(text):
            return int(re.sub(r'[^0-9]', '', text)) if text else 0

        # Note: nth-of-type is 1-based. 
        # div[4] -> div:nth-of-type(4)
        base_sel = "#menu964_obj1181 > div > div:nth-of-type(4) > ul"
        
        floor1_text = get_text(f"{base_sel} > li:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        b1_text = get_text(f"{base_sel} > li:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        b2_text = get_text(f"{base_sel} > li:nth-of-type(3) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")

        result["shortTerm"] = {
            "floor1": {"available": extract_num(floor1_text), "name": "지상 1층"},
            "basement1": {"available": extract_num(b1_text), "name": "지하 1층"},
            "basement2": {"available": extract_num(b2_text), "name": "지하 2층"}
        }
    except Exception as e:
        print(f"Error fetching short-term parking: {e}")
        result["errors"].append(f"Short-term: {str(e)}")

    # 2. Long Term Parking
    try:
        print(f"Fetching long-term parking from {PARKING_LONG_URL}...")
        resp = requests.get(PARKING_LONG_URL, headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        def get_text(selector):
            el = soup.select_one(selector)
            return el.get_text(strip=True) if el else "0"

        def extract_num(text):
            return int(re.sub(r'[^0-9]', '', text)) if text else 0

        # East: div[4]
        east_base = "#menu965_obj1182 > div > div:nth-of-type(4) > ul"
        east_p1 = get_text(f"{east_base} > li:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        east_tower = get_text(f"{east_base} > li:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        east_p3 = get_text(f"{east_base} > li:nth-of-type(3) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")

        # West: div[5]
        west_base = "#menu965_obj1182 > div > div:nth-of-type(5) > ul"
        west_p2 = get_text(f"{west_base} > li:nth-of-type(1) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        west_tower = get_text(f"{west_base} > li:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")
        west_p4 = get_text(f"{west_base} > li:nth-of-type(3) > div > div:nth-of-type(2) > div:nth-of-type(1) > strong")

        result["longTerm"] = {
            "east": {
                "p1": {"available": extract_num(east_p1), "name": "장기주차장 P1"},
                "tower": {"available": extract_num(east_tower), "name": "주차타워 동편"},
                "p3": {"available": extract_num(east_p3), "name": "장기주차장 P3"}
            },
            "west": {
                "p2": {"available": extract_num(west_p2), "name": "장기주차장 P2"},
                "tower": {"available": extract_num(west_tower), "name": "주차타워 서편"},
                "p4": {"available": extract_num(west_p4), "name": "장기주차장 P4"}
            }
        }

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
