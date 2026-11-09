package com.example.emstrap

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun AuthScreen(viewModel: AuthViewModel) {
    val state by viewModel.state.collectAsState()
    var name by remember { mutableStateOf("") }
    var email by remember(state.email) { mutableStateOf(state.email) }
    var password by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }

    Surface(color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 36.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text("EmSTraP", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
            Text("Emergency response, connected.", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(28.dp))

            when (state.stage) {
                AuthStage.LOADING -> CircularProgressIndicator()
                AuthStage.SIGN_IN -> {
                    Text("Sign in", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
                    Button(onClick = { viewModel.signIn(email, password) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                        Text(if (state.busy) "Signing in…" else "Sign in")
                    }
                    TextButton(onClick = viewModel::showRegister, modifier = Modifier.fillMaxWidth()) { Text("Create an account") }
                }
                AuthStage.REGISTER -> {
                    Text("Create account", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(name, { name = it }, label = { Text("Full name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(email, { email = it }, label = { Text("Email") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(password, { password = it }, label = { Text("Password (8+ characters)") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
                    Button(onClick = { viewModel.register(name, email, password) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                        Text(if (state.busy) "Creating account…" else "Create account")
                    }
                    TextButton(onClick = viewModel::showSignIn, modifier = Modifier.fillMaxWidth()) { Text("Already have an account? Sign in") }
                }
                AuthStage.VERIFY -> {
                    Text("Check your email", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                    Text("Enter the six-digit verification code sent to ${state.email}.", modifier = Modifier.padding(top = 8.dp))
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(code, { code = it.filter(Char::isDigit).take(6) }, label = { Text("Verification code") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                    Button(onClick = { viewModel.verify(code) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                        Text(if (state.busy) "Verifying…" else "Verify email")
                    }
                    TextButton(onClick = viewModel::resendCode, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) { Text("Resend code") }
                    TextButton(onClick = viewModel::showSignIn, modifier = Modifier.fillMaxWidth()) { Text("Back to sign in") }
                }
                AuthStage.AUTHENTICATED -> Unit
            }

            state.message?.let {
                Text(
                    it,
                    color = if (state.messageIsError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
        }
    }
}
