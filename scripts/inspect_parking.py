import requests
from bs4 import BeautifulSoup
import re

def inspect_url(url, name):
    print(f"\nFetching {name} ({url})...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    resp = requests.get(url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Short Term
    # div[4] -> ul -> li
    # Label: .num-txt
    # Value: .num-noti strong
    
    base_sel = "#menu964_obj1181 > div > div:nth-of-type(4)"
    container = soup.select_one(base_sel)
    
    if container:
        print(f"\n--- {name} Structure ---")
        lis = container.select("ul > li")
        for i, li in enumerate(lis):
            label = li.select_one(".num-txt")
            val = li.select_one(".num-noti strong")
            l_text = label.get_text(strip=True) if label else "NO LABEL"
            v_text = val.get_text(strip=True) if val else "NO VALUE"
            print(f"Item {i+1}: Label='{l_text}', Value='{v_text}'")
            
    # Long Term (East) - div[4]
    if "965" in url:
        east_container = soup.select_one("#menu965_obj1182 > div > div:nth-of-type(4)")
        if east_container:
            first_label = east_container.select_one("ul > li:nth-of-type(1) .num-txt")
            print(f"Div[4] (East?) First Label: {first_label.get_text(strip=True) if first_label else 'NONE'}")

        # Long Term (West) - div[5]
        west_container = soup.select_one("#menu965_obj1182 > div > div:nth-of-type(5)")
        if west_container:
            first_label = west_container.select_one("ul > li:nth-of-type(1) .num-txt")
            print(f"Div[5] (West?) First Label: {first_label.get_text(strip=True) if first_label else 'NONE'}")

def debug_parking():
    inspect_url("https://www.airport.kr/ap_ko/964/subview.do", "Short Term")
    inspect_url("https://www.airport.kr/ap_ko/965/subview.do", "Long Term")

if __name__ == "__main__":
    debug_parking()
