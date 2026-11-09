package com.example.emstrap

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.maps.model.LatLng
import io.socket.client.AckWithTimeout
import io.socket.client.IO
import io.socket.client.Socket
import java.net.URISyntaxException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

class EmstrapViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(EmergencyUiState())
    val uiState = _uiState.asStateFlow()

    private var socket: Socket? = null

    fun triggerSOS(location: LatLng) {
        if (_uiState.value.status == EmergencyStatus.SEARCHING) return
        _uiState.value = EmergencyUiState(status = EmergencyStatus.SEARCHING, userLocation = location)

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val connection = getSocket()
                connection.connect()
                connection.emit(
                    "emergency:dispatch",
                    JSONObject().put("location", JSONObject()
                        .put("lat", location.latitude)
                        .put("lng", location.longitude)),
                    object : AckWithTimeout(20_000) {
                        override fun onTimeout() = showConnectionError()

                        override fun onSuccess(vararg args: Any?) {
                            val result = args.firstOrNull() as? JSONObject
                            if (result?.optBoolean("success") == true) {
                                _uiState.value = _uiState.value.copy(
                                    status = EmergencyStatus.DISPATCHED,
                                    message = "Emergency alert sent to nearby responders.",
                                )
                            } else {
                                _uiState.value = _uiState.value.copy(
                                    status = EmergencyStatus.ERROR,
                                    message = result?.optString("message") ?: "Emergency dispatch failed. Please try again.",
                                )
                            }
                        }
                    },
                )
            } catch (_: URISyntaxException) {
                showConnectionError()
            } catch (_: Exception) {
                showConnectionError()
            }
        }
    }

    private fun getSocket(): Socket {
        socket?.let { return it }
        val options = IO.Options().apply {
            SessionCookieJar.cookieHeader(BuildConfig.BACKEND_BASE_URL)?.let { cookie ->
                extraHeaders = mapOf("Cookie" to listOf(cookie))
            }
        }
        return IO.socket(BuildConfig.BACKEND_BASE_URL, options).also { connection ->
            socket = connection
            connection.on(Socket.EVENT_CONNECT_ERROR) { showConnectionError() }
            connection.on("socket_error") { args ->
                val error = args.firstOrNull() as? JSONObject
                _uiState.value = _uiState.value.copy(
                    status = EmergencyStatus.ERROR,
                    message = error?.optString("message") ?: "Emergency dispatch failed. Please try again.",
                )
            }
            connection.on("DRIVER_ASSIGNED") { args ->
                val assignment = args.firstOrNull() as? JSONObject ?: return@on
                val driver = assignment.optJSONObject("driver") ?: return@on
                val current = _uiState.value
                _uiState.value = current.copy(
                    status = EmergencyStatus.DISPATCHED,
                    driverName = driver.optString("name", "Assigned driver"),
                    message = "A responder has accepted your emergency.",
                )
            }
            connection.on("DRIVER_LOCATION_UPDATED") { args ->
                val update = args.firstOrNull() as? JSONObject ?: return@on
                val coords = update.optJSONObject("location") ?: return@on
                val current = _uiState.value
                _uiState.value = current.copy(ambulance = AmbulanceLocation(
                    id = update.optString("driverId", "Ambulance"),
                    latitude = coords.optDouble("lat", Double.NaN),
                    longitude = coords.optDouble("lng", Double.NaN),
                    driverName = current.ambulance?.driverName ?: "Assigned ambulance",
                ))
            }
        }
    }

    private fun showConnectionError() {
        _uiState.value = _uiState.value.copy(
            status = EmergencyStatus.ERROR,
            message = "Could not reach EmSTraP dispatch. Check your connection and try again.",
        )
    }

    fun reset() {
        _uiState.value = EmergencyUiState()
    }

    fun endSession() {
        socket?.disconnect()
        socket?.close()
        socket = null
        _uiState.value = EmergencyUiState()
    }

    override fun onCleared() {
        endSession()
    }
}
