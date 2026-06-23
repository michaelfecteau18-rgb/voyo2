# Updated Feature Workflow

Product Owner
↓
Architect
↓
Builder
↓
Integrity Checker
↓
Reviewer
↓
Product Owner

---

## Integrity Gate

No task may proceed to Reviewer until Integrity Checker passes.

Checks required:

* File exists
* File not truncated
* Syntax valid
* Build passes
* Modified files readable

Failure = return to Builder.
