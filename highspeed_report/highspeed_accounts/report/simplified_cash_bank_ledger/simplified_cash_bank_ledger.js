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
            return `<span style="color: #27ae60; font-weight: bold;">+${default_formatter(value, row, column, data)}</span>`;
        }

        if (column.fieldname === "credit" && parseFloat(value) > 0) {
            return `<span style="color: #e74c3c; font-weight: bold;">-${default_formatter(value, row, column, data)}</span>`;
        }

        if (column.fieldname === "balance") {
            const bal = parseFloat(value) || 0;
            let val = default_formatter(value, row, column, data);
            if (bal < 0) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            }
            return `<span style="color: #2c3e50; font-weight: bold;">${val}</span>`;
        }

        if (data.is_total_row) {
            return `<span style="font-weight: bold; background-color: #f8fafc; padding: 2px;">${default_formatter(value, row, column, data)}</span>`;
        }

        return default_formatter(value, row, column, data);
    }
};
