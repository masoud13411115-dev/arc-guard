#!/usr/bin/env python3
"""
patch_manifest.py — Injects permissions and attributes into Capacitor-generated
                    AndroidManifest.xml.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_manifest.py

Why this script is needed:
  - html5-qrcode uses WebView getUserMedia() — requires CAMERA in manifest.
  - navigator.geolocation — requires ACCESS_FINE_LOCATION in manifest.
  - Background GPS (foreground service for patrol) — requires FOREGROUND_SERVICE
    and FOREGROUND_SERVICE_LOCATION so Android 14+ allows the service type.
  - WAKE_LOCK — keeps GPS and sync alive when screen is off.
  - usesCleartextTraffic="true" — required for LAN server mode (HTTP, not HTTPS).
  - cap sync is called twice (Manager, Guard builds), so this script must run
    after EACH sync.
"""

import re
import os
import sys

MANIFEST_PATH = "android/app/src/main/AndroidManifest.xml"

# ── Permissions block (injected BEFORE <application>) ─────────────────────

PERMISSIONS = [
    # Camera
    (
        "android.permission.CAMERA",
        (
            "\n"
            "    <!-- Camera — required for html5-qrcode WebView QR scanning -->\n"
            "    <uses-permission android:name=\"android.permission.CAMERA\" />\n"
            "    <uses-feature android:name=\"android.hardware.camera\" android:required=\"true\" />\n"
            "    <uses-feature android:name=\"android.hardware.camera.autofocus\" android:required=\"false\" />\n"
        ),
    ),
    # Location
    (
        "ACCESS_FINE_LOCATION",
        (
            "\n"
            "    <!-- Location — navigator.geolocation in WebView (patrol GPS) -->\n"
            "    <uses-permission android:name=\"android.permission.ACCESS_FINE_LOCATION\" />\n"
            "    <uses-permission android:name=\"android.permission.ACCESS_COARSE_LOCATION\" />\n"
            "    <uses-permission android:name=\"android.permission.ACCESS_BACKGROUND_LOCATION\" />\n"
        ),
    ),
    # Background service + wake lock
    (
        "android.permission.FOREGROUND_SERVICE",
        (
            "\n"
            "    <!-- Background GPS service — keeps patrol location alive when screen is off -->\n"
            "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE\" />\n"
            "    <uses-permission android:name=\"android.permission.FOREGROUND_SERVICE_LOCATION\" />\n"
            "    <uses-permission android:name=\"android.permission.WAKE_LOCK\" />\n"
            "    <uses-permission android:name=\"android.permission.RECEIVE_BOOT_COMPLETED\" />\n"
        ),
    ),
]

CHECKS = [
    ("android.permission.CAMERA",           "CAMERA permission"),
    ("android.hardware.camera\"",            "camera feature"),
    ("android.hardware.camera.autofocus",    "autofocus feature"),
    ("ACCESS_FINE_LOCATION",                 "ACCESS_FINE_LOCATION"),
    ("ACCESS_COARSE_LOCATION",               "ACCESS_COARSE_LOCATION"),
    ("FOREGROUND_SERVICE\"",                 "FOREGROUND_SERVICE"),
    ("WAKE_LOCK",                            "WAKE_LOCK"),
]


def patch_permissions(content):
    """Inject any missing permission blocks BEFORE the <application> tag."""
    app_match = re.search(r"\n(\s*)<application\b", content)
    if not app_match:
        print("ERROR: could not find <application> tag in AndroidManifest.xml")
        sys.exit(1)

    insert_at = app_match.start()
    added = 0

    # Build the block of missing permissions (in reverse order so we can
    # insert them all at the same position)
    blocks_to_add = []
    for needle, block in PERMISSIONS:
        if needle not in content:
            blocks_to_add.append(block)
            added += 1

    if not blocks_to_add:
        print("All required permissions already present — skipping")
        return content

    combined = "".join(blocks_to_add)
    content = content[:insert_at] + combined + content[insert_at:]
    print("Injected {} permission block(s) into {}".format(added, MANIFEST_PATH))
    return content


def patch_cleartext_traffic(content):
    """
    Add android:usesCleartextTraffic="true" to <application> for LAN HTTP mode.
    Capacitor already sets this in some versions; skip if already present.
    """
    if "usesCleartextTraffic" in content:
        print("usesCleartextTraffic already present — skipping")
        return content

    # Insert the attribute into the opening <application tag
    content = re.sub(
        r"(<application\b)",
        r'\1\n        android:usesCleartextTraffic="true"',
        content,
        count=1,
    )
    print("android:usesCleartextTraffic=\"true\" added to <application>")
    return content


def patch_manifest():
    if not os.path.exists(MANIFEST_PATH):
        print("ERROR: {} not found — run 'npx cap add android' first".format(MANIFEST_PATH))
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        content = f.read()

    content = patch_permissions(content)
    content = patch_cleartext_traffic(content)

    with open(MANIFEST_PATH, "w") as f:
        f.write(content)


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
        print("\nERROR: some required entries are missing after patch!")
        sys.exit(1)

    print("\nAll required entries verified in AndroidManifest.xml")


if __name__ == "__main__":
    patch_manifest()
    verify()
