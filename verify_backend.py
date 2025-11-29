import requests
import json
from datetime import datetime, timedelta

# Today and Tomorrow
today_str = datetime.now().strftime("%Y%m%d")
tomorrow_str = (datetime.now() + timedelta(days=1)).strftime("%Y%m%d")

url_today = f"http://localhost:8080/api/airport-data?date={today_str}"
url_tomorrow = f"http://localhost:8080/api/airport-data?date={tomorrow_str}"

def fetch_and_print(url, label):
    print(f"--- Fetching {label} ({url}) ---")
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            hourly_data = data.get('hourlyData', [])
            print(f"  Count: {len(hourly_data)}")
            if len(hourly_data) > 0:
                print("  First Item Sample:")
                print(json.dumps(hourly_data[0], indent=2, ensure_ascii=False))
                return hourly_data[0] # Return first item for comparison
            else:
                print("  WARNING: Empty data")
        else:
            print(f"  Error: {response.status_code}")
    except Exception as e:
        print(f"  Request failed: {e}")
    return None

data1 = fetch_and_print(url_today, "Today")
data2 = fetch_and_print(url_tomorrow, "Tomorrow")

if data1 and data2:
    if data1 == data2:
        print("\nWARNING: Data is IDENTICAL for both days! Date parameter might not be working.")
    else:
        print("\nSUCCESS: Data differs between dates.")
