// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Simplified Product Profitability"] = {
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
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group",
            "width": "150px"
        },
        {
            "fieldname": "warehouse",
            "label": __("Warehouse"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    "filters": {
                        "company": company,
                        "is_group": 0
                    }
                };
            },
            "width": "150px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (column.fieldname === "margin_percentage") {
            const margin = parseFloat(value) || 0;
            let val = default_formatter(value, row, column, data);
            
            if (margin < 5) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            } else if (margin < 15) {
                return `<span style="color: #e67e22; font-weight: bold;">${val}</span>`;
            } else {
                return `<span style="color: #27ae60; font-weight: bold;">${val}</span>`;
            }
        }

        if (column.fieldname === "gross_profit") {
            const profit = parseFloat(value) || 0;
            let val = default_formatter(value, row, column, data);
            if (profit < 0) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            } else if (profit > 0) {
                return `<span style="color: #27ae60; font-weight: bold;">${val}</span>`;
            }
        }

        if (data.is_total_row) {
            return `<span style="font-weight: bold; background-color: #f8fafc; padding: 2px;">${default_formatter(value, row, column, data)}</span>`;
        }

        return default_formatter(value, row, column, data);
    }
};
