package com.example.emstrap

import com.google.android.gms.maps.model.LatLng

data class AmbulanceLocation(
    val id: String,
    val latitude: Double,
    val longitude: Double,
    val driverName: String,
)

enum class EmergencyStatus {
    IDLE,
    SEARCHING,
    DISPATCHED,
    ARRIVED,
    ERROR,
}

data class EmergencyUiState(
    val status: EmergencyStatus = EmergencyStatus.IDLE,
    val userLocation: LatLng? = null,
    val ambulance: AmbulanceLocation? = null,
    val driverName: String? = null,
    val message: String? = null,
)
