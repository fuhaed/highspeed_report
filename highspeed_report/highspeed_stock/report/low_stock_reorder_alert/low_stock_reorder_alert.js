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
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_low_stock_print_html(report.data, report.get_values());
                var w = window.open();
                if (w) {
                    w.document.write(html);
                    w.document.close();
                    setTimeout(function() {
                        w.print();
                    }, 500);
                } else {
                    frappe.msgprint(__("تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير."));
                }
            } else {
                frappe.msgprint(__("لا توجد بيانات لعرضها."));
            }
        });
    }
};

function get_low_stock_print_html(data, filters) {
    let rows_html = '';
    
    data.forEach(row => {
        rows_html += `
            <tr>
                <td>${row.item_code || ""}</td>
                <td style="text-align: right;">${row.item_name || ""}</td>
                <td>${row.item_group || ""}</td>
                <td>${row.warehouse || ""}</td>
                <td class="en-number">${frappe.format(row.actual_qty, {fieldtype: 'Float'})}</td>
                <td class="en-number">${frappe.format(row.reorder_level, {fieldtype: 'Float'})}</td>
                <td class="en-number">${frappe.format(row.reorder_qty, {fieldtype: 'Float'})}</td>
                <td class="en-number" style="color: #e74c3c; font-weight: bold;">${frappe.format(row.shortage_qty, {fieldtype: 'Float'})}</td>
                <td>
                    <span style="color: ${row.status === "Low Stock" || row.status === __("Low Stock") ? '#f59e0b' : '#ef4444'}; font-weight: bold;">
                        ${__(row.status || "")}
                    </span>
                </td>
            </tr>
        `;
    });
    
    const currentDate = frappe.datetime.get_today();
    const company = frappe.defaults.get_user_default("Company") || "";
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تقرير تنبيهات انخفاض المخزون</title>
        <style>
            @page { size: A4 landscape; margin: 0.5cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; direction: rtl; font-size: 11px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .header-table td { border: none; text-align: center; }
            .header-table h3 { margin: 5px 0; font-size: 16px; }
            .header-table h4 { margin: 5px 0; font-size: 14px; color: #555; }
            .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .info-table td, .info-table th { border: 1px solid #ddd; padding: 5px; text-align: right; }
            .data-table td, .data-table th { border: 1px solid #ccc; padding: 6px 4px; text-align: center; }
            .data-table th { background-color: #f5f5f5; font-weight: bold; }
            .data-table td { font-size: 10px; }
            .en-number { font-family: Arial, sans-serif !important; }
        </style>
    </head>
    <body>
        <div class="header-table">
            <table style="width: 100%; border: none;">
                <tr>
                    <td style="text-align: center;">
                        <h3>${company}</h3>
                        <h4>تقرير تنبيهات انخفاض المخزون / Low Stock Reorder Alert Report</h4>
                    </td>
                </tr>
            </table>
        </div>
        <table class="info-table">
            <tr>
                <td style="font-weight: bold; width: 15%;">المستودع / Warehouse:</td>
                <td style="text-align: right;">${filters.warehouse || __("All / الكل")}</td>
                <td style="font-weight: bold; width: 15%;">مجموعة الصنف / Item Group:</td>
                <td style="text-align: right;">${filters.item_group || __("All / الكل")}</td>
                <td style="font-weight: bold; width: 15%;">تاريخ الطباعة:</td>
                <td class="en-number" style="text-align: right;">${currentDate}</td>
            </tr>
        </table>
        <table class="data-table">
            <thead>
                <tr>
                    <th>كود الصنف / Item Code</th>
                    <th>اسم الصنف / Item Name</th>
                    <th>مجموعة الصنف / Item Group</th>
                    <th>المستودع / Warehouse</th>
                    <th>الكمية الحالية / Actual Qty</th>
                    <th>حد الطلب / Reorder Level</th>
                    <th>كمية إعادة الطلب / Reorder Qty</th>
                    <th>كمية النقص / Shortage Qty</th>
                    <th>الحالة / Status</th>
                </tr>
            </thead>
            <tbody>
                ${rows_html}
            </tbody>
        </table>
    </body>
    </html>
    `;
}
