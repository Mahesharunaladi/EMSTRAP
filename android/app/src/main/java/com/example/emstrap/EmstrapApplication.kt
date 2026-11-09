package com.example.emstrap

import android.app.Application

class EmstrapApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        SessionCookieJar.initialize(this)
    }
}
