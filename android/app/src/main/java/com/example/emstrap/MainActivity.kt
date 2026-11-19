package com.example.emstrap

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceError
import android.webkit.ConsoleMessage
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetMultipleContents()
    ) { uris: List<Uri> ->
        fileUploadCallback?.onReceiveValue(uris.toTypedArray())
        fileUploadCallback = null
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        // Permissions handled
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(247, 247, 245)

        checkAndRequestPermissions()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            setBackgroundColor(android.graphics.Color.rgb(247, 247, 245))
            WebView.setWebContentsDebuggingEnabled(true)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                setGeolocationEnabled(true)
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                cacheMode = WebSettings.LOAD_DEFAULT
                useWideViewPort = true
                loadWithOverviewMode = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                setSupportMultipleWindows(true)
                userAgentString = settings.userAgentString + " EmSTraP-App"
            }

            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)

            webViewClient = object : WebViewClient() {
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    Log.e("EmstrapWebView", "Load error: ${error?.description} for ${request?.url}")
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    Log.d("EmstrapWebView", "Page finished loading: $url")
                }
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return false
                    val url = uri.toString()

                    // Handle intent: scheme (Google Maps, apps, etc.)
                    if (url.startsWith("intent:")) {
                        try {
                            val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                            if (intent != null) {
                                try {
                                    startActivity(intent)
                                    return true
                                } catch (e: ActivityNotFoundException) {
                                    // Fallback to browser URL if available in intent
                                    val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                                    if (fallbackUrl != null) {
                                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl)))
                                        return true
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    // Handle Google Maps, tel:, mailto:, geo: links
                    if (url.contains("google.com/maps") || url.startsWith("geo:") || url.startsWith("tel:") || url.startsWith("mailto:")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, uri)
                            startActivity(intent)
                            return true
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }

                    // Keep normal in-app navigation within webview
                    return false
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    Log.d("EmstrapJS", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                    return true
                }
                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: android.os.Message?
                ): Boolean {
                    val hitTest = view?.hitTestResult
                    val extra = hitTest?.extra
                    if (!extra.isNullOrBlank()) {
                        // Open external popup / new window (like Google Maps) in external app/browser
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(extra))
                            startActivity(intent)
                            return true
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    return false
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    callback?.invoke(origin, true, false)
                }

                override fun onPermissionRequest(request: PermissionRequest?) {
                    runOnUiThread {
                        request?.grant(request.resources)
                    }
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback
                    filePickerLauncher.launch("image/*")
                    return true
                }
            }
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        val startUrl = if (BuildConfig.PORTAL_START_URL.isNotBlank()) BuildConfig.PORTAL_START_URL else "https://emstrap-user.onrender.com"
        webView.loadUrl(startUrl)
    }

    private fun checkAndRequestPermissions() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
