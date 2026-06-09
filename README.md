# Highspeed Custom Reports App

An advanced and feature-rich ERPNext reporting extension designed for High Speed retail, inventory, and accounting workflows. This app optimizes operational visibility by providing robust, performant custom reports for stocks, point of sales (POS), accounting transactions, tax reporting, and barcode management.

---

## 🌟 Key Features & Reports

### 📦 Highspeed Stock & Inventory Reports
*   **Simple Items Barcode:** Generate barcodes for stock items, with dedicated inline buttons to print standard labels and individual barcode strips dynamically.
*   **Daily Inventory Movement:** Track day-to-day changes in inventory quantities across warehouses.
*   **Item Movement Report:** Detailed lifecycle tracking of individual items.
*   **Item Price Comparison:** Compare rates across different price lists.
*   **Item Stock Balance:** Instant overview of available stock and valuations.
*   **Slow Moving Items:** Identify stagnant inventory to optimize carrying costs.

### 💰 Highspeed Accounts & Sales Reports
*   **Tax & VAT Declaration:** Highly accurate tax declarations compliant with regional accounting regulations.
*   **POS Sales & Registers:** In-depth breakdown of POS sales registers, opening/closing reports, and payment mode splits.
*   **Customer & Supplier Statements:** Professional-grade statements for tracking balances, payments, and outstanding invoices.
*   **Sales Invoice Payment Breakdown:** Insightful details on payment modes (Cash, Card, Online, Credit) per sales invoice.
*   **Simple & Detailed Sales Logs:** Comprehensive records of general sales registers and purchase registers.

---

## 🚀 Installation & Setup

Install this app on your Frappe bench with the following commands:

```bash
cd /path/to/frappe-bench
bench get-app https://github.com/fuhaed/highspeed_report.git
bench --site [your-site-name] install-app highspeed_report
```

---

## 🛠️ Development & Contribution

We use standard formatting and linting tools via `pre-commit` to maintain code health.

### Setup hooks:
```bash
cd apps/highspeed_report
pre-commit install
```

The repository is configured to check code using:
*   **Ruff:** Python code styling & quality.
*   **ESLint:** JavaScript code quality.
*   **Prettier:** JavaScript and CSS formatting.

---

## 📄 License

This application is released under the [MIT License](license.txt).
