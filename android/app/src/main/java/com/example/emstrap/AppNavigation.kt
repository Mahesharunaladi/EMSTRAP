package com.example.emstrap

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

private object EmstrapRoute {
    const val Dashboard = "dashboard"
    const val Tracking = "tracking"
}

@Composable
fun EmstrapAppNavigation() {
    val navController = rememberNavController()
    val emergencyViewModel: EmstrapViewModel = viewModel()
    val authViewModel: AuthViewModel = viewModel()
    val authState by authViewModel.state.collectAsState()

    when (authState.stage) {
        AuthStage.LOADING -> Surface(modifier = Modifier.fillMaxSize()) {
            Box(contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        }
        AuthStage.SIGN_IN, AuthStage.REGISTER, AuthStage.VERIFY -> AuthScreen(authViewModel)
        AuthStage.AUTHENTICATED -> NavHost(navController = navController, startDestination = EmstrapRoute.Dashboard) {
            composable(EmstrapRoute.Dashboard) {
                EmstrapDashboard(
                    viewModel = emergencyViewModel,
                    onLogout = {
                        emergencyViewModel.endSession()
                        authViewModel.logout()
                    },
                    onOpenTracking = { navController.navigate(EmstrapRoute.Tracking) },
                )
            }
            composable(EmstrapRoute.Tracking) {
                EmergencyTrackingScreen(viewModel = emergencyViewModel, onBack = { navController.popBackStack() })
            }
        }
    }
}

@Composable
private fun EmergencyTrackingScreen(viewModel: EmstrapViewModel, onBack: () -> Unit) {
    val state by viewModel.uiState.collectAsState()
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Emergency tracking", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(state.message ?: "Your alert status will appear here.", style = MaterialTheme.typography.bodyLarge)
        state.driverName?.let {
            Spacer(Modifier.height(12.dp))
            Text("Assigned responder: $it", style = MaterialTheme.typography.titleMedium)
        }
        state.ambulance?.let {
            Spacer(Modifier.height(8.dp))
            Text("Responder location: ${it.latitude}, ${it.longitude}", style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(24.dp))
        Button(onClick = onBack) { Text("Back to map") }
    }
}
