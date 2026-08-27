# Technical Design Document — Template

*Part of the deliverable-templates skill.*

Output path: `<app>/deliverables/Technical-Design-Document.md`
Fill every `{{placeholder}}` before handing off. Never leave a `{{placeholder}}` in a finished document.
Sections marked *(Optional)* may be deleted if genuinely not applicable — note why in §12 Open Issues.

---

## Technical Design Document

| Field | Value |
|---|---|
| **Document ID** | {{document_id}} |
| **GAP ID** | {{gap_id}} |
| **TD Title** | {{td_title}} |
| **Business Process Area** | {{business_process_area}} |
| **Design Specification Author** | {{author}} |
| **Implementation Partner** | {{implementation_partner}} |
| **Application Design Approval** | {{approval_name}} |
| **Application Design Submission Date** | {{submission_date}} |
| **Technical Specification Submission Date** | {{tech_spec_submission_date}} |

---

## Change History

| Version | Date | Author | Description of Change |
|---|---|---|---|
| 1.0 | {{date}} | {{author}} | Initial draft |

## Reviewers

| Name | Role | Date |
|---|---|---|
| {{reviewer_name}} | {{reviewer_role}} | {{review_date}} |

## Sign Off

| Name | Role | Date | Signature |
|---|---|---|---|
| {{signoff_name}} | {{signoff_role}} | {{signoff_date}} | |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Acronyms and References](#2-acronyms-and-references)
3. [Solution Architecture](#3-solution-architecture)
4. [Functional Specification](#4-functional-specification)
5. [Integration Design](#5-integration-design)
6. [Error Handling](#6-error-handling)
7. [Security and Authorization](#7-security-and-authorization)
8. [Nonfunctional Requirements](#8-nonfunctional-requirements)
9. [Additional Requirements](#9-additional-requirements)
10. [Testing Requirements](#10-testing-requirements)
11. [Additional Supporting / Reference Documentation](#11-additional-supporting--reference-documentation)
12. [Open Issues](#12-open-issues)
13. [Application Design](#13-application-design)
14. [Data Migration *(Optional)*](#14-data-migration-optional)

---

## 1. Introduction

### 1.1 Objectives

{{objectives_description}}

### 1.2 Scope

{{scope_description}}

### 1.3 Pre-Requisites

{{prerequisites}}

### 1.4 Assumptions

{{assumptions}}

### 1.5 Exclusions

{{exclusions}}

### 1.6 Dependencies / Constraints

{{dependencies_constraints}}

### 1.7 Risks / Mitigation

{{risks_mitigation}}

---

## 2. Acronyms and References

### 2.1 Acronyms

| Term | Definition |
|---|---|
| {{term_1}} | {{definition_1}} |
| {{term_2}} | {{definition_2}} |

### 2.2 References

{{references}}

---

## 3. Solution Architecture

> Auto-populated from `Application-Architecture.md` (Gate G) and `mta.yaml`.

### 3.1 System Topology

{{system_topology_description}}

```
{{ASCII topology — e.g.:}}
Browser → BTP HTML5 Runtime → Destination Service → CAP Node.js Service → HANA Cloud
                                                   ↘ S/4 Released OData API
```

### 3.2 Technology Stack

| Layer | Technology | Version / Plan |
|---|---|---|
| Frontend | {{e.g. SAP Fiori Elements / Freestyle UI5}} | {{SAPUI5 version}} |
| Backend | {{e.g. CAP Node.js}} | {{@sap/cds version}} |
| Database | {{e.g. SAP HANA Cloud}} | {{hdi-shared}} |
| Authentication | {{e.g. XSUAA}} | {{application plan}} |
| Hosting | {{e.g. BTP Cloud Foundry}} | {{org / space}} |

### 3.3 Runtime Environments

| Environment | Platform | Database | Auth |
|---|---|---|---|
| Development | Local (`cds watch` @ :4004) | SQLite in-memory | Mocked users |
| QA | BTP CF — {{space}} | HANA Cloud | XSUAA |
| Production | BTP CF — {{space}} | HANA Cloud | XSUAA |

---

## 4. Functional Specification

### 4.1 Detail Description of To-Be Process

#### 4.1.1 Application Functionality

{{application_functionality}}

#### 4.1.2 User Stories

{{user_stories_link_or_description}}

#### 4.1.3 Screen Flows

{{screen_flow_description}}

#### 4.1.4 Enhancement Details

{{enhancement_overview}}

**Data Model / Field Table:**

| Nr | Attribute Name | Field Length / Type | Validation / Comments |
|---|---|---|---|
| 1 | {{field_1_name}} | {{field_1_type}} | {{field_1_validation}} |
| 2 | {{field_2_name}} | {{field_2_type}} | {{field_2_validation}} |

#### 4.1.5 Selection Screen

{{selection_screen_description}}

**Selection Screen Fields:**

| Nr | Field | On Screen Validation |
|---|---|---|
| 1 | {{sel_field_1}} | {{sel_field_1_validation}} |
| 2 | {{sel_field_2}} | {{sel_field_2_validation}} |

#### 4.1.6 Expected Screen Layout and Functionality

{{screen_layout_overview}}

**Processing Logic:**

| Nr | Processing | Description |
|---|---|---|
| 1 | {{process_1_name}} | {{process_1_desc}} |
| 2 | {{process_2_name}} | {{process_2_desc}} |

#### 4.1.7 Input Parameters / Field Mapping

**Input / Selection Screen:**

| Screen | Field Name | Ref Field | Ref Table | UI Type | Feature | Mandatory | Default Value | Logic / Validation |
|---|---|---|---|---|---|---|---|---|
| Input Screen | {{field_name}} | {{ref_field}} | {{ref_table}} | {{ui_type}} | {{feature}} | {{mandatory}} | {{default}} | {{validation}} |

**List Display:**

| Screen | Field Name | Ref Field | Ref Table | UI Type | Feature | Mandatory | Default Value | Logic / Validation |
|---|---|---|---|---|---|---|---|---|
| List Display | {{field_name}} | {{ref_field}} | {{ref_table}} | Display | | | | |

**New Create / Edit Screen:**

| Screen | Field Name | Ref Field | Ref Table | UI Type | Feature | Mandatory | Default Value | Logic / Validation |
|---|---|---|---|---|---|---|---|---|
| New Create | {{field_name}} | {{ref_field}} | {{ref_table}} | {{ui_type}} | {{feature}} | {{mandatory}} | {{default}} | {{validation}} |

#### 4.1.8 Actions

| Action | UI Control | Details | Error Handling |
|---|---|---|---|
| {{action_1}} | {{ui_control_1}} | {{details_1}} | {{error_1}} |
| {{action_2}} | {{ui_control_2}} | {{details_2}} | {{error_2}} |

#### 4.1.9 Additional Screen Validations

{{additional_validations}}

#### 4.1.10 Processing Logic

{{processing_logic}}

#### 4.1.11 Batch Job Processing Requirement

{{batch_job_requirements}}

---

## 5. Integration Design

> Auto-populated from `cds.requires` in `package.json` and destination `init_data` in `mta.yaml`.

### 5.1 Integration Overview

{{integration_overview}}

### 5.2 Integration Flows

| # | Source System | Target System | Protocol | Auth Type | Trigger | Error Handling | SLA |
|---|---|---|---|---|---|---|---|
| 1 | {{source}} | {{target}} | {{OData V4 / REST}} | {{OAuth2 / JWT / None}} | {{Real-time / Batch}} | {{retry / surface error}} | {{response time ms}} |

### 5.3 Destination Configuration

| Destination Name | URL | Auth | Forward Auth Token |
|---|---|---|---|
| {{dest_name}} | {{url}} | {{NoAuthentication / OAuth2UserTokenExchange}} | {{Yes / No}} |

---

## 6. Error Handling

> Auto-populated from `req.error()`, `req.reject()`, `req.warn()` calls in `srv/*.js`.

### 6.1 Validation Errors (4xx)

| Module / Handler | Condition | HTTP Code | Message |
|---|---|---|---|
| {{Entity}} before CREATE | {{e.g. quantity ≤ 0}} | 400 | {{Quantity must be greater than zero}} |
| {{Entity}} before UPDATE | {{e.g. record locked}} | 409 | {{Record is locked for editing}} |

### 6.2 Authorization Errors (403)

| Handler | Condition | Message |
|---|---|---|
| {{action / entity}} | {{user not in required role}} | {{You do not have permission to…}} |

### 6.3 System / Integration Errors (5xx)

| Integration | Failure Scenario | Handling Strategy |
|---|---|---|
| {{remote service call}} | {{timeout / service unavailable}} | {{fallback / retry / surface to user}} |

---

## 7. Security and Authorization

### Business Roles

| Role | Description |
|---|---|
| {{role_1}} | {{role_1_desc}} |
| {{role_2}} | {{role_2_desc}} |

### 7.1 Fiori Tile Requirements

{{fiori_tile_requirements}}

### 7.2 Authentication Mechanism

{{authentication_mechanism}}

### 7.3 Authorization Checks

{{authorization_checks}}

---

## 8. Nonfunctional Requirements

### 8.1 Response Time

{{response_time_requirements}}

### 8.2 Availability

{{availability_requirements}}

### 8.3 Scalability

{{scalability_requirements}}

### 8.4 Maintainability

{{maintainability_requirements}}

---

## 9. Additional Requirements

### 9.1 Compliance & Regulatory

{{compliance_regulatory}}

---

## 10. Testing Requirements

### 10.1 Key Business Test Conditions

| ID | Test ID | Test Description | Expected Results | Sprint Ref |
|---|---|---|---|---|
| 1 | {{test_id_1}} | {{test_desc_1}} | {{expected_1}} | {{sprint_1}} |
| 2 | {{test_id_2}} | {{test_desc_2}} | {{expected_2}} | {{sprint_2}} |

### 10.2 Test Data

{{test_data}}

---

## 11. Additional Supporting / Reference Documentation

{{supporting_documentation}}

---

## 12. Open Issues

| Issue No | Description | Assigned To | Status | Impact | Resolution |
|---|---|---|---|---|---|
| {{issue_1}} | {{issue_1_desc}} | {{issue_1_owner}} | {{issue_1_status}} | {{issue_1_impact}} | {{issue_1_resolution}} |

---

## 13. Application Design

### 13.1 Application Design Overview

{{app_design_overview}}

### 13.2 Application Design Checklist (ADC)

{{app_design_checklist}}

### 13.3 Application Design Diagram

{{app_design_diagram}}
*(List of technologies used: {{technologies}})*

### 13.4 Application Design Flow Diagram

{{app_design_flow_diagram}}

### 13.5 Application Design Limitations

{{app_design_limitations}}

### 13.6 Custom Developments in S/4

{{custom_developments_s4}}

---

## 14. Data Migration *(Optional)*

> Complete this section only if initial data migration from a legacy or source system is in scope.
> If not applicable, delete this section and note it in §12 Open Issues.

### 14.1 Migration Scope

{{migration_scope_description}}

### 14.2 Source-to-Target Field Mapping

| # | Source System | Source Field | Target Entity | Target Field | Transformation / Notes |
|---|---|---|---|---|---|
| 1 | {{source_system}} | {{source_field}} | {{Entity}} | {{target_field}} | {{e.g. date format DD/MM/YYYY → ISO 8601}} |
| 2 | {{source_system}} | {{source_field}} | {{Entity}} | {{target_field}} | {{e.g. code mapping OLD → NEW}} |

### 14.3 Migration Strategy

| Phase | Activity | Tool / Method | Owner |
|---|---|---|---|
| 1 | Extract from source | {{e.g. CSV export / API extract}} | {{owner}} |
| 2 | Data cleansing & transformation | {{e.g. script / Excel}} | {{owner}} |
| 3 | Load to target | {{cds deploy + CSV seed / HDI deployer}} | {{owner}} |
| 4 | Reconciliation | {{record count + spot-check validation}} | {{owner}} |
| 5 | Cutover | {{freeze source → final delta load → go-live}} | {{owner}} |

### 14.4 Error Logging & Reconciliation

{{migration_error_logging_approach}}
