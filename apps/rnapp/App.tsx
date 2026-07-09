import * as Contacts from "expo-contacts";
// SDK 54 moved the classic file API (writeAsStringAsync/cacheDirectory/EncodingType) to /legacy.
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

// SPEC §9: thin WebView shell + native bridge. No product logic lives here.
const WEBAPP_URL = process.env.EXPO_PUBLIC_WEBAPP_URL ?? "http://localhost:3000";
const ACCENT = "#2563eb";

// App-lock is OPT-IN. We persist the user's choice so it isn't asked on every
// launch. documentDirectory survives app restarts (cacheDirectory may be purged).
const PREF_DIR = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";
const PREF_FILE = PREF_DIR + "applock.json";

async function readLockPref(): Promise<boolean | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(PREF_FILE);
    const parsed = JSON.parse(raw) as { enabled?: unknown };
    return typeof parsed?.enabled === "boolean" ? parsed.enabled : null;
  } catch {
    return null; // file missing/unreadable => preference not chosen yet
  }
}

async function writeLockPref(enabled: boolean): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(PREF_FILE, JSON.stringify({ enabled }));
  } catch {
    // best-effort; ignore write failures
  }
}

// Remembered Android "downloads" folder (a Storage Access Framework tree URI the
// user grants once). Persisted so reports save silently on every later download.
const SAVE_DIR_FILE = PREF_DIR + "savedir.json";

async function readSaveDir(): Promise<string | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(SAVE_DIR_FILE);
    const parsed = JSON.parse(raw) as { uri?: unknown };
    return typeof parsed?.uri === "string" ? parsed.uri : null;
  } catch {
    return null;
  }
}

async function writeSaveDir(uri: string): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(SAVE_DIR_FILE, JSON.stringify({ uri }));
  } catch {
    // best-effort
  }
}

/**
 * Android only: actually SAVE the bytes into a folder the user picks once (e.g.
 * Downloads) via the Storage Access Framework, so reports land as real files
 * instead of only opening a share sheet. Returns false if the user declined the
 * folder prompt (the caller then falls back to sharing).
 */
async function saveToFolder(filename: string, mimeType: string, base64: string): Promise<boolean> {
  const SAF = FileSystem.StorageAccessFramework;
  try {
    let dir = await readSaveDir();
    // The remembered grant can be revoked by Android — re-validate, re-ask if gone.
    if (dir) {
      try {
        await SAF.readDirectoryAsync(dir);
      } catch {
        dir = null;
      }
    }
    if (!dir) {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return false;
      dir = perm.directoryUri;
      await writeSaveDir(dir);
    }
    // Pass the name without its extension — SAF derives it from the mimeType, so
    // "summary.pdf" + application/pdf would otherwise become "summary.pdf.pdf".
    const dot = filename.lastIndexOf(".");
    const baseName = dot > 0 ? filename.slice(0, dot) : filename;
    const fileUri = await SAF.createFileAsync(dir, baseName, mimeType);
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  } catch {
    return false; // any SAF failure → let the caller fall back to share
  }
}

type BridgeRequest = {
  type: string;
  requestId: string;
  payload?: {
    text?: string;
    filename?: string;
    mimeType?: string;
    base64?: string;
    enabled?: boolean;
    source?: "camera" | "library";
  };
};

// Open the native camera or gallery and return the picked image as base64 so the
// webapp can upload it. Returns null on cancel or denied permission.
async function pickImageNative(
  source: "camera" | "library",
): Promise<{ base64: string; mimeType: string; filename: string } | null> {
  const perm =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    base64: true,
    quality: 0.6, // keep uploads small — bills are readable well below full-res
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.base64) return null;
  return {
    base64: asset.base64,
    mimeType: asset.mimeType ?? "image/jpeg",
    filename: asset.fileName ?? "bill.jpg",
  };
}

// loading -> deciding what to show; ask -> first-run opt-in; locked -> awaiting
// biometric; open -> WebView is live.
type Gate = "loading" | "ask" | "locked" | "open";

export default function App() {
  const webRef = useRef<WebView>(null);
  const [gate, setGate] = useState<Gate>("loading");
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState(false);

  // Prompt the device biometric/credential. Unlocks on success, else stays locked.
  const authenticate = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Khatabook" });
    setGate(result.success ? "open" : "locked");
  }, []);

  // Decide the initial gate from the saved preference + device capability.
  const init = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    // No fingerprint/face/screen-lock on the phone => nothing to lock with.
    if (!hasHardware || !enrolled) {
      setGate("open");
      return;
    }
    const pref = await readLockPref();
    if (pref === null) {
      setGate("ask"); // first launch: let the user choose
    } else if (pref === true) {
      setGate("locked");
      authenticate();
    } else {
      setGate("open"); // user previously declined
    }
  }, [authenticate]);

  useEffect(() => {
    init();
  }, [init]);

  const enableLock = useCallback(async () => {
    await writeLockPref(true);
    setGate("locked");
    authenticate();
  }, [authenticate]);

  const skipLock = useCallback(async () => {
    await writeLockPref(false);
    setGate("open");
  }, []);

  // Android hardware back -> WebView goBack when possible.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const respond = useCallback((requestId: string, result: unknown, errorMsg?: string) => {
    const payload = JSON.stringify({ requestId, result, error: errorMsg });
    webRef.current?.injectJavaScript(
      `window.__khatabookBridgeResponse && window.__khatabookBridgeResponse(${payload}); true;`,
    );
  }, []);

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: BridgeRequest;
      try {
        msg = JSON.parse(event.nativeEvent.data) as BridgeRequest;
      } catch {
        return;
      }
      const { type, requestId, payload } = msg;
      try {
        switch (type) {
          case "share":
            await Share.share({ message: payload?.text ?? "" });
            respond(requestId, true);
            break;
          case "pickContact": {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== "granted") return respond(requestId, null);
            const contact = await Contacts.presentContactPickerAsync();
            if (!contact) return respond(requestId, null);
            respond(requestId, {
              name: contact.name ?? "",
              phone: contact.phoneNumbers?.[0]?.number ?? "",
            });
            break;
          }
          case "biometricUnlock": {
            const r = await LocalAuthentication.authenticateAsync();
            respond(requestId, r.success);
            break;
          }
          case "pickImage": {
            const source = payload?.source === "library" ? "library" : "camera";
            respond(requestId, await pickImageNative(source));
            break;
          }
          // App-lock preference toggled from the webapp Settings page.
          case "setAppLock": {
            await writeLockPref(!!payload?.enabled);
            respond(requestId, true);
            break;
          }
          case "getAppLock": {
            respond(requestId, await readLockPref());
            break;
          }
          case "saveFile": {
            const { filename, mimeType, base64 } = payload ?? {};
            if (!filename || !base64) return respond(requestId, null, "missing file data");
            const type = mimeType ?? "application/octet-stream";

            // Android: save straight into the user's chosen folder (a real
            // download). Only fall back to the share sheet if they decline.
            if (Platform.OS === "android" && (await saveToFolder(filename, type, base64))) {
              return respond(requestId, true);
            }

            // iOS (or Android fallback): write to cache + open the share sheet,
            // which includes "Save to Files".
            const uri = (FileSystem.cacheDirectory ?? "") + filename;
            await FileSystem.writeAsStringAsync(uri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, {
                mimeType: type,
                UTI: type === "application/pdf" ? "com.adobe.pdf" : undefined,
              });
            }
            respond(requestId, true);
            break;
          }
          case "getPushToken":
            respond(requestId, null); // optional; not wired in this phase
            break;
          default:
            respond(requestId, null, `unknown bridge type: ${type}`);
        }
      } catch (e) {
        respond(requestId, null, String(e));
      }
    },
    [respond],
  );

  if (gate === "loading") {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaProvider>
    );
  }

  // First launch: ask whether to turn on the biometric app lock.
  if (gate === "ask") {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.title}>Protect Khatabook?</Text>
          <Text style={styles.muted}>
            Require your fingerprint, face, or screen lock every time you open the app. You can
            change this later in Settings.
          </Text>
          <TouchableOpacity style={styles.button} onPress={enableLock}>
            <Text style={styles.buttonText}>Enable app lock</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonGhost} onPress={skipLock}>
            <Text style={styles.buttonGhostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  if (gate === "locked") {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.title}>Khatabook</Text>
          <Text style={styles.muted}>Locked</Text>
          <TouchableOpacity style={styles.button} onPress={authenticate}>
            <Text style={styles.buttonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  if (error) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <Text style={styles.title}>Can&apos;t reach the app</Text>
          <Text style={styles.muted}>Check your connection.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setError(false);
              webRef.current?.reload();
            }}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Blue status-bar area blends into the webapp's header; insets keep the
          WebView clear of the notch/status bar and the bottom gesture area. */}
      <StatusBar style="light" backgroundColor={ACCENT} />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <WebView
          ref={webRef}
          source={{ uri: WEBAPP_URL }}
          onMessage={onMessage}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          onError={() => setError(true)}
          onHttpError={() => setError(true)}
          pullToRefreshEnabled
          startInLoadingState
          // --- Durable web storage + robustness (the session/localStorage lives here) ---
          javaScriptEnabled
          domStorageEnabled // persist localStorage (kb_access/kb_refresh) across restarts
          cacheEnabled
          thirdPartyCookiesEnabled // Android: keep cookies if the webapp ever uses them
          sharedCookiesEnabled // iOS: same
          allowFileAccess
          allowsInlineMediaPlayback
          // target=_blank / window.open would silently no-op with multiple windows on;
          // keep it single-window so external links load in place instead of vanishing.
          setSupportMultipleWindows={false}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
            </View>
          )}
          style={styles.webview}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ACCENT },
  webview: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: "700" },
  muted: { color: "#888", textAlign: "center" },
  button: { backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonGhost: { paddingHorizontal: 24, paddingVertical: 10 },
  buttonGhostText: { color: "#888", fontWeight: "600" },
});
