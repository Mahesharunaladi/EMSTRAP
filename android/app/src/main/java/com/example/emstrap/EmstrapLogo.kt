package com.example.emstrap

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun EmstrapLogo(
    modifier: Modifier = Modifier,
    emblemWidth: Dp = 180.dp,
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painter = painterResource(R.drawable.emstrap_logo),
            contentDescription = "EmSTraP",
            modifier = Modifier
                .width(emblemWidth)
                .aspectRatio(913f / 503f),
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun EmstrapLogoPreview() {
    EmstrapLogo()
}
