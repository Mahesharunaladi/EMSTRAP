import nodemailer from 'nodemailer'

const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
let transporter = null

if (smtpConfigured) {
  if (process.env.SMTP_HOST === 'smtp.gmail.com' || (process.env.SMTP_USER && process.env.SMTP_USER.endsWith('@gmail.com'))) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 6000,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 6000,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    })
  }
}

export async function sendVerificationCode({ email, name, code }) {
  console.log(`[AUTH-OTP] ========================================`)
  console.log(`[AUTH-OTP] Recipient: ${email}`)
  console.log(`[AUTH-OTP] Verification Code: ${code}`)
  console.log(`[AUTH-OTP] ========================================`)

  if (!transporter) {
    console.warn(`[email] SMTP is not configured. Verification code for ${email}: ${code}`)
    return { delivered: false, code }
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Verify your EmSTraP email',
      text: `Hi ${name || 'User'}, your EmSTraP verification code is ${code}. It expires in 10 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px"><h2>Verify your EmSTraP email</h2><p>Hi ${name || 'User'}, use this code to finish creating your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#dc2626">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`
    })
    console.log(`[email] Verification email sent to ${email}: ${info.messageId}`)
    return { delivered: true, code }
  } catch (error) {
    console.error(`[email error] Failed to send email to ${email}:`, error.message)
    return { delivered: false, code, error: error.message }
  }
}

export { smtpConfigured }
