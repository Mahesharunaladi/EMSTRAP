package com.example.emstrap

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.Color

@Composable
fun EmstrapLogo(
    modifier: Modifier = Modifier,
    emblemWidth: Dp = 180.dp,
    wordmarkSize: TextUnit = 32.sp,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Image(
            painter = painterResource(R.drawable.emstrap_siren),
            contentDescription = null,
            modifier = Modifier.width(emblemWidth).height(emblemWidth * 0.52f),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Em", color = Color(0xFF07539A), fontSize = wordmarkSize, fontWeight = FontWeight.Black, letterSpacing = (-1.5).sp)
            Spacer(Modifier.width(2.dp))
            Text("✚", color = Color(0xFFD80D16), fontSize = wordmarkSize * 0.82f, fontWeight = FontWeight.Black)
            Spacer(Modifier.width(1.dp))
            Text("STraP", color = Color(0xFF07539A), fontSize = wordmarkSize, fontWeight = FontWeight.Black, letterSpacing = (-1.5).sp)
        }
    }
}
