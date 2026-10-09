package com.thiagodluz.prisma;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AudioPlaybackTest {
    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView web = findWebView(group.getChildAt(i));
                if (web != null) return web;
            }
        }
        return null;
    }

    private String evaluate(WebView web, String script) throws Exception {
        CountDownLatch complete = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
            web.evaluateJavascript(script, value -> { result.set(value); complete.countDown(); }));
        assertTrue("JavaScript callback timed out", complete.await(10, TimeUnit.SECONDS));
        return String.valueOf(new JSONTokener(result.get()).nextValue());
    }

    private void awaitResult(WebView web, String script, String expected) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
        String actual;
        do {
            actual = evaluate(web, script);
            if (expected.equals(actual)) return;
            if (actual.startsWith("error:")) fail(actual);
            Thread.sleep(100);
        } while (System.nanoTime() < deadline);
        assertEquals(expected, actual);
    }

    @Test public void allBundledRecordingsDecodeAndPlayInsideTheRealWebView() throws Exception {
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<WebView> holder = new AtomicReference<>();
            activity.onActivity(a -> holder.set(findWebView(a.getWindow().getDecorView())));
            WebView web = holder.get();
            assertNotNull(web);
            awaitResult(web, "document.querySelectorAll('#board > *').length === 64 ? 'ready' : 'loading'", "ready");
            assertEquals("3", evaluate(web, "document.querySelector('#zen-track').options.length"));
            assertEquals("6", evaluate(web, "document.querySelector('#zen-soundscape').options.length"));
            String[] paths = {"audio/music/magic-puzzle.ogg", "audio/music/cozy-puzzle.ogg",
                "audio/music/space-city.ogg", "audio/ambience/stream.mp3", "audio/ambience/rain-soft.ogg",
                "audio/ambience/forest-cicadas.ogg", "audio/ambience/rainforest.mp3", "audio/ambience/rain-thunder.ogg", "audio/ambience/soft-noise.ogg"};
            for (String path : paths) {
                // Probe the real asset-origin route and platform decoder, not a mocked Audio.
                evaluate(web, "(() => { window.__audioProbe = 'loading'; " +
                    "const a = new Audio(" + JSONObject.quote(path) + "); a.muted = true; a.loop = true; " +
                    "a.onerror = () => { window.__audioProbe = 'error:' + (a.error?.message || a.error?.code); }; " +
                    "a.ontimeupdate = () => { if (a.currentTime > .1) { window.__audioProbe = 'playing'; " +
                    "a.pause(); a.removeAttribute('src'); a.load(); } }; " +
                    "a.play().catch(e => { window.__audioProbe = 'error:' + e.name + ':' + e.message; }); " +
                    "return 'started'; })()");
                awaitResult(web, "window.__audioProbe", "playing");
            }
        }
    }
}
