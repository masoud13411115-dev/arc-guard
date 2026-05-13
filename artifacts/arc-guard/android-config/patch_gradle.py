#!/usr/bin/env python3
"""
patch_gradle.py — Injects Android productFlavors into Capacitor-generated build.gradle.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_gradle.py

What it does:
  1. Adds flavorDimensions + productFlavors (manager / guard) to build.gradle
     so `./gradlew assembleManagerDebug` and `./gradlew assembleGuardDebug`
     produce two completely separate APKs with different applicationIds.
  2. Removes <string name="app_name"> from strings.xml so that each flavor's
     resValue "string", "app_name", "..." can supply it without a duplicate-
     resource conflict at aapt time.
"""

import re
import os
import sys

GRADLE_PATH  = "android/app/build.gradle"
STRINGS_PATH = "android/app/src/main/res/values/strings.xml"

FLAVORS_BLOCK = (
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


def patch_build_gradle():
    if not os.path.exists(GRADLE_PATH):
        print(f"ERROR: {GRADLE_PATH} not found — run cap add android first")
        sys.exit(1)

    with open(GRADLE_PATH) as f:
        content = f.read()

    if "productFlavors" in content:
        print(f"productFlavors already present in {GRADLE_PATH} — skipping")
        return

    # Insert the flavors block immediately before the very last "}" in the file.
    # In Capacitor-generated build.gradle the last line is the closing brace of
    # the android { } block, making this insertion point reliable.
    lines = content.splitlines(keepends=True)
    inserted = False
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == "}":
            lines.insert(i, FLAVORS_BLOCK)
            inserted = True
            break

    if not inserted:
        print("ERROR: could not find closing brace to insert productFlavors")
        sys.exit(1)

    with open(GRADLE_PATH, "w") as f:
        f.writelines(lines)
    print(f"productFlavors injected into {GRADLE_PATH}")


def patch_strings_xml():
    if not os.path.exists(STRINGS_PATH):
        print(f"{STRINGS_PATH} not found — skipping app_name removal")
        return

    with open(STRINGS_PATH) as f:
        xml = f.read()

    xml_new = re.sub(r"\s*<string name=\"app_name\">[^<]*</string>", "", xml)
    if xml_new == xml:
        print("app_name not in strings.xml — no patch needed")
        return

    with open(STRINGS_PATH, "w") as f:
        f.write(xml_new)
    print("app_name removed from strings.xml (each productFlavor supplies its own via resValue)")


def show_result():
    if not os.path.exists(GRADLE_PATH):
        return
    with open(GRADLE_PATH) as f:
        print("\n=== Patched build.gradle ===")
        print(f.read())


if __name__ == "__main__":
    patch_build_gradle()
    patch_strings_xml()
    show_result()
    print("\nPatch complete. Build with:")
    print("  ./gradlew assembleManagerDebug   -> com.arcguard.manager")
    print("  ./gradlew assembleGuardDebug     -> com.arcguard.guard")
