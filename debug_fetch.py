import urllib.request

url = "https://www.airport.kr/ap_ko/883/subview.do"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html_content = response.read().decode('utf-8')
        print(html_content[:1000]) # Print first 1000 chars
        print("..." * 10)
        if "tbody" in html_content:
            print("Found tbody")
        else:
            print("No tbody found")
except Exception as e:
    print(e)
