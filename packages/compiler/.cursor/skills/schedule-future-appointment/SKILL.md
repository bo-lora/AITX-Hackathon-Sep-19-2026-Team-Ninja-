---
name: schedule-future-appointment
description: "Runs the OpenEMR workflow Schedule Future Appointment via POST /api/patient/{pid}/appointment. Use when the user asks to schedule a follow-up appointment for the patient directly from their dashboard."
---

# Schedule Future Appointment

Schedule a follow-up appointment for the patient directly from their dashboard.

Grounded against **OpenEMR API 8.4.0**. Call only the operations below.
Copy method and path exactly. Do not invent endpoints or HTTP methods.

## Inputs

- `visit_category`
- `appointment_date`
- `appointment_time`

## API sequence

Run these calls in order. Resolve path parameters from earlier responses.

### 1. `POST` `/api/patient/{pid}/appointment`

Schedule a follow-up appointment for the patient.

Covers: `create_appointment`

Field mapping (OpenAPI <- input):

- `pid` <- `patient_id`
- `pc_eventDate` <- `appointment_date`
- `pc_startTime` <- `appointment_time`
- `pc_catid` <- `visit_category`

Required by the spec and not in the mapping: `pc_title`, `pc_duration`, `pc_hometext`, `pc_apptstatus`, `pc_facility`, `pc_billing_location`

Spec: Submits a new appointment

## Auth

OpenEMR standard REST uses OAuth2 (`openemr_auth`).
Server base path is `/apis/default/` unless the spec says otherwise.
