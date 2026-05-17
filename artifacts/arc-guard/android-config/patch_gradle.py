#!/usr/bin/env python3
"""
patch_gradle.py — Injects Android productFlavors + release signingConfig
                  into Capacitor-generated build.gradle.

Run from artifacts/arc-guard/ after `npx cap add android` + `npx cap sync android`:
    python3 android-config/patch_gradle.py

What this script does
─────────────────────
1. Injects a `signingConfigs { release { ... } }` block that reads the
   keystore path/password from environment variables set in CI:
     KEYSTORE_FILE   — path to the .jks/.keystore file
     KEYSTORE_PASS   — keystore + key password (same for simplicity)
     KEY_ALIAS       — key alias (default: "arcguard")

2. Replaces the stub `release { }` buildType with one that:
   • enables minification (R8 / ProGuard)
   • references proguard-android-optimize.txt
   • wires up the release signingConfig (only when KEYSTORE_FILE is set)

3. Injects `flavorDimensions + productFlavors` for Manager / Guard variants
   AFTER the buildTypes block (unchanged from before).

4. Removes <string name="app_name"> from strings.xml so each flavor can
   supply it via resValue without aapt conflict.
"""

import re
import os
import sys

GRADLE_PATH  = "android/app/build.gradle"
STRINGS_PATH = "android/app/src/main/res/values/strings.xml"

# ── Signing config injected BEFORE buildTypes ──────────────────────────────
SIGNING_CONFIG_BLOCK = (
    "\n"
    "    signingConfigs {\n"
    "        release {\n"
    "            def ksPath = System.getenv(\"KEYSTORE_FILE\")\n"
    "            storeFile ksPath ? file(ksPath) : null\n"
    "            storePassword System.getenv(\"KEYSTORE_PASS\") ?: \"\"\n"
    "            keyAlias System.getenv(\"KEY_ALIAS\") ?: \"arcguard\"\n"
    "            keyPassword System.getenv(\"KEYSTORE_PASS\") ?: \"\"\n"
    "        }\n"
    "    }\n"
)

# ── Replacement release buildType (replaces the stub from cap add) ─────────
RELEASE_BUILD_TYPE_REPLACEMENT = (
    "        release {\n"
    "            minifyEnabled true\n"
    "            shrinkResources false\n"
    "            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n"
    "            def ksPath = System.getenv(\"KEYSTORE_FILE\")\n"
    "            signingConfig ksPath ? signingConfigs.release : null\n"
    "        }"
)

# ── productFlavors injected AFTER buildTypes ───────────────────────────────
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


def patch_signing_config(content):
    """
    Inject signingConfigs block immediately BEFORE the buildTypes block
    (but still inside android { }).
    Skip if already present.
    """
    if "signingConfigs" in content:
        print("signingConfigs already present — skipping injection")
        return content

    android_match = re.search(r"\bandroid\s*\{", content)
    if not android_match:
        print("ERROR: could not find 'android {' block")
        sys.exit(1)

    android_end = find_block_end(content, android_match.start())
    android_inner = content[android_match.end():android_end]

    bt_match = re.search(r"\bbuildTypes\s*\{", android_inner)
    if not bt_match:
        print("WARNING: buildTypes block not found — inserting signingConfigs before android block end")
        insert_at = android_end
    else:
        # Absolute offset of 'buildTypes' keyword in the full file
        bt_abs = android_match.end() + bt_match.start()
        insert_at = bt_abs

    new_content = content[:insert_at] + SIGNING_CONFIG_BLOCK + content[insert_at:]
    print("signingConfigs block injected before buildTypes in {}".format(GRADLE_PATH))
    return new_content


def patch_release_build_type(content):
    """
    Replace the stub `release { minifyEnabled false ... }` buildType with
    the hardened version that enables minification and wires signingConfig.
    Searches only inside the buildTypes block to avoid matching the signingConfigs
    release block that was just injected above it.
    Skip if already patched.
    """
    if "signingConfig ksPath ?" in content:
        print("release buildType already patched — skipping")
        return content

    # Scope search to inside the buildTypes { } block only
    bt_match = re.search(r"\bbuildTypes\s*\{", content)
    if not bt_match:
        print("WARNING: buildTypes block not found — skipping release patch")
        return content

    bt_end = find_block_end(content, bt_match.start())
    if bt_end < 0:
        print("WARNING: could not find end of buildTypes block — skipping")
        return content

    bt_inner_start = bt_match.end()
    bt_inner = content[bt_inner_start:bt_end]

    rel_match = re.search(r"\brelease\s*\{", bt_inner)
    if not rel_match:
        print("WARNING: release buildType not found inside buildTypes — skipping patch")
        return content

    # Compute absolute offset in the full file
    rel_abs_start = bt_inner_start + rel_match.start()
    rel_end = find_block_end(content, rel_abs_start)
    if rel_end < 0:
        print("WARNING: could not find end of release block — skipping")
        return content

    old_block = content[rel_abs_start:rel_end + 1]
    new_content = content.replace(old_block, RELEASE_BUILD_TYPE_REPLACEMENT, 1)
    print("release buildType patched (minifyEnabled=true, signingConfig wired)")
    return new_content


def patch_product_flavors(content):
    """
    Inject flavorDimensions + productFlavors AFTER the buildTypes block.
    Skip if already present.
    """
    if "productFlavors" in content:
        print("productFlavors already present — skipping")
        return content

    android_match = re.search(r"\bandroid\s*\{", content)
    if not android_match:
        print("ERROR: could not find 'android {' block")
        sys.exit(1)

    android_end = find_block_end(content, android_match.start())
    android_inner = content[android_match.end():android_end]

    bt_match = re.search(r"\bbuildTypes\s*\{", android_inner)
    if bt_match:
        bt_abs_start = android_match.end() + bt_match.start()
        bt_end = find_block_end(content, bt_abs_start)
        insert_at = bt_end + 1 if bt_end >= 0 else android_end
    else:
        print("WARNING: buildTypes not found; inserting flavors before android block end")
        insert_at = android_end

    new_content = content[:insert_at] + FLAVORS_BLOCK + content[insert_at:]
    print("productFlavors injected after buildTypes in {}".format(GRADLE_PATH))
    return new_content


def patch_build_gradle():
    if not os.path.exists(GRADLE_PATH):
        print("ERROR: {} not found — run 'npx cap add android' first".format(GRADLE_PATH))
        sys.exit(1)

    with open(GRADLE_PATH) as f:
        content = f.read()

    content = patch_signing_config(content)
    content = patch_release_build_type(content)
    content = patch_product_flavors(content)

    with open(GRADLE_PATH, "w") as f:
        f.write(content)


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

    checks = {
        "signingConfigs":   "signingConfigs" in patched,
        "productFlavors":   "productFlavors" in patched,
        "minifyEnabled true": "minifyEnabled true" in patched,
    }
    all_ok = True
    for label, ok in checks.items():
        print("  {} {}".format("OK  " if ok else "MISS", label))
        if not ok:
            all_ok = False

    if not all_ok:
        print("\nERROR: patch verification failed!")
        sys.exit(1)

    print("\nPatch complete. Build with:")
    print("  ./gradlew assembleManagerDebug    ->  com.arcguard.manager (debug)")
    print("  ./gradlew assembleGuardDebug      ->  com.arcguard.guard   (debug)")
    print("  ./gradlew assembleManagerRelease  ->  com.arcguard.manager (release, signed if KEYSTORE_FILE set)")
    print("  ./gradlew assembleGuardRelease    ->  com.arcguard.guard   (release, signed if KEYSTORE_FILE set)")


def copy_proguard_rules():
    """
    Copy android-config/proguard-rules.pro → android/app/proguard-rules.pro
    so the custom keep rules are available to the R8/ProGuard release build.
    Capacitor creates a minimal proguard-rules.pro on 'cap add android';
    we overwrite it with our hardened version.
    """
    import shutil
    src = "android-config/proguard-rules.pro"
    dst = "android/app/proguard-rules.pro"
    if not os.path.exists(src):
        print("android-config/proguard-rules.pro not found — skipping copy")
        return
    shutil.copy(src, dst)
    print("proguard-rules.pro copied from android-config/ to android/app/")


if __name__ == "__main__":
    copy_proguard_rules()
    patch_build_gradle()
    patch_strings_xml()
    show_result()
