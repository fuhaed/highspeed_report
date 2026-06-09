// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Simplified Cash Bank Ledger"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
            "reqd": 1,
            "width": "200px"
        },
        {
            "fieldname": "account",
            "label": __("Account"),
            "fieldtype": "Link",
            "options": "Account",
            "reqd": 1,
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    "filters": {
                        "company": company,
                        "is_group": 0,
                        "account_type": ["in", ["Bank", "Cash"]]
                    }
                };
            },
            "width": "200px"
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            "reqd": 1,
            "width": "100px"
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1,
            "width": "100px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (data.remarks && data.remarks.includes("Opening Balance")) {
            return `<span style="font-weight: bold; color: #34495e; background-color: #f1f2f6; padding: 2px 4px; display: block; border-radius: 3px;">${default_formatter(value, row, column, data)}</span>`;
        }

        if (column.fieldname === "debit" && parseFloat(value) > 0) {
            let formatted = default_formatter(value, row, column, data);
            if (formatted && formatted.includes("<div")) {
                formatted = $(formatted).text().trim();
            }
            return `<div style="text-align: right; color: #27ae60; font-weight: bold;">+${formatted}</div>`;
        }

        if (column.fieldname === "credit" && parseFloat(value) > 0) {
            let formatted = default_formatter(value, row, column, data);
            if (formatted && formatted.includes("<div")) {
                formatted = $(formatted).text().trim();
            }
            return `<div style="text-align: right; color: #e74c3c; font-weight: bold;">-${formatted}</div>`;
        }

        if (column.fieldname === "balance") {
            const bal = parseFloat(value) || 0;
            let formatted = default_formatter(value, row, column, data);
            if (formatted && formatted.includes("<div")) {
                formatted = $(formatted).text().trim();
            }
            const color = bal < 0 ? "#e74c3c" : "#2c3e50";
            return `<div style="text-align: right; color: ${color}; font-weight: bold;">${formatted}</div>`;
        }

        if (data.is_total_row) {
            return `<span style="font-weight: bold; background-color: #f8fafc; padding: 2px;">${default_formatter(value, row, column, data)}</span>`;
        }

        return default_formatter(value, row, column, data);
    }
};
