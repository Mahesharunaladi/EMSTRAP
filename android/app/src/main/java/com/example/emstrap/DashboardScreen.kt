package com.example.emstrap

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

private val EmstrapNavy = Color(0xFF071A32)
private val EmstrapRed = Color(0xFFCF202E)

@Composable
fun EmstrapDashboard(
    viewModel: EmstrapViewModel = viewModel(),
    onOpenTracking: () -> Unit = {},
    onLogout: () -> Unit = {},
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED,
        )
    }
    var locationError by remember { mutableStateOf<String?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        hasLocationPermission = grants.values.any { it }
    }
    val cameraPositionState = rememberCameraPositionState()
    LaunchedEffect(state.userLocation) {
        state.userLocation?.let { cameraPositionState.animate(CameraUpdateFactory.newLatLngZoom(it, 15f)) }
    }

    fun requestEmergency() {
        if (!hasLocationPermission) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            return
        }
        try {
            locationError = null
            fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { location ->
                    if (location != null) viewModel.triggerSOS(LatLng(location.latitude, location.longitude))
                    else locationError = "Couldn't determine your location. Turn on GPS and try again."
                }
                .addOnFailureListener { locationError = "Couldn't get your location. Check GPS access and try again." }
        } catch (_: SecurityException) {
            hasLocationPermission = false
        }
    }

    Box(Modifier.fillMaxSize()) {
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
            properties = com.google.maps.android.compose.MapProperties(isMyLocationEnabled = hasLocationPermission),
            uiSettings = com.google.maps.android.compose.MapUiSettings(myLocationButtonEnabled = hasLocationPermission),
        ) {
            state.userLocation?.let { Marker(state = MarkerState(position = it), title = "Your location") }
            state.ambulance?.let {
                if (it.latitude.isFinite() && it.longitude.isFinite()) {
                    Marker(state = MarkerState(position = LatLng(it.latitude, it.longitude)), title = it.driverName, snippet = "Assigned responder")
                }
            }
        }

        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Surface(shape = RoundedCornerShape(18.dp), color = Color.White.copy(alpha = .97f)) {
                Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    EmstrapLogo(emblemWidth = 92.dp, wordmarkSize = 18.sp)
                    TextButton(onClick = onLogout) { Text("Sign out", color = EmstrapNavy) }
                }
            }

            Card(colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = .97f)), shape = RoundedCornerShape(24.dp)) {
                Column(Modifier.padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    when (state.status) {
                        EmergencyStatus.IDLE -> {
                            Text("Need emergency help?", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = EmstrapNavy)
                            Text("Share your location with nearby response teams.", style = MaterialTheme.typography.bodyMedium, color = EmstrapNavy.copy(alpha = .7f))
                            Spacer(Modifier.height(16.dp))
                            Button(
                                onClick = ::requestEmergency,
                                modifier = Modifier.fillMaxWidth().height(72.dp),
                                shape = RoundedCornerShape(18.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = EmstrapRed),
                            ) { Text("TAP FOR SOS", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black) }
                            if (!hasLocationPermission || locationError != null) {
                                Spacer(Modifier.height(10.dp))
                                Text(locationError ?: "Location access is needed to send your alert.", color = EmstrapNavy.copy(alpha = .65f), style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        EmergencyStatus.SEARCHING -> Text("Sending your emergency alert…", style = MaterialTheme.typography.titleMedium, color = EmstrapNavy)
                        EmergencyStatus.DISPATCHED, EmergencyStatus.ARRIVED, EmergencyStatus.ERROR -> {
                            Text(
                                when (state.status) {
                                    EmergencyStatus.ARRIVED -> "Responder arrived"
                                    EmergencyStatus.ERROR -> "Alert not sent"
                                    else -> "Emergency alert active"
                                },
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = if (state.status == EmergencyStatus.ERROR) EmstrapRed else EmstrapNavy,
                            )
                            Text(state.message.orEmpty(), modifier = Modifier.padding(top = 6.dp), color = EmstrapNavy.copy(alpha = .75f))
                            state.driverName?.let { Text("Driver: $it", modifier = Modifier.padding(top = 8.dp), fontWeight = FontWeight.SemiBold) }
                            if (state.status == EmergencyStatus.DISPATCHED) {
                                Button(onClick = onOpenTracking, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) { Text("View response details") }
                            }
                            if (state.status == EmergencyStatus.ERROR) {
                                Button(onClick = ::requestEmergency, modifier = Modifier.fillMaxWidth().padding(top = 12.dp), colors = ButtonDefaults.buttonColors(containerColor = EmstrapRed)) { Text("Try again") }
                            }
                        }
                    }
                }
            }
        }
    }
}
