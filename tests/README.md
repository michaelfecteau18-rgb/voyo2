# Firestore rules tests

Validates `firestore.rules` against spec P0-3 (positive + negative cases).

## Run (requires Java 21+ for current firebase-tools, or firebase-tools@13.x for Java 11)

```bash
npm install -D @firebase/rules-unit-testing firebase-tools
firebase emulators:exec --only firestore "node tests/firestore.rules.test.mjs"
```

Expects: all positive cases (driver writes own trip/points, admin reads active trips)
succeed; all negative cases (anon, cross-driver writes, invalid status, undeclared
collections, deletes, point mutation) fail. Exit code 0 = all passed.
