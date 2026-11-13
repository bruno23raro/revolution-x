#!/usr/bin/env python3
import sys, time, urllib.request, urllib.error, ssl
url = sys.argv[1]
key = sys.argv[2] if len(sys.argv) > 2 else None
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
hdr = {"Authorization": "Bearer " + key} if key else {}
req = urllib.request.Request(url, headers=hdr)
t = time.time()
try:
    r = urllib.request.urlopen(req, context=ctx, timeout=15)
    print(r.status, str(int((time.time() - t) * 1000)) + "ms", r.read(300).decode("utf-8", "replace"))
except urllib.error.HTTPError as e:
    print(e.code, e.read(300).decode("utf-8", "replace"))
except Exception as e:
    print("000", type(e).__name__, e)