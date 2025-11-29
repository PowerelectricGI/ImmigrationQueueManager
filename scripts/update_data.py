import json
import os
import requests
from bs4 import BeautifulSoup
from datetime import datetime

def fetch_airport_data():
    base_url = "https://www.airport.kr/ap_ko/883/subview.do"
    
    print(f"Fetching from: {base_url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }

    try:
        response = requests.get(base_url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        data = parse_airport_html(soup)
        
        return data
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def parse_airport_html(soup):
    # User specified table id="userEx"
    target_table = soup.find('table', id='userEx')
    
    if not target_table:
        # Fallback logic
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
        
        if len(cell_texts) < 12: 
            continue

        try:
            hour = cell_texts[0].replace('시', '')
            
            # Exclude "Total" row (합계)
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
            
            # Parse start hour (e.g., "00~01" -> 0)
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

    print(f"Parsed {len(hourly_data)} rows")
    
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "terminal": "T1",
        "lastUpdated": datetime.now().isoformat(),
        "hourlyData": hourly_data
    }

def save_data(data, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Data saved to {filepath}")

if __name__ == "__main__":
    data = fetch_airport_data()
    if data:
        # Save to src/data/latest_data.json
        # Assuming script is run from root or scripts dir, we need to handle paths carefully
        # We'll assume it's run from project root
        output_path = os.path.join("src", "data", "latest_data.json")
        save_data(data, output_path)
    else:
        exit(1)
