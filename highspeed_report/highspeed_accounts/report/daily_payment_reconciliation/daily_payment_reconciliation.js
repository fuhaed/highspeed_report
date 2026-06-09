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
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_payment_reco_print_html(report.data, report.get_values());
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

function get_payment_reco_print_html(data, filters) {
    let rows_html = '';
    let total_expected = 0;
    let total_received = 0;
    let total_diff = 0;
    
    data.forEach(row => {
        if (row.is_total_row) {
            return;
        }
        total_expected += parseFloat(row.expected_amount) || 0;
        total_received += parseFloat(row.received_amount) || 0;
        total_diff += parseFloat(row.difference) || 0;
        
        rows_html += `
            <tr>
                <td class="en-number">${row.posting_date || ""}</td>
                <td>${row.user || ""}</td>
                <td>${__(row.mode_of_payment || "")}</td>
                <td class="en-number">${frappe.format(row.expected_amount, {fieldtype: 'Currency'})}</td>
                <td class="en-number">${frappe.format(row.received_amount, {fieldtype: 'Currency'})}</td>
                <td class="en-number" style="color: ${row.difference < 0 ? '#e74c3c' : (row.difference > 0 ? '#e67e22' : '#2c3e50')}; font-weight: bold;">${frappe.format(row.difference, {fieldtype: 'Currency'})}</td>
                <td>${__(row.status || "")}</td>
            </tr>
        `;
    });
    
    rows_html += `
        <tr style="font-weight: bold; background-color: #f2f2f2;">
            <td colspan="3" style="text-align: center;">${__("Total / الإجمالي")}</td>
            <td class="en-number">${frappe.format(total_expected, {fieldtype: 'Currency'})}</td>
            <td class="en-number">${frappe.format(total_received, {fieldtype: 'Currency'})}</td>
            <td class="en-number" style="color: ${total_diff < 0 ? '#e74c3c' : (total_diff > 0 ? '#e67e22' : '#2c3e50')}; font-weight: bold;">${frappe.format(total_diff, {fieldtype: 'Currency'})}</td>
            <td></td>
        </tr>
    `;
    
    const currentDate = frappe.datetime.get_today();
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>مطابقة المدفوعات اليومية</title>
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
                        <h4>تقرير مطابقة المدفوعات اليومية / Daily Payment Reconciliation Report</h4>
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
                    <th>التاريخ / Date</th>
                    <th>الصراف / User</th>
                    <th>طريقة الدفع / Payment Mode</th>
                    <th>المبلغ المتوقع / Expected</th>
                    <th>المبلغ المستلم / Received</th>
                    <th>الفارق / Difference</th>
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
