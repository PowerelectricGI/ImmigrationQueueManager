import requests
import json
from datetime import datetime

date_str = datetime.now().strftime("%Y%m%d")
url = f"http://localhost:8080/api/airport-data?date={date_str}"

try:
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print(f"Error: {response.status_code}")
except Exception as e:
    print(f"Failed: {e}")
