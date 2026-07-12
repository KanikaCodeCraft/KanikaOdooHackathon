# 🚍 TransitOps — Odoo Hackathon '26

TransitOps is a comprehensive transit operations management system engineered for the Odoo Hackathon 2026. The platform is designed to bridge the gap between field logistics, safety compliance, and financial data analysis, providing an integrated workspace for transit organizations.

---

## 🚀 Key Features

* **Granular Role-Based Access Control (RBAC):** Customized dashboards and action restrictions tailored entirely to specific operational roles.
* **Relational State Management:** A robust backend database architecture designed to safely track system entities, operations, and logging metrics.
* **Audit-Ready Data Pipelines:** Seamless logging of operational actions for safety compliance and financial reconciliation.

---

## 🛠️ Tech Stack & Architecture

* **Backend & Database:** SQLite3 for lightweight, efficient, and zero-configuration relational storage.
* **Core Logic & Workflows:** Built with extensible schemas to allow swift integration with enterprise frameworks like Odoo.
* **Version Control:** Managed via Git and GitHub for seamless team collaboration.

---

## 👥 System Roles & Pre-Configured Users

To test permissions and evaluate system behaviors across different access levels, the database (`transitops.db`) is pre-populated with the following testing personas:

| User Email | Assigned Role | Primary System Focus |
| :--- | :--- | :--- |
| `abc@transitops.com` | **Fleet Manager** | Fleet tracking, driver dispatch, vehicle assignments |
| `sumit@transitops.com` | **Safety Officer** | Compliance audits, incident tracking, safety checks |
| `safety@transitops.com` | **Safety Officer** | Regulatory oversight and hazard reporting |
| `finance@transitops.com` | **Financial Analyst** | Operational cost auditing, budgeting, and financial logs |

---

## 📁 Project Structure

```text
├── transitops.db            # Central SQLite database file
├── Untitled design(1).mp4    # Comprehensive video walkthrough and platform demo
└── README.md                # Project documentation
