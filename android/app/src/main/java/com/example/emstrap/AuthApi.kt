package com.example.emstrap

import okhttp3.OkHttpClient
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

data class ApiResponse<T>(val success: Boolean = false, val message: String? = null, val data: T? = null)
data class AuthUser(val id: String, val name: String, val email: String, val role: String, val verified: Boolean)
data class UserPayload(val user: AuthUser)
data class RegistrationPayload(val email: String)
data class EmailRequest(val email: String)
data class CredentialsRequest(val email: String, val password: String)
data class RegistrationRequest(val name: String, val email: String, val password: String)
data class VerifyEmailRequest(val email: String, val code: String)

interface AuthApi {
    @POST("/api/auth/register")
    suspend fun register(@Body request: RegistrationRequest): ApiResponse<RegistrationPayload>

    @POST("/api/auth/verify-email")
    suspend fun verifyEmail(@Body request: VerifyEmailRequest): ApiResponse<UserPayload>

    @POST("/api/auth/resend-verification")
    suspend fun resendVerification(@Body request: EmailRequest): ApiResponse<RegistrationPayload>

    @POST("/api/auth/login")
    suspend fun login(@Body request: CredentialsRequest): ApiResponse<UserPayload>

    @GET("/api/auth/me")
    suspend fun currentUser(): ApiResponse<UserPayload>

    @POST("/api/auth/logout")
    suspend fun logout(): ApiResponse<Any>
}

object AuthApiClient {
    val api: AuthApi by lazy {
        val client = OkHttpClient.Builder().cookieJar(SessionCookieJar).build()
        Retrofit.Builder()
            .baseUrl("${BuildConfig.BACKEND_BASE_URL.trimEnd('/')}/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }
}

internal fun Throwable.userMessage(): String {
    if (this is HttpException) {
        val responseMessage = runCatching {
            response()?.errorBody()?.string()?.let {
                com.google.gson.JsonParser().parse(it).asJsonObject.get("message")?.getAsString()
            }
        }.getOrNull()
        if (!responseMessage.isNullOrBlank()) return responseMessage
    }
    return message?.takeIf { it.contains("Unable to resolve host") || it.contains("Failed to connect") }
        ?.let { "Can't reach EmSTraP. Check the backend address and your network." }
        ?: "Something went wrong. Please try again."
}
