# EMSTRAP
A full-stack emergency response and ambulance booking platform that enables real-time emergency reporting, ambulance dispatch, hospital coordination, police assistance, and scheduled ambulance bookings.

Frontend app is located in `frontend/`. Run `cd frontend && npm install && npm run dev` to start it.

Backend API and Socket.IO server is located in `backend/`. Copy the Atlas, JWT, and SMTP values into `backend/.env`, then run `cd backend && npm install && npm run dev`.

Authentication endpoints are available under `/api/auth`: registration sends a real six-digit email verification code, verification issues an HttpOnly JWT cookie, login requires a verified email, and `/me` restores the current session. For Gmail SMTP, use an App Password rather than your normal account password.

The backend uses separate `EMSTRAP-Emergency` and `EMSTRAP-Booking` Mongoose connections. The emergency socket gateway supports `join_room`, `driver_location_update`, `emergency_sos_triggered`, and the frontend-compatible `emergency:dispatch` event.
