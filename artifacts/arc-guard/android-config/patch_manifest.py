#!/usr/bin/env python3
"""
patch_manifest.py — Injects CAMERA permission into Capacitor-generated AndroidManifest.xml.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_manifest.py

html5-qrcode uses the WebView's getUserMedia() which requires the Android-level
CAMERA permission to be declared in the manifest and granted at runtime.
Capacitor does NOT add this automatically unless @capacitor/camera is installed.
"""

import re
import os
import sys

MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"

# Permissions and features to inject BEFORE the first <application> tag.
CAMERA_BLOCK = (
    "\n"
    "    <!-- Camera — required for html5-qrcode WebView QR scanning -->\n"
    "    <uses-permission android:name=\"android.permission.CAMERA\" />\n"
    "    <uses-feature android:name=\"android.hardware.camera\" android:required=\"true\" />\n"
    "    <uses-feature android:name=\"android.hardware.camera.autofocus\" android:required=\"false\" />\n"
)


def patch_manifest():
    if not os.path.exists(MANIFEST_PATH):
        print("ERROR: {} not found — run 'npx cap add android' first".format(MANIFEST_PATH))
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        content = f.read()

    if 'android.permission.CAMERA' in content:
        print("CAMERA permission already present in {} — skipping".format(MANIFEST_PATH))
        return

    # Insert CAMERA block immediately before the first <application ...> tag
    app_match = re.search(r"\n(\s*)<application\b", content)
    if not app_match:
        print("ERROR: could not find <application> tag in AndroidManifest.xml")
        sys.exit(1)

    insert_at = app_match.start()
    new_content = content[:insert_at] + CAMERA_BLOCK + content[insert_at:]

    with open(MANIFEST_PATH, "w") as f:
        f.write(new_content)

    print("CAMERA permission injected into {}".format(MANIFEST_PATH))


def verify():
    with open(MANIFEST_PATH) as f:
        content = f.read()

    checks = [
        ("android.permission.CAMERA",          "CAMERA permission"),
        ("android.hardware.camera\"",           "camera feature"),
        ("android.hardware.camera.autofocus",   "autofocus feature"),
    ]

    all_ok = True
    for needle, label in checks:
        found = needle in content
        print("  {} {}".format("OK  " if found else "MISS", label))
        if not found:
            all_ok = False

    if not all_ok:
        print("\nERROR: some camera entries missing after patch!")
        sys.exit(1)
    print("\nAll camera entries verified in AndroidManifest.xml")


if __name__ == "__main__":
    patch_manifest()
    verify()
