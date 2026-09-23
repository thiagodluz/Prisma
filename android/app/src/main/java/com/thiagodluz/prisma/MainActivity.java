package com.thiagodluz.prisma;

import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html?android=1";
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        TYPES.put("index.html", "text/html"); TYPES.put("style.css", "text/css");
        TYPES.put("app.js", "application/javascript"); TYPES.put("engine.js", "application/javascript");
        TYPES.put("zen.js", "application/javascript"); TYPES.put("sound.js", "application/javascript");
        TYPES.put("manifest.webmanifest", "application/manifest+json");
        TYPES.put("icon.svg", "image/svg+xml"); TYPES.put("icon-192.png", "image/png");
        TYPES.put("icon-512.png", "image/png"); TYPES.put("gem-atlas.webp", "image/webp");
        TYPES.put("burst-atlas.webp", "image/webp"); TYPES.put("cross-atlas.webp", "image/webp");
        TYPES.put("spectrum-gem.webp", "image/webp"); TYPES.put("prisma-bg.jpg", "image/jpeg");
    }
    private WebView webView;
    private boolean resumed;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(0xff101229);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost()) ||
                    !request.getUrl().getPath().startsWith("/assets/");
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!HOST.equals(request.getUrl().getHost())) return null;
                String path = request.getUrl().getPath();
                if (!path.startsWith("/assets/")) return null;
                String filename = path.substring("/assets/".length());
                String mime = TYPES.get(filename);
                if (mime == null) return null;
                try {
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(filename));
                } catch (IOException error) {
                    return null;
                }
            }
        });
        FrameLayout screen = new FrameLayout(this);
        screen.setBackgroundColor(0xff101229);
        screen.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        if (Build.VERSION.SDK_INT >= 35) {
            screen.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() |
                    WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(screen);
        webView.loadUrl(START);
    }

    @Override protected void onPause() {
        resumed = false;
        super.onPause();
        webView.evaluateJavascript("document.dispatchEvent(new Event('prisma:pause'))", ignored -> {
            if (!resumed && webView != null) webView.onPause();
        });
    }

    @Override protected void onResume() {
        super.onResume();
        resumed = true;
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("document.dispatchEvent(new Event('prisma:resume'))", null);
        }
    }

    @Override protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
