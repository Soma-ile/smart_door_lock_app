# Building Smart Door Lock App for Android

## Prerequisites

### 1. Install Android Studio
- Download from: https://developer.android.com/studio
- Install with default settings
- Make sure Android SDK is installed

### 2. Set Environment Variables
Add these to your system environment variables:
```
ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

### 3. Install Required SDK Components
Open Android Studio → SDK Manager → Install:
- Android SDK Platform 34 (API Level 34)
- Android SDK Build-Tools 34.0.0
- Android SDK Command-line Tools

## Method 1: Direct Compilation (Easiest)

### Step 1: Update local.properties
Edit `android/local.properties` and set the correct SDK path:
```properties
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

### Step 2: Build the APK
```bash
# In the project root directory
npx expo run:android
```

Or build a release APK:
```bash
cd android
./gradlew assembleRelease
```

The APK will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`

## Method 2: Using Android Studio

### Step 1: Open Project in Android Studio
1. Open Android Studio
2. Click "Open an Existing Project"
3. Navigate to: `smart_door_lock_app/android`
4. Select the `android` folder and click OK

### Step 2: Sync Project
- Android Studio will automatically sync Gradle
- If prompted, install any missing SDK components
- Wait for sync to complete

### Step 3: Build APK
1. In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
2. Or use menu: Build → Generate Signed Bundle / APK
3. APK will be in: `app/build/outputs/apk/debug/`

## Method 3: EAS Build (Cloud Build)

### Step 1: Install EAS CLI
```bash
npm install -g @expo/eas-cli
```

### Step 2: Configure EAS
```bash
eas login
eas build:configure
```

### Step 3: Build APK
```bash
# Build for Android
eas build --platform android

# Build for both platforms
eas build --platform all
```

## Troubleshooting

### Common Issues:

1. **SDK not found error:**
   - Make sure `android/local.properties` has correct SDK path
   - Verify ANDROID_HOME environment variable

2. **Gradle sync failed:**
   - Update Gradle version in `android/gradle/wrapper/gradle-wrapper.properties`
   - Update Android Gradle Plugin in `android/build.gradle`

3. **Missing dependencies:**
   ```bash
   npx expo install --fix
   ```

4. **Build fails:**
   - Clean build: `cd android && ./gradlew clean`
   - Try: `npx expo run:android --clear`

### App Permissions

The app requires these permissions (already configured):
- CAMERA (for face recognition)
- INTERNET (for WebSocket connection)
- ACCESS_NETWORK_STATE (for network status)

## Testing the APK

### Install on Device:
1. Enable Developer Options on Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run: `adb install app-release.apk`

### Install via File Transfer:
1. Copy APK to device storage
2. Use file manager to open APK
3. Allow installation from unknown sources if prompted

## Release Notes

- App Name: Project Zephyrus (Smart Door Lock)
- Package: com.anonymous.projectzephyrus
- Minimum Android Version: API 21 (Android 5.0)
- Target Android Version: API 34 (Android 14)

## Features Included in APK

✅ Face Recognition Interface
✅ User Management
✅ Door Control
✅ Access History
✅ Real-time Camera Feed
✅ WebSocket Connection to Raspberry Pi
✅ Settings and Configuration
✅ Cross-platform UI Components

The compiled APK will be a fully functional Android app that can connect to your Raspberry Pi backend for smart door lock control.
