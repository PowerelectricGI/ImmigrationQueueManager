import requests
from bs4 import BeautifulSoup
from datetime import datetime

url = "https://www.airport.kr/ap_ko/883/subview.do"
params = {'DATE': datetime.now().strftime("%Y%m%d")}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

print(f"Fetching from {url} with params {params}")
response = requests.get(url, params=params, headers=headers)
print(f"Status: {response.status_code}")

soup = BeautifulSoup(response.text, 'html.parser')

# Debug: Print table info
tables = soup.find_all('table')
print(f"Found {len(tables)} tables")

for i, table in enumerate(tables):
    print(f"--- Table {i} ---")
    # Print headers
    headers = table.find_all('th')
    header_texts = [h.get_text(strip=True) for h in headers]
    print(f"Headers: {header_texts}")
    
    # Print first 5 rows
    rows = table.find_all('tr')
    print(f"Row count: {len(rows)}")
    for j in range(min(5, len(rows))):
        print(f"  Row {j}:")
        cells = rows[j].find_all(['th', 'td'])
        cell_texts = [c.get_text(strip=True) for c in cells]
        print(f"    Cell count: {len(cells)}")
        print(f"    Cells: {cell_texts}")
