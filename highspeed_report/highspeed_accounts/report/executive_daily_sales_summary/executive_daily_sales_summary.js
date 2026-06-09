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
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_executive_print_html(report.data, report.get_values());
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

function get_executive_print_html(data, filters) {
    let kpi_rows_html = '';
    let top_items_rows_html = '';
    
    let current_section = ''; // 'kpi' or 'items'
    
    data.forEach(row => {
        if (row.metric && row.metric.startsWith("---")) {
            if (row.metric.includes("Executive Summary")) {
                current_section = 'kpi';
            } else if (row.metric.includes("Top 5 Selling Items")) {
                current_section = 'items';
            }
            return;
        }
        
        if (current_section === 'kpi') {
            let change_color = '#2c3e50';
            if (row.change_percent.startsWith("+")) {
                change_color = '#27ae60';
            } else if (row.change_percent.startsWith("-")) {
                change_color = '#e74c3c';
            }
            
            kpi_rows_html += `
                <tr>
                    <td style="font-weight: bold; text-align: right;">${__(row.metric)}</td>
                    <td class="en-number" style="font-weight: bold; color: #2980b9;">${row.today_val}</td>
                    <td class="en-number" style="color: #7f8c8d;">${row.yesterday_val}</td>
                    <td class="en-number" style="color: ${change_color};">${row.change_val}</td>
                    <td class="en-number" style="font-weight: bold; color: ${change_color};">
                        ${row.change_percent.startsWith("+") ? '▲' : (row.change_percent.startsWith("-") ? '▼' : '')} ${row.change_percent}
                    </td>
                </tr>
            `;
        } else if (current_section === 'items') {
            top_items_rows_html += `
                <tr>
                    <td style="text-align: right; font-weight: bold;">${row.metric}</td>
                    <td class="en-number" style="font-weight: bold; color: #2980b9;">${row.today_val}</td>
                    <td class="en-number" style="font-weight: bold; color: #27ae60;">${row.yesterday_val}</td>
                </tr>
            `;
        }
    });

    const currentDate = frappe.datetime.get_today();
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>ملخص المبيعات اليومي للإدارة</title>
        <style>
            @page { size: A4 portrait; margin: 0.5cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; direction: rtl; font-size: 11px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .header-table td { border: none; text-align: center; }
            .header-table h3 { margin: 5px 0; font-size: 16px; }
            .header-table h4 { margin: 5px 0; font-size: 14px; color: #555; }
            .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .info-table td, .info-table th { border: 1px solid #ddd; padding: 5px; text-align: right; }
            .data-table td, .data-table th { border: 1px solid #ccc; padding: 8px 6px; text-align: center; }
            .data-table th { background-color: #f5f5f5; font-weight: bold; }
            .section-title { font-size: 13px; font-weight: bold; color: #2c3e50; margin: 15px 0 8px 0; padding-bottom: 3px; border-bottom: 2px solid #34495e; }
            .en-number { font-family: Arial, sans-serif !important; }
        </style>
    </head>
    <body>
        <div class="header-table">
            <table style="width: 100%; border: none;">
                <tr>
                    <td style="text-align: center;">
                        <h3>${filters.company || ""}</h3>
                        <h4>ملخص المبيعات اليومي للإدارة / Executive Daily Sales Summary</h4>
                    </td>
                </tr>
            </table>
        </div>
        <table class="info-table">
            <tr>
                <td style="font-weight: bold; width: 15%;">تاريخ التقرير / Date:</td>
                <td class="en-number" style="text-align: right;">${filters.posting_date || ""}</td>
                <td style="font-weight: bold; width: 15%;">تاريخ الطباعة:</td>
                <td class="en-number" style="text-align: right;">${currentDate}</td>
            </tr>
        </table>
        
        <div class="section-title">الملخص التنفيذي / Executive Summary</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>البيان / Particulars</th>
                    <th>اليوم / Today</th>
                    <th>الأمس / Yesterday</th>
                    <th>التغير / Change</th>
                    <th>نسبة التغير / Change %</th>
                </tr>
            </thead>
            <tbody>
                ${kpi_rows_html}
            </tbody>
        </table>

        <div class="section-title">أفضل 5 أصناف مبيعاً (اليوم) / Top 5 Selling Items (Today)</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>الصنف / Item</th>
                    <th>الكمية المباعة / Qty Sold</th>
                    <th>قيمة المبيعات / Sales Amount</th>
                </tr>
            </thead>
            <tbody>
                ${top_items_rows_html}
            </tbody>
        </table>
    </body>
    </html>
    `;
}
