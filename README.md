# Government Pension Calculator — Prototype

An HTML prototype for the Government of Barbados pension calculator, built to alpha.gov.bb design standards.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Start page — describes the tool, what users need, and eligibility rules |
| `calculate.html` | Calculator page — accepts inputs and displays estimated pension figures |

## What it calculates

Given **months of pensionable service** and **last annual salary (BDS$)**, the calculator outputs:

- **Full pension** — annual and monthly amounts `(months ÷ 600) × salary`
- **Reduced pension** — 75% of full pension, paid monthly
- **Gratuity (lump sum)** — `(full pension ÷ 4) × 12.5`

Results are estimates only. Actual entitlement is confirmed by the People Resourcing and Compliance Directorate (PRCD) and the pensioner's last employer.

## Dependencies

The prototype links to shared assets (not included in this folder):

- `styles.css` — gov.bb design system styles
- `comments.css` / `comments.js` — prototype annotation layer
- `assets/images/` — gov.bb logo, crest, and favicon

## Key content rules (from NISSS guidance)

- No-pay leave is deducted from pensionable service.
- Employees with fewer than 5 years' service receive no pension and no gratuity.
- Employees with more than 5 but fewer than 10 years' service do not qualify for a pension but may be eligible for an ex-gratia award.
- Employees with 10 or more years qualify for a full pension.
- Officers who joined before 1 September 1975 receive both government and NI pensions in full. Those who joined on or after that date receive the higher of the two.

## Sources

- [Pension Calculations — Treasury of Barbados](https://treasury.gov.bb/content/pension-calculations)
- Pensions (Miscellaneous Provisions) Act, 1975-31
- National Insurance and Social Security Act, Cap 47
- Pensions Acts, Caps 25, 30 and 56
