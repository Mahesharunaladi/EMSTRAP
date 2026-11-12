import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.isFile }?.inputStream()?.use { load(it) }
}
val mapsApiKey = providers.gradleProperty("mapsApiKey").orElse(localProperties.getProperty("mapsApiKey").orEmpty()).get()
val backendBaseUrl = providers.gradleProperty("backendBaseUrl").orElse(localProperties.getProperty("backendBaseUrl").orEmpty()).get()

android {
    namespace = "com.example.emstrap"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    // Use the portal's logo file directly so Android and web stay visually identical.
    sourceSets.getByName("main").assets.srcDir("../../frontend/public")

    defaultConfig {
        applicationId = "com.example.emstrap"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        manifestPlaceholders["mapsApiKey"] = mapsApiKey
        buildConfigField("String", "BACKEND_BASE_URL", "\"${backendBaseUrl.ifBlank { "http://10.0.2.2:5001" }}\"")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("com.google.maps.android:maps-compose:4.4.1")
    implementation("com.google.android.gms:play-services-maps:19.0.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
    implementation("io.socket:socket.io-client:2.1.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
