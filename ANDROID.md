# System Builder Android

This branch packages the existing System Builder React application as an Android app with Capacitor.

## Data

The Android edition intentionally keeps the existing Firebase/Firestore data layer so it uses the same System Builder data as the web edition when online. Existing IndexedDB/offline caching remains part of the React application.

## Build locally

1. Install project dependencies.
2. Run `bun run build:web`.
3. Run `bunx cap add android` once if the Android project is not present.
4. Run `bunx cap sync android`.
5. From the `android` directory run `./gradlew assembleDebug` (use `gradlew.bat assembleDebug` on Windows).

The debug APK is produced under `android/app/build/outputs/apk/debug/`.

GitHub Actions also builds and uploads `System-Builder-Android.apk` from this branch.
