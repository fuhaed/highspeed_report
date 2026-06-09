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
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_ledger_print_html(report.data, report.get_values());
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

function get_ledger_print_html(data, filters) {
    let rows_html = '';
    let opening_row = null;
    let entries = [];
    
    data.forEach(row => {
        if (row.is_total_row) {
            return;
        }
        if (row.remarks && row.remarks.includes("Opening Balance")) {
            opening_row = row;
        } else {
            entries.push(row);
        }
    });

    if (opening_row) {
        rows_html += `
            <tr style="font-weight: bold; background-color: #f8fafc;">
                <td class="en-number">${opening_row.posting_date || ""}</td>
                <td></td>
                <td></td>
                <td>${__(opening_row.remarks || "")}</td>
                <td></td>
                <td></td>
                <td class="en-number" style="text-align: right; font-weight: bold;">${frappe.format(opening_row.balance, {fieldtype: 'Currency'})}</td>
            </tr>
        `;
    }

    let total_debit = 0;
    let total_credit = 0;

    entries.forEach(row => {
        const debit_val = parseFloat(row.debit) || 0;
        const credit_val = parseFloat(row.credit) || 0;
        total_debit += debit_val;
        total_credit += credit_val;

        const debit_formatted = debit_val > 0 ? `+${frappe.format(row.debit, {fieldtype: 'Currency'})}` : '';
        const credit_formatted = credit_val > 0 ? `-${frappe.format(row.credit, {fieldtype: 'Currency'})}` : '';
        const bal_color = (parseFloat(row.balance) || 0) < 0 ? '#e74c3c' : '#2c3e50';

        rows_html += `
            <tr>
                <td class="en-number">${row.posting_date || ""}</td>
                <td>${__(row.voucher_type || "")}</td>
                <td>${row.voucher_no || ""}</td>
                <td style="text-align: right;">${row.remarks || ""}</td>
                <td class="en-number" style="color: #27ae60; font-weight: bold; text-align: right;">${debit_formatted}</td>
                <td class="en-number" style="color: #e74c3c; font-weight: bold; text-align: right;">${credit_formatted}</td>
                <td class="en-number" style="color: ${bal_color}; font-weight: bold; text-align: right;">${frappe.format(row.balance, {fieldtype: 'Currency'})}</td>
            </tr>
        `;
    });

    const closing_balance = data.length > 0 ? data[data.length - 1].balance : 0;
    const op_val = opening_row ? opening_row.balance : 0;

    rows_html += `
        <tr style="font-weight: bold; background-color: #f2f2f2;">
            <td colspan="4" style="text-align: center;">${__("Total / الإجمالي")}</td>
            <td class="en-number" style="color: #27ae60; font-weight: bold; text-align: right;">+${frappe.format(total_debit, {fieldtype: 'Currency'})}</td>
            <td class="en-number" style="color: #e74c3c; font-weight: bold; text-align: right;">-${frappe.format(total_credit, {fieldtype: 'Currency'})}</td>
            <td class="en-number" style="text-align: right;">${frappe.format(closing_balance, {fieldtype: 'Currency'})}</td>
        </tr>
    `;

    const currentDate = frappe.datetime.get_today();
    return `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>دفتر الصندوق والبنك المبسط</title>
        <style>
            @page { size: A4 landscape; margin: 0.5cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; direction: rtl; font-size: 11px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .header-table td { border: none; text-align: center; }
            .header-table h3 { margin: 5px 0; font-size: 16px; }
            .header-table h4 { margin: 5px 0; font-size: 14px; color: #555; }
            .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .info-table td, .info-table th { border: 1px solid #ddd; padding: 5px; text-align: right; }
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .summary-table td { border: 1px solid #ccc; padding: 8px; text-align: center; }
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
                        <h4>دفتر الصندوق والبنك المبسط / Cash & Bank Ledger Report</h4>
                    </td>
                </tr>
            </table>
        </div>
        <table class="info-table">
            <tr>
                <td style="font-weight: bold; width: 15%;">الحساب / Account:</td>
                <td style="text-align: right;">${filters.account || ""}</td>
                <td style="font-weight: bold; width: 15%;">الفترة / Period:</td>
                <td class="en-number" style="text-align: right;">${filters.from_date || ""} إلى ${filters.to_date || ""}</td>
                <td style="font-weight: bold; width: 15%;">تاريخ الطباعة:</td>
                <td class="en-number" style="text-align: right;">${currentDate}</td>
            </tr>
        </table>
        
        <table class="summary-table">
            <tr style="background-color: #f8fafc; font-weight: bold;">
                <td>الرصيد الافتتاحي<br>Opening Balance</td>
                <td>إجمالي الوارد (مدين)<br>Total Inflow (Debit)</td>
                <td>إجمالي الصادر (دائن)<br>Total Outflow (Credit)</td>
                <td>الرصيد الختامي<br>Closing Balance</td>
            </tr>
            <tr>
                <td class="en-number" style="font-weight: bold; color: #2980b9;">${frappe.format(op_val, {fieldtype: 'Currency'})}</td>
                <td class="en-number" style="font-weight: bold; color: #27ae60;">+${frappe.format(total_debit, {fieldtype: 'Currency'})}</td>
                <td class="en-number" style="font-weight: bold; color: #e74c3c;">-${frappe.format(total_credit, {fieldtype: 'Currency'})}</td>
                <td class="en-number" style="font-weight: bold; color: ${closing_balance < 0 ? '#e74c3c' : '#2c3e50'};">${frappe.format(closing_balance, {fieldtype: 'Currency'})}</td>
            </tr>
        </table>

        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 10%;">التاريخ / Date</th>
                    <th style="width: 15%;">نوع السند / Voucher Type</th>
                    <th style="width: 15%;">رقم السند / Voucher No</th>
                    <th style="width: 30%;">البيان / Particulars</th>
                    <th style="width: 10%;">الوارد (مدين) / In</th>
                    <th style="width: 10%;">الصادر (دائن) / Out</th>
                    <th style="width: 10%;">الرصيد / Balance</th>
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
