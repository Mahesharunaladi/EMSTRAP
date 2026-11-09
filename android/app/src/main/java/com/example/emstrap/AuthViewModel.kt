package com.example.emstrap

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import retrofit2.HttpException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AuthStage { LOADING, SIGN_IN, REGISTER, VERIFY, AUTHENTICATED }

data class AuthUiState(
    val stage: AuthStage = AuthStage.LOADING,
    val user: AuthUser? = null,
    val email: String = "",
    val busy: Boolean = false,
    val message: String? = null,
    val messageIsError: Boolean = false,
)

class AuthViewModel : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()
    private val api get() = AuthApiClient.api

    init {
        viewModelScope.launch {
            runCatching { api.currentUser().data?.user }
                .onSuccess { user ->
                    _state.value = if (user != null) AuthUiState(stage = AuthStage.AUTHENTICATED, user = user)
                    else AuthUiState(stage = AuthStage.SIGN_IN)
                }
                .onFailure {
                    SessionCookieJar.clear()
                    _state.value = AuthUiState(stage = AuthStage.SIGN_IN)
                }
        }
    }

    fun signIn(email: String, password: String) {
        val normalized = email.trim().lowercase()
        if (normalized.isBlank() || password.isBlank()) return showMessage("Enter your email and password.")
        submit {
            val response = try {
                api.login(CredentialsRequest(normalized, password))
            } catch (error: HttpException) {
                if (error.code() == 403) {
                    val body = runCatching {
                        error.response()?.errorBody()?.string()?.let { com.google.gson.JsonParser().parse(it).asJsonObject }
                    }.getOrNull()
                    val data = body?.getAsJsonObject("data")
                    if (data?.get("requiresVerification")?.asBoolean == true) {
                        val pendingEmail = data.get("email")?.getAsString() ?: normalized
                        _state.value = AuthUiState(stage = AuthStage.VERIFY, email = pendingEmail, message = "Verify your email to finish signing in.")
                        return@submit
                    }
                }
                throw error
            }
            val user = response.data?.user ?: error(response.message ?: "Sign-in failed.")
            _state.value = AuthUiState(stage = AuthStage.AUTHENTICATED, user = user)
        }
    }

    fun register(name: String, email: String, password: String) {
        val normalized = email.trim().lowercase()
        when {
            name.trim().isBlank() -> return showMessage("Enter your name.")
            normalized.isBlank() -> return showMessage("Enter a valid email address.")
            password.length < 8 -> return showMessage("Use a password with at least 8 characters.")
        }
        submit {
            val response = api.register(RegistrationRequest(name.trim(), normalized, password))
            val verifiedEmail = response.data?.email ?: normalized
            _state.value = AuthUiState(stage = AuthStage.VERIFY, email = verifiedEmail, message = response.message)
        }
    }

    fun verify(code: String) {
        val current = _state.value
        if (!code.matches(Regex("\\d{6}"))) return showMessage("Enter the six-digit code from your email.")
        submit {
            val response = api.verifyEmail(VerifyEmailRequest(current.email, code))
            val user = response.data?.user ?: error(response.message ?: "Email verification failed.")
            _state.value = AuthUiState(stage = AuthStage.AUTHENTICATED, user = user)
        }
    }

    fun resendCode() {
        val email = _state.value.email
        submit {
            val response = api.resendVerification(EmailRequest(email))
            _state.value = _state.value.copy(stage = AuthStage.VERIFY, message = response.message ?: "If the account can be verified, a code has been sent.")
        }
    }

    fun showSignIn() { _state.value = AuthUiState(stage = AuthStage.SIGN_IN) }
    fun showRegister() { _state.value = AuthUiState(stage = AuthStage.REGISTER) }

    fun logout() {
        viewModelScope.launch {
            runCatching { api.logout() }
            SessionCookieJar.clear()
            _state.value = AuthUiState(stage = AuthStage.SIGN_IN, message = "You have signed out.")
        }
    }

    private fun submit(action: suspend () -> Unit) {
        if (_state.value.busy) return
        _state.value = _state.value.copy(busy = true, message = null, messageIsError = false)
        viewModelScope.launch {
            runCatching { action() }
                .onFailure { _state.value = _state.value.copy(message = it.userMessage(), messageIsError = true) }
            if (_state.value.stage != AuthStage.AUTHENTICATED) _state.value = _state.value.copy(busy = false)
        }
    }

    private fun showMessage(message: String) {
        _state.value = _state.value.copy(message = message, messageIsError = true)
    }
}
