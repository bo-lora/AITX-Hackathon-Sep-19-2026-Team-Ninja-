---
name: complete-clinical-documentation
description: "Runs the OpenEMR workflow Complete Clinical Documentation via POST /api/patient/{pid}/encounter/{eid}/soap_note, POST /api/patient/{pid}/encounter/{eid}/vital, POST /api/prescription. Use when the user asks to document the patient visit by adding SOAP notes, vitals, and a prescription."
---

# Complete Clinical Documentation

Document the patient visit by adding SOAP notes, vitals, and a prescription.

Grounded against **OpenEMR API 8.4.0**. Call only the operations below.
Copy method and path exactly. Do not invent endpoints or HTTP methods.

## Inputs

- `subjective_notes`
- `assessment_notes`
- `plan_notes`
- `weight`
- `height`
- `bp_systolic`
- `bp_diastolic`
- `pulse`
- `respiration`
- `drug_name`
- `quantity`
- `medicine_units`
- `directions`
- `refills`

## API sequence

Run these calls in order. Resolve path parameters from earlier responses.

### 1. `POST` `/api/patient/{pid}/encounter/{eid}/soap_note`

Add SOAP notes to the patient's encounter.

Covers: `create_soap_note`

Field mapping (OpenAPI <- input):

- `pid` <- `patient_id`
- `eid` <- `encounter_id`
- `subjective` <- `subjective_notes`
- `assessment` <- `assessment_notes`
- `plan` <- `plan_notes`

Spec: Submits a new soap note

### 2. `POST` `/api/patient/{pid}/encounter/{eid}/vital`

Record vitals for the patient's encounter.

Covers: `record_vitals`

Field mapping (OpenAPI <- input):

- `pid` <- `patient_id`
- `eid` <- `encounter_id`
- `weight` <- `weight`
- `height` <- `height`
- `bp_systolic` <- `bp_systolic`
- `bp_diastolic` <- `bp_diastolic`
- `pulse` <- `pulse`
- `respiration` <- `respiration`

Spec: Submits a new vitals form

### 3. `POST` `/api/prescription`

Add a prescription for the patient.

Covers: `add_prescription`

Field mapping (OpenAPI <- input):

- `patient_id` <- `patient_id`
- `drug` <- `drug_name`
- `quantity` <- `quantity`
- `dosage` <- `medicine_units`
- `directions` <- `directions`
- `refills` <- `refills`

Spec: Creates a new prescription

## Auth

OpenEMR standard REST uses OAuth2 (`openemr_auth`).
Server base path is `/apis/default/` unless the spec says otherwise.
