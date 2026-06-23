# DEC-004 — Single Source of Truth

Date: 2026-06-23

Status: Accepted

## Decision

VOYO will maintain a single authoritative source for passenger and route data.

Passenger and route information must not be duplicated across multiple files, components, or collections.

## Context

The repository audit identified passenger data defined multiple times with inconsistent structures.

This creates:

* Data inconsistency
* Maintenance complexity
* Demo limitations
* Future integration challenges

## Decision Details

All applications will consume the same underlying passenger and route records:

* Driver Application
* Dispatcher Dashboard
* Future SMS System
* Future Caregiver Portal
* Future Family Portal

Status updates will be written once and reflected everywhere.

## Consequences

Benefits:

* Consistent data
* Easier maintenance
* Real-time synchronization
* Simpler future features

Tradeoffs:

* Initial migration effort
* Existing duplicated data must be removed

## Related Work

* P1-6 Single Source of Truth
* passenger-route-model.md
