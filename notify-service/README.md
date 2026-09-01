# Notify Service

Sends ride-status updates. For now, "sending" means logging to the
console and saving a row to the database — swap in real SMS/email/push
later inside app/routers/notify.py without touching anything else.

## Run it

1. cd notify-service
2. python -m venv .venv
3. Activate it: .venv\Scripts\activate (Windows) or source .venv/bin/activate (Mac/Linux)
4. pip install -r requirements.txt
5. Copy .env.example to .env and paste in your real Neon connection
   string for a THIRD, separate Neon project (notify_db) — don't
   reuse Booking's or Matching's database.
6. uvicorn app.main:app --reload --port 8002
7. Open http://localhost:8002/docs to test it in Swagger UI, or
   http://localhost:8002/health to check the DB connection.