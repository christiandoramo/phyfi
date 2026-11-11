plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ug.phyfi_router"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ug.phyfi_router"
        minSdk = 28
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
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
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
    
    // Suporte a MediaSession para Foreground Service no One UI / Android 15
    implementation("androidx.media:media:1.7.0")

    // Rede e P2P
    implementation("io.github.webrtc-sdk:android:114.5735.02")
    implementation("org.java-websocket:Java-WebSocket:1.5.4")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Processamento de Sinal Digital (FFT)
    implementation("be.tarsos.dsp:core:2.5")
}