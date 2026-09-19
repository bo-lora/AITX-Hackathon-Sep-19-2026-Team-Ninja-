---
name: register-patient-and-create-encounter
description: "Runs the OpenEMR workflow Register Patient and Create Encounter via POST /api/patient, POST /api/patient/{puuid}/encounter. Use when the user asks to register a new patient with demographics and create a new encounter for their visit."
---

# Register Patient and Create Encounter

Register a new patient with demographics and create a new encounter for their visit.

Grounded against **OpenEMR API 8.4.0**. Call only the operations below.
Copy method and path exactly. Do not invent endpoints or HTTP methods.

## Inputs

- `first_name`
- `last_name`
- `dob`
- `sex`
- `marital_status`
- `visit_category`
- `reason_for_visit`

## API sequence

Run these calls in order. Resolve path parameters from earlier responses.

### 1. `POST` `/api/patient`

Register a new patient with demographic details.

Covers: `create_patient`

Field mapping (OpenAPI <- input):

- `fname` <- `first_name`
- `lname` <- `last_name`
- `DOB` <- `dob`
- `sex` <- `sex`
- `marital_status` <- `marital_status`

Spec: Creates a new patient

### 2. `POST` `/api/patient/{puuid}/encounter`

Create a new encounter for the registered patient.

Covers: `create_encounter`

Field mapping (OpenAPI <- input):

- `puuid` <- `patient_uuid`
- `visit_category` <- `visit_category`

Spec: Creates a new encounter

## Auth

OpenEMR standard REST uses OAuth2 (`openemr_auth`).
Server base path is `/apis/default/` unless the spec says otherwise.
