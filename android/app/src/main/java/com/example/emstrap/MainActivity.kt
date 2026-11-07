package com.example.emstrap

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(7, 26, 50)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFFCF202E), secondary = Color(0xFF07539A))) {
                EmstrapAppNavigation()
            }
        }
    }
}
