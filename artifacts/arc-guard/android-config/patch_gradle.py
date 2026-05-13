#!/usr/bin/env python3
"""
patch_gradle.py — Injects Android productFlavors into Capacitor-generated build.gradle.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_gradle.py

Strategy:
  Locates the `buildTypes { ... }` block inside android { } using brace-depth
  tracking, then inserts flavorDimensions + productFlavors immediately AFTER it
  (still inside the android { } block).  This is correct regardless of how many
  additional blocks (repositories, try/catch) appear later in the file.

  Also removes <string name="app_name"> from strings.xml so that each flavor's
  resValue "string", "app_name", "..." can supply it without aapt conflict.
"""

import re
import os
import sys

GRADLE_PATH  = "android/app/build.gradle"
STRINGS_PATH = "android/app/src/main/res/values/strings.xml"

FLAVORS_BLOCK = (
    "\n"
    "\n"
    "    flavorDimensions \"variant\"\n"
    "    productFlavors {\n"
    "        manager {\n"
    "            dimension \"variant\"\n"
    "            applicationId \"com.arcguard.manager\"\n"
    "            resValue \"string\", \"app_name\", \"ARC Guard Manager\"\n"
    "        }\n"
    "        guard {\n"
    "            dimension \"variant\"\n"
    "            applicationId \"com.arcguard.guard\"\n"
    "            resValue \"string\", \"app_name\", \"ARC Guard\"\n"
    "        }\n"
    "    }\n"
)


def find_block_end(text, search_from):
    """
    Starting at search_from, find the closing '}' that matches the first '{'
    encountered. Returns the index of that closing '}', or -1 if not found.
    """
    depth = 0
    i = search_from
    while i < len(text):
        ch = text[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def patch_build_gradle():
    if not os.path.exists(GRADLE_PATH):
        print("ERROR: {} not found — run cap add android first".format(GRADLE_PATH))
        sys.exit(1)

    with open(GRADLE_PATH) as f:
        content = f.read()

    if "productFlavors" in content:
        print("productFlavors already present in {} — skipping".format(GRADLE_PATH))
        return

    # ── Step 1: find the android { } block ───────────────────────────────────
    android_match = re.search(r"\bandroid\s*\{", content)
    if not android_match:
        print("ERROR: could not find 'android {' block in build.gradle")
        sys.exit(1)

    android_end = find_block_end(content, android_match.start())
    if android_end < 0:
        print("ERROR: could not find closing brace of android { } block")
        sys.exit(1)

    android_inner = content[android_match.end():android_end]   # text inside android {}

    # ── Step 2: find the buildTypes { } block inside android { } ─────────────
    bt_match = re.search(r"\bbuildTypes\s*\{", android_inner)
    if bt_match:
        # Absolute offset of buildTypes { in the full file
        bt_abs_start = android_match.end() + bt_match.start()
        bt_end = find_block_end(content, bt_abs_start)

        if bt_end < 0:
            print("WARNING: could not find end of buildTypes block; falling back to android block end")
            insert_at = android_end
        else:
            # Insert AFTER the buildTypes closing }
            insert_at = bt_end + 1
    else:
        # No buildTypes block found — insert just before android block closes
        print("WARNING: buildTypes block not found; inserting before android block end")
        insert_at = android_end

    new_content = content[:insert_at] + FLAVORS_BLOCK + content[insert_at:]

    with open(GRADLE_PATH, "w") as f:
        f.write(new_content)

    print("productFlavors injected after buildTypes block in {}".format(GRADLE_PATH))


def patch_strings_xml():
    if not os.path.exists(STRINGS_PATH):
        print("{} not found — skipping app_name removal".format(STRINGS_PATH))
        return

    with open(STRINGS_PATH) as f:
        xml = f.read()

    xml_new = re.sub(r"\s*<string name=\"app_name\">[^<]*</string>", "", xml)
    if xml_new == xml:
        print("app_name not in strings.xml — no patch needed")
        return

    with open(STRINGS_PATH, "w") as f:
        f.write(xml_new)
    print("app_name removed from strings.xml (each flavor supplies it via resValue)")


def show_result():
    if not os.path.exists(GRADLE_PATH):
        return
    with open(GRADLE_PATH) as f:
        patched = f.read()
    print("\n=== Patched {} ===".format(GRADLE_PATH))
    print(patched)
    if "productFlavors" in patched:
        print("\nVERIFY: 'productFlavors' present in build.gradle")
    else:
        print("\nERROR: 'productFlavors' NOT found after patching!")
        sys.exit(1)


if __name__ == "__main__":
    patch_build_gradle()
    patch_strings_xml()
    show_result()
    print("\nPatch complete. Build with:")
    print("  ./gradlew assembleManagerDebug  ->  com.arcguard.manager")
    print("  ./gradlew assembleGuardDebug    ->  com.arcguard.guard")
