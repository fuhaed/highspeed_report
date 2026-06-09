// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Executive Daily Sales Summary"] = {
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
            "fieldname": "posting_date",
            "label": __("Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1,
            "width": "120px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (column.fieldname === "metric" && value) {
            if (value.startsWith("---")) {
                var clean_val = value.replace(/---/g, '').trim();
                return '<span style="font-weight: bold; font-size: 1.15em; color: #2c3e50; background-color: #f1f5f9; padding: 6px 12px; display: block; border-radius: 4px; border-inline-start: 4px solid #475569;">' + 
                        __(clean_val) + 
                       '</span>';
            }
            return __(value);
        }

        // Color coding for KPI changes
        if (column.fieldname === "change_percent" && value) {
            if (value.startsWith("+")) {
                return `<span style="color: #27ae60; font-weight: bold;">▲ ${value}</span>`;
            } else if (value.startsWith("-")) {
                return `<span style="color: #e74c3c; font-weight: bold;">▼ ${value}</span>`;
            }
        }

        if (column.fieldname === "change_val" && value) {
            if (value.startsWith("+")) {
                return `<span style="color: #27ae60; font-weight: bold;">${value}</span>`;
            } else if (value.startsWith("-")) {
                return `<span style="color: #e74c3c; font-weight: bold;">${value}</span>`;
            }
        }

        // For top selling items, style helper text labels
        if (data.metric && data.metric.startsWith("#")) {
            if (column.fieldname === "change_val" || column.fieldname === "change_percent") {
                return `<span style="color: #7f8c8d; background-color: #f5f6fa; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${__(value)}</span>`;
            }
            if (column.fieldname === "today_val") {
                return `<span style="font-weight: bold; color: #2980b9;">${value}</span>`;
            }
            if (column.fieldname === "yesterday_val") {
                return `<span style="font-weight: bold; color: #27ae60;">${value}</span>`;
            }
        }

        return default_formatter(value, row, column, data);
    }
};
