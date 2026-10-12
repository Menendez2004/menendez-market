# OWASP API Security Top 10 (2023) and CWE Mapping

Use the OWASP ID and the closest CWE on every finding.

| OWASP | Name | Rule file | Common CWEs |
|---|---|---|---|
| API1:2023 | Broken Object Level Authorization | `sec-authz-object.md` | CWE-639, CWE-284 |
| API2:2023 | Broken Authentication | `sec-authn.md` | CWE-287, CWE-306, CWE-307, CWE-347, CWE-798, CWE-916 |
| API3:2023 | Broken Object Property Level Authorization | `sec-mass-assignment.md`, `sec-exposure.md` | CWE-915, CWE-213 |
| API4:2023 | Unrestricted Resource Consumption | `sec-resource.md` | CWE-770, CWE-400, CWE-799 |
| API5:2023 | Broken Function Level Authorization | `sec-authz-function.md` | CWE-285, CWE-862 |
| API6:2023 | Unrestricted Access to Sensitive Business Flows | `sec-business-logic.md`, `sec-resource.md` | CWE-840, CWE-362 |
| API7:2023 | Server Side Request Forgery | `sec-ssrf.md` | CWE-918, CWE-611 |
| API8:2023 | Security Misconfiguration | `sec-config.md`, `sec-exposure.md`, `sec-injection.md` | CWE-942, CWE-352, CWE-209, CWE-693, CWE-16 |
| API9:2023 | Improper Inventory Management | `sec-config.md` | CWE-1059 |
| API10:2023 | Unsafe Consumption of APIs | `sec-config.md`, `sec-ssrf.md` | CWE-20, CWE-295, CWE-345 |

Injection is not its own API Top 10 item; map it to API8:2023 and to the
web Top 10 A03:2021 Injection, with its specific CWE (89, 943, 78, 94,
1336, 502). Path traversal: CWE-22; unrestricted upload: CWE-434; data
exposure: CWE-200; secrets in logs: CWE-532.

References:
- https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- https://cwe.mitre.org/
- https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
