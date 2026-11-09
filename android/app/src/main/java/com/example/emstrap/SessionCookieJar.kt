package com.example.emstrap

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import org.json.JSONObject
import java.nio.ByteBuffer
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Keeps the backend's HttpOnly session cookie encrypted at rest for Retrofit and Socket.IO. */
object SessionCookieJar : CookieJar {
    private const val PREFS = "emstrap_session"
    private const val COOKIE_KEY = "auth_cookie"
    private const val KEY_ALIAS = "emstrap_session_key"
    private const val ANDROID_KEY_STORE = "AndroidKeyStore"
    private var preferences: android.content.SharedPreferences? = null
    private var sessionCookie: Cookie? = null

    @Synchronized
    fun initialize(context: Context) {
        if (preferences != null) return
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sessionCookie = preferences?.getString(COOKIE_KEY, null)?.let { encrypted ->
            runCatching { decodeCookie(decrypt(encrypted)) }.getOrNull()
        }
        if (sessionCookie == null) preferences?.edit()?.remove(COOKIE_KEY)?.apply()
    }

    @Synchronized
    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookie = sessionCookie ?: return emptyList()
        if (cookie.expiresAt() <= System.currentTimeMillis()) {
            clear()
            return emptyList()
        }
        return if (cookie.matches(url)) listOf(cookie) else emptyList()
    }

    @Synchronized
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val cookie = cookies.firstOrNull { it.name() == "token" } ?: return
        if (cookie.expiresAt() <= System.currentTimeMillis()) {
            clear()
            return
        }
        sessionCookie = cookie
        val serialized = JSONObject()
            .put("name", cookie.name())
            .put("value", cookie.value())
            .put("domain", cookie.domain())
            .put("hostOnly", cookie.hostOnly())
            .put("path", cookie.path())
            .put("expiresAt", cookie.expiresAt())
            .put("secure", cookie.secure())
            .put("httpOnly", cookie.httpOnly())
            .toString()
        runCatching { preferences?.edit()?.putString(COOKIE_KEY, encrypt(serialized))?.apply() }
    }

    @Synchronized
    fun cookieHeader(baseUrl: String): String? {
        val url = baseUrl.toHttpUrlOrNullCompat() ?: return null
        return loadForRequest(url).joinToString("; ") { "${it.name()}=${it.value()}" }.ifBlank { null }
    }

    @Synchronized
    fun clear() {
        sessionCookie = null
        preferences?.edit()?.remove(COOKIE_KEY)?.apply()
    }

    private fun decodeCookie(serialized: String): Cookie {
        val value = JSONObject(serialized)
        val builder = Cookie.Builder().name(value.getString("name")).value(value.getString("value"))
        if (value.optBoolean("hostOnly", false)) builder.hostOnlyDomain(value.getString("domain"))
        else builder.domain(value.getString("domain"))
        builder.path(value.optString("path", "/"))
            .expiresAt(value.getLong("expiresAt"))
        if (value.optBoolean("secure")) builder.secure()
        if (value.optBoolean("httpOnly")) builder.httpOnly()
        return builder.build()
    }

    private fun encrypt(plainText: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val payload = ByteBuffer.allocate(cipher.iv.size + encrypted.size).put(cipher.iv).put(encrypted).array()
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): String {
        val payload = Base64.decode(encoded, Base64.NO_WRAP)
        val buffer = ByteBuffer.wrap(payload)
        val iv = ByteArray(12).also { buffer.get(it) }
        val encrypted = ByteArray(buffer.remaining()).also { buffer.get(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
        return cipher.doFinal(encrypted).toString(Charsets.UTF_8)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun String.toHttpUrlOrNullCompat(): HttpUrl? = HttpUrl.parse(this)
}
