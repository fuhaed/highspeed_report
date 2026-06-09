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
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_profitability_print_html(report.data, report.get_values());
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

function get_profitability_print_html(data, filters) {
    let rows_html = '';
    let total_row = null;
    
    data.forEach(row => {
        if (row.is_total_row) {
            total_row = row;
            return;
        }
        rows_html += `
            <tr>
                <td>${row.item_code || ""}</td>
                <td style="text-align: right;">${row.item_name || ""}</td>
                <td>${row.item_group || ""}</td>
                <td>${row.stock_uom || ""}</td>
                <td class="en-number">${row.qty || 0}</td>
                <td class="en-number">${frappe.format(row.sales_amount, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${frappe.format(row.cogs, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${frappe.format(row.gross_profit, {fieldtype: 'Currency'})}</td>
                <td class="en-number" style="color: ${row.margin_percentage < 5 ? '#e74c3c' : (row.margin_percentage < 15 ? '#e67e22' : '#27ae60')}; font-weight: bold;">${(row.margin_percentage || 0).toFixed(2)}%</td>
            </tr>
        `;
    });
    
    if (total_row) {
        rows_html += `
            <tr style="font-weight: bold; background-color: #f2f2f2;">
                <td colspan="4" style="text-align: center;">${__("Total / الإجمالي")}</td>
                <td class="en-number">${total_row.qty || 0}</td>
                <td class="en-number">${frappe.format(total_row.sales_amount, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${frappe.format(total_row.cogs, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${frappe.format(total_row.gross_profit, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${(total_row.margin_percentage || 0).toFixed(2)}%</td>
            </tr>
        `;
    }
    
    const currentDate = frappe.datetime.get_today();
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>تقرير أرباح المنتجات</title>
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
                        <h3>${filters.company || ""}</h3>
                        <h4>تقرير أرباح المنتجات المبسط / Product Profitability Report</h4>
                    </td>
                </tr>
            </table>
        </div>
        <table class="info-table">
            <tr>
                <td style="font-weight: bold; width: 15%;">الفترة / Period:</td>
                <td class="en-number" style="text-align: right;">${filters.from_date || ""} إلى ${filters.to_date || ""}</td>
                <td style="font-weight: bold; width: 15%;">تاريخ الطباعة:</td>
                <td class="en-number" style="text-align: right;">${currentDate}</td>
            </tr>
        </table>
        <table class="data-table">
            <thead>
                <tr>
                    <th>كود الصنف / Code</th>
                    <th>اسم الصنف / Name</th>
                    <th>المجموعة / Group</th>
                    <th>الوحدة / UOM</th>
                    <th>الكمية / Qty</th>
                    <th>المبيعات / Sales</th>
                    <th>التكلفة / Cost</th>
                    <th>الربح / Profit</th>
                    <th>الهامش / Margin</th>
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
