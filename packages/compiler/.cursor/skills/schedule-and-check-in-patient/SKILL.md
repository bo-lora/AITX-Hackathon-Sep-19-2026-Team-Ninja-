---
name: schedule-and-check-in-patient
description: "Runs the OpenEMR workflow Schedule and Check-in Patient via GET /api/patient, POST /api/patient/{pid}/appointment. Use when the user asks to schedule an appointment for an existing patient and mark them as arrived to generate an encounter. Leaves update_appointment_status unmapped because those endpoints are not in OpenEMR API 8.4.0."
---

# Schedule and Check-in Patient

Schedule an appointment for an existing patient and mark them as arrived to generate an encounter.

Grounded against **OpenEMR API 8.4.0**. Call only the operations below.
Copy method and path exactly. Do not invent endpoints or HTTP methods.

## Inputs

- `patient_name`
- `appointment_date`
- `appointment_time`
- `appointment_status`

## API sequence

Run these calls in order. Resolve path parameters from earlier responses.

### 1. `GET` `/api/patient`

Search for a patient by name.

Covers: `search_patient`

Field mapping (OpenAPI <- input):

- `fname` <- `patient_name`

Spec: Retrieves a list of patients

### 2. `POST` `/api/patient/{pid}/appointment`

Create a new appointment for the patient.

Covers: `create_appointment`

Field mapping (OpenAPI <- input):

- `pid` <- `patient_id`
- `pc_eventDate` <- `appointment_date`
- `pc_startTime` <- `appointment_time`
- `pc_apptstatus` <- `appointment_status`

Required by the spec and not in the mapping: `pc_catid`, `pc_title`, `pc_duration`, `pc_hometext`, `pc_facility`, `pc_billing_location`

Spec: Submits a new appointment

## Out of spec

Do not call an API for these observed UI steps:

- `update_appointment_status`: Check-in and status update to 'Arrived' is UI-only; no API for status change.

## Auth

OpenEMR standard REST uses OAuth2 (`openemr_auth`).
Server base path is `/apis/default/` unless the spec says otherwise.
