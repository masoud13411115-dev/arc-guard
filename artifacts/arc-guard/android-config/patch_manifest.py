#!/usr/bin/env python3
"""
patch_manifest.py — Injects CAMERA and GPS permissions into Capacitor-generated AndroidManifest.xml.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_manifest.py

Why this script is needed:
  - html5-qrcode uses the WebView getUserMedia() — requires CAMERA in manifest + runtime grant.
  - navigator.geolocation (WebView GPS) — requires ACCESS_FINE_LOCATION in manifest + runtime grant.
  - @capacitor/geolocation is installed but cap sync does not reliably inject location permissions
    into every Capacitor 8 project; declaring them explicitly guarantees they are present.
  - cap sync is called twice (Manager build, Guard build), so this script must run after EACH sync.
"""

import re
import os
import sys

MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"

# All permissions injected BEFORE the <application> block.
PERMISSIONS_BLOCK = (
    "\n"
    "    <!-- Camera — required for html5-qrcode WebView QR scanning -->\n"
    "    <uses-permission android:name=\"android.permission.CAMERA\" />\n"
    "    <uses-feature android:name=\"android.hardware.camera\" android:required=\"true\" />\n"
    "    <uses-feature android:name=\"android.hardware.camera.autofocus\" android:required=\"false\" />\n"
    "\n"
    "    <!-- Location — required for navigator.geolocation in WebView (patrol GPS) -->\n"
    "    <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\" />\n"
    "    <uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\" />\n"
)

# Each entry: (needle_in_manifest, human_label)
CHECKS = [
    ("android.permission.CAMERA",           "CAMERA permission"),
    ("android.hardware.camera\"",            "camera feature"),
    ("android.hardware.camera.autofocus",    "autofocus feature"),
    ("ACCESS_FINE_LOCATION",                 "ACCESS_FINE_LOCATION"),
    ("ACCESS_COARSE_LOCATION",               "ACCESS_COARSE_LOCATION"),
]


def patch_manifest():
    if not os.path.exists(MANIFEST_PATH):
        print("ERROR: {} not found — run 'npx cap add android' first".format(MANIFEST_PATH))
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        content = f.read()

    # Build only the lines that are still missing
    missing_lines = []
    if "android.permission.CAMERA" not in content:
        missing_lines.append(
            "    <!-- Camera — required for html5-qrcode WebView QR scanning -->\n"
            "    <uses-permission android:name=\"android.permission.CAMERA\" />\n"
            "    <uses-feature android:name=\"android.hardware.camera\" android:required=\"true\" />\n"
            "    <uses-feature android:name=\"android.hardware.camera.autofocus\" android:required=\"false\" />\n"
        )
    if "ACCESS_FINE_LOCATION" not in content:
        missing_lines.append(
            "    <!-- Location — required for navigator.geolocation in WebView (patrol GPS) -->\n"
            "    <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\" />\n"
            "    <uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\" />\n"
        )

    if not missing_lines:
        print("All required permissions already present in {} — skipping".format(MANIFEST_PATH))
        return

    block = "\n" + "".join(missing_lines)

    app_match = re.search(r"\n(\s*)<application\b", content)
    if not app_match:
        print("ERROR: could not find <application> tag in AndroidManifest.xml")
        sys.exit(1)

    insert_at = app_match.start()
    new_content = content[:insert_at] + block + content[insert_at:]

    with open(MANIFEST_PATH, "w") as f:
        f.write(new_content)

    print("Injected {} permission block(s) into {}".format(len(missing_lines), MANIFEST_PATH))


def verify():
    with open(MANIFEST_PATH) as f:
        content = f.read()

    all_ok = True
    for needle, label in CHECKS:
        found = needle in content
        print("  {} {}".format("OK  " if found else "MISS", label))
        if not found:
            all_ok = False

    if not all_ok:
        print("\nERROR: some required permissions are missing after patch!")
        sys.exit(1)
    print("\nAll required permissions verified in AndroidManifest.xml")


if __name__ == "__main__":
    patch_manifest()
    verify()
