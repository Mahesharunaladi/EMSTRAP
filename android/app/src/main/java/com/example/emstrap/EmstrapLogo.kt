package com.example.emstrap

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun EmstrapLogo(
    modifier: Modifier = Modifier,
    emblemWidth: Dp = 180.dp,
    wordmarkSize: TextUnit = 32.sp,
) {
    val blue = Color(0xFF07539A)
    val wordmarkWeight = FontWeight.Black
    val crossSize = with(LocalDensity.current) { (wordmarkSize * 0.58f).toDp() }

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Image(
            painter = painterResource(R.drawable.emstrap_siren),
            contentDescription = null,
            modifier = Modifier.width(emblemWidth).height(emblemWidth * 0.74f),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("E", color = blue, fontSize = wordmarkSize, fontWeight = wordmarkWeight, letterSpacing = (-1.5).sp)
            Box(contentAlignment = Alignment.Center) {
                Text("m", color = blue, fontSize = wordmarkSize * 1.12f, fontWeight = wordmarkWeight, letterSpacing = (-1.5).sp)
                EmstrapCross(Modifier.size(crossSize))
            }
            Text("STraP", color = blue, fontSize = wordmarkSize, fontWeight = wordmarkWeight, letterSpacing = (-1.5).sp)
        }
    }
}

@Composable
private fun EmstrapCross(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        fun crossPath(inset: Float): Path {
            val unitX = w / 100f
            val unitY = h / 100f
            val start = inset
            val end = 100f - inset
            val armStart = 32f
            val armEnd = 68f
            return Path().apply {
                moveTo(start * unitX, armStart * unitY)
                lineTo(armStart * unitX, armStart * unitY)
                lineTo(armStart * unitX, start * unitY)
                lineTo(armEnd * unitX, start * unitY)
                lineTo(armEnd * unitX, armStart * unitY)
                lineTo(end * unitX, armStart * unitY)
                lineTo(end * unitX, armEnd * unitY)
                lineTo(armEnd * unitX, armEnd * unitY)
                lineTo(armEnd * unitX, end * unitY)
                lineTo(armStart * unitX, end * unitY)
                lineTo(armStart * unitX, armEnd * unitY)
                lineTo(start * unitX, armEnd * unitY)
                close()
            }
        }

        drawPath(crossPath(0f), Color(0xFF8D1116))
        drawPath(crossPath(3.5f), Color(0xFFD80D16))

        val whiteCross = Path().apply {
            moveTo(w * 0.38f, h * 0.12f)
            lineTo(w * 0.62f, h * 0.12f)
            lineTo(w * 0.62f, h * 0.38f)
            lineTo(w * 0.88f, h * 0.38f)
            lineTo(w * 0.88f, h * 0.62f)
            lineTo(w * 0.62f, h * 0.62f)
            lineTo(w * 0.62f, h * 0.88f)
            lineTo(w * 0.38f, h * 0.88f)
            lineTo(w * 0.38f, h * 0.62f)
            lineTo(w * 0.12f, h * 0.62f)
            lineTo(w * 0.12f, h * 0.38f)
            lineTo(w * 0.38f, h * 0.38f)
            close()
        }
        drawPath(whiteCross, Color.White)
        drawPath(crossPath(0f), Color(0xFF8D1116), style = Stroke(width = 1.5.dp.toPx()))
    }
}
