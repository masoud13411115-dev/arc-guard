# ──────────────────────────────────────────────────────────────────────────────
# ARC Guard — ProGuard / R8 rules
# Applied for release builds (assembleManagerRelease, assembleGuardRelease).
# ──────────────────────────────────────────────────────────────────────────────

# ── Stack traces — keep file names and line numbers for crash reports ─────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor core — WebView bridge must not be renamed ──────────────────────
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.CapacitorPlugin <init>(...);
    @com.getcapacitor.PluginMethod *;
}
-dontwarn com.getcapacitor.**

# ── WebView JavaScript Interface ──────────────────────────────────────────────
# JS calls bridge methods by name — renaming breaks them
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# ── ARC Guard application classes ─────────────────────────────────────────────
-keep class com.arcguard.** { *; }
-keepclassmembers class com.arcguard.** { *; }

# ── Firebase / Google Play Services ───────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── AndroidX ──────────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keepclassmembers class androidx.** { *; }
-dontwarn androidx.**

# ── Kotlin ────────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ── Enums — required for correct valueOf() / values() behaviour ───────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Serializable ──────────────────────────────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── Parcelable ────────────────────────────────────────────────────────────────
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# ── OkHttp / Okio (used by some Capacitor plugins) ───────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# ── Suppress miscellaneous warnings from transitive dependencies ──────────────
-dontwarn com.squareup.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn javax.annotation.**
