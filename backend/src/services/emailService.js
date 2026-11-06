import nodemailer from 'nodemailer'

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
const transporter = smtpConfigured ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }) : null

export async function sendVerificationCode({ email, name, code }) {
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured')
    console.warn(`[email] SMTP is not configured. Verification code for ${email}: ${code}`)
    return
  }
  await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: email, subject: 'Verify your EmSTraP email', text: `Hi ${name}, your EmSTraP verification code is ${code}. It expires in 10 minutes.`, html: `<div style="font-family:Arial,sans-serif;max-width:520px"><h2>Verify your EmSTraP email</h2><p>Hi ${name}, use this code to finish creating your account:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#dc2626">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>` })
}

export { smtpConfigured }
