# VOYO Architecture

## Overview

VOYO is a transportation visibility platform built for adapted transportation providers and future school transportation operators.

The platform currently contains two primary applications:

1. Driver Application
2. Dispatcher Dashboard

Future applications:

3. Caregiver Portal
4. Family Portal

---

## Technology Stack

Frontend:

* React 19
* Vite
* React Router

Backend:

* Firebase
* Firestore
* Firebase Authentication

Maps:

* Google Maps API

Hosting:

* Firebase Hosting

State Management:

* Zustand

Date Handling:

* DayJS

---

## Core System Flow

Driver
↓
GPS Location
↓
Firestore
↓
Dispatcher Dashboard
↓
Visibility

Future:

Driver
↓
GPS Location
↓
Firestore
↓
Caregiver Portal
↓
Family Portal

---

## Core Business Objects

Users

Roles:

* Dispatcher
* Driver
* Caregiver
* Family Member
* Administrator

Trips

States:

* Scheduled
* Assigned
* Active
* Completed
* Cancelled

Passengers

Status:

* Waiting
* Picked Up
* Onboard
* Dropped Off

Vehicles

Status:

* Available
* Assigned
* Active
* Offline

---

## Architectural Principles

1. Visibility First
2. Mobile First
3. Real-Time First
4. Simplicity Over Complexity
5. Human-Centered Design
