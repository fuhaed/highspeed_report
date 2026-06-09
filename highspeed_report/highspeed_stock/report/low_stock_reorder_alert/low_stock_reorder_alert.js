// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Low Stock Reorder Alert"] = {
    "filters": [
        {
            "fieldname": "warehouse",
            "label": __("Warehouse"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": "180px"
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group",
            "width": "180px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (column.fieldname === "actual_qty") {
            const qty = parseFloat(value) || 0;
            let val = default_formatter(value, row, column, data);
            if (qty <= 0) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            }
        }

        if (column.fieldname === "status" && value) {
            let color = "#ef4444";
            let bg = "#fef2f2";
            if (value === __("Low Stock") || value === "Low Stock") {
                color = "#f59e0b";
                bg = "#fef3c7";
            }
            return `<span style="color: ${color}; background-color: ${bg}; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">${__(value)}</span>`;
        }

        return default_formatter(value, row, column, data);
    }
};
