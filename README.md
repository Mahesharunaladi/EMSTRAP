# EMSTRAP
A full-stack emergency response and ambulance booking platform that enables real-time emergency reporting, ambulance dispatch, hospital coordination, police assistance, and scheduled ambulance bookings.

Frontend app is located in `frontend/`. Run `cd frontend && npm install && npm run dev` to start it.

The police command dashboard runs separately at `http://localhost:5174`. Start it from `frontend/` with `npm run dev:police`.

The driver portal and dashboard run separately at `http://localhost:5175`. Start them from `frontend/` with `npm run dev:driver`.

Backend API and Socket.IO server is located in `backend/`. Copy the Atlas, JWT, and SMTP values into `backend/.env`, then run `cd backend && npm install && npm run dev`.

Authentication endpoints are available under `/api/auth`: registration sends a real six-digit email verification code, verification issues an HttpOnly JWT cookie, login requires a verified email, and `/me` restores the current session. For Gmail SMTP, use an App Password rather than your normal account password.

The backend uses separate `EMSTRAP-Emergency` and `EMSTRAP-Booking` Mongoose connections. The emergency socket gateway supports `join_room`, `driver_location_update`, `emergency_sos_triggered`, and the frontend-compatible `emergency:dispatch` event.

## Native Android app

The Jetpack Compose Android client is in `android/`. Open that directory in Android Studio and sync the Gradle project. It includes an SOS map dashboard, runtime location permission requests, the backend Socket.IO dispatch flow, and emergency-specific driver assignment/location updates.

Set the Google Maps Android SDK key in Android Studio's Gradle arguments as `-PmapsApiKey=YOUR_KEY`. The default backend URL is `http://10.0.2.2:5001` for an Android emulator connecting to a backend on the host machine. For a physical device, set `-PbackendBaseUrl=http://YOUR_COMPUTER_LAN_IP:5001`; use HTTPS for a production deployment. Build an APK from Android Studio with **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
