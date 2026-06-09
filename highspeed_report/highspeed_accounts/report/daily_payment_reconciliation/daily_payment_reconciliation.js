// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Daily Payment Reconciliation"] = {
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
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (column.fieldname === "difference") {
            const diff = parseFloat(value) || 0;
            let val = default_formatter(value, row, column, data);
            
            if (diff < 0) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            } else if (diff > 0) {
                return `<span style="color: #e67e22; font-weight: bold;">${val}</span>`;
            }
            return `<span style="color: #95a5a6;">${val}</span>`;
        }

        if (column.fieldname === "status" && value) {
            let color = "#2c3e50";
            let bg = "#f1f2f6";
            if (value.includes("POS Session") || value.includes("Custom Shift")) {
                color = "#2980b9";
                bg = "#e8f4fd";
            } else if (value.includes("Direct")) {
                color = "#27ae60";
                bg = "#e8f8f0";
            }
            return `<span style="color: ${color}; background-color: ${bg}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">${__(value)}</span>`;
        }

        if (data.is_total_row) {
            return `<span style="font-weight: bold; background-color: #f8fafc; padding: 2px;">${default_formatter(value, row, column, data)}</span>`;
        }

        return default_formatter(value, row, column, data);
    }
};
