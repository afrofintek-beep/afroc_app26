# Camera Permissions Setup for AFRO ID Mobile App

## Overview
The AFRO ID app uses Capacitor Camera plugin to capture witness ID photos for offline validation.

## iOS Setup (Info.plist)

After running `npx cap add ios`, you need to add camera permissions to your iOS project.

**Location:** `ios/App/App/Info.plist`

Add these entries:

```xml
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to capture photos of witness ID documents for identity verification.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to select witness ID photos for identity verification.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>We need permission to save ID photos to your photo library.</string>
```

## Android Setup (AndroidManifest.xml)

After running `npx cap add android`, permissions are automatically added, but verify these exist.

**Location:** `android/app/src/main/AndroidManifest.xml`

These permissions should be present:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
```

Also ensure the camera feature is declared:

```xml
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

## Testing Camera Permissions

### On Real Device:
1. Build and run the app: `npx cap run ios` or `npx cap run android`
2. Navigate to offline witness capture
3. Select "Photo ID (Offline)" validation method
4. Tap "Take Photo" or "Choose from Gallery"
5. App will request permission on first use
6. Grant camera/photos permission
7. Capture or select witness ID photo

### Permission Flow:
- **First time**: App requests permission via native dialog
- **Granted**: Camera opens immediately
- **Denied**: User sees error toast, must manually enable in settings
- **Subsequent uses**: Permission already granted, camera opens directly

## Troubleshooting

### iOS Issues:
- **"Permission Denied"**: Check Info.plist has all 3 NSUsage keys
- **Camera not opening**: Reset iOS simulator: Device → Erase All Content and Settings
- **Permission dialog not showing**: Delete app and reinstall

### Android Issues:
- **"Camera permission denied"**: Check AndroidManifest.xml has camera permission
- **Gallery not accessible**: Verify READ_MEDIA_IMAGES permission (Android 13+)
- **Permission dialog not showing**: Clear app data: Settings → Apps → AFRO ID → Storage → Clear Data

### General Issues:
- Run `npx cap sync` after adding permissions
- Clean and rebuild project
- Check device settings to ensure permissions aren't permanently denied

## Features Implemented

✅ **Take Photo**: Opens device camera to capture new photo
✅ **Choose from Gallery**: Select existing photo from device
✅ **Permission Handling**: Automatic permission request and validation
✅ **Image Preview**: Shows captured photo before adding witness
✅ **Delete/Retake**: Remove photo and capture again if needed
✅ **Offline Storage**: Photos stored as base64 in IndexedDB
✅ **Auto-sync**: Photos uploaded with record when online

## Photo Quality Settings

Current configuration:
- **Quality**: 80% (balance between size and clarity)
- **Max Width**: 1920px (prevents huge file sizes)
- **Format**: JPEG (smaller than PNG)
- **Orientation**: Auto-corrected
- **Save to Gallery**: Disabled (privacy)

## Data Storage

Photos are stored as:
```typescript
photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Base64 data URI
```

Typical sizes:
- ID card photo: 200-500 KB
- Full document: 500-1500 KB
- Compressed for efficient offline storage

## Next Steps After Setup

After adding camera permissions and running `npx cap sync`:

1. Test on physical device (emulators may have limited camera access)
2. Verify permission prompts appear correctly
3. Capture test photos and verify they display properly
4. Test offline sync with captured photos
5. Confirm photos are synced to Supabase when back online
