# Feature Meta

## Identification
feature_name: external-business-config
feature_number: "001"
feature_id: feat-001-external-business-config
created_at: 2026-03-31T00:00:00Z

## Context
description: |
  Sistema de configuración externa de parámetros de negocio del dashboard admin.
  Actualmente los valores como horas de confirmación de tutoría (24h), límites de cancelación,
  duraciones permitidas, etc. están hardcodeados en el código. La idea es abstraerlos
  a un archivo JSON configurable que se puede subir al servidor y modificar sin redeploy.
  Estrategia C: JSON como fuente de verdad + endpoint PATCH /admin/config para actualizar
  desde el dashboard (escribe al archivo + actualiza caché en memoria).

## Status
current_stage: functional
project_mode: brownfield
execution_mode: standard
project_type: MVP

## Framework
framework_version: 1.2.6
spec_language: es

## Testing (MVP)
unit_tests: required_for_critical_paths
integration_tests: required_for_critical_paths
e2e_tests: skip
code_review: required
coverage_target: varies

## User Profile
user_profile:
  type: technical
  source: global
  selected_at: 2026-03-31T00:00:00Z

## Brownfield Context
has_specs: true
reverse_eng_completed: true
specs_location: meli/specs/
patterns_location: meli/PATTERNS.md

## Git
branch: feature/add-external-config-edition

## Phases
phases:
  functional:
    status: approved
    approved_by: DanCmoo
    approved_at: 2026-03-31T16:23:31Z
  technical:
    status: pending
  tasks:
    status: pending
  implementation:
    status: pending
