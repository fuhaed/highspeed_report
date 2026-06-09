// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["POS Opening Closing Report"] = {
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
            "label": __("من تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            "reqd": 1,
            "width": "100px" 
        },
        {
            "fieldname": "to_date",
            "label": __("إلى تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1,
            "width": "100px"
        },
        {
            "fieldname": "pos_profile",
            "label": __("صالة البيع"),
            "fieldtype": "Link",
            "options": "POS Profile",
            "width": "200px"
        },
        {
            "fieldname": "user",
            "label": __("المستخدم"),
            "fieldtype": "Link",
            "options": "User",
            "width": "200px",
            "get_query": function() {
                return {
                    "filters": {
                        "enabled": 1,
                        "user_type": ["!=", "Website User"]
                    }
                };
            }
        },
        {
            "fieldname": "status",
            "label": __("حالة الجلسة"),
            "fieldtype": "Select",
            "options": "\nOpen\nClosed",
            "width": "150px"
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        if (column.fieldname === "difference") {
            const diff = parseFloat(data.difference) || 0;
            let val = default_formatter(value, row, column, data);
            if (diff < 0) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            } else if (diff > 0) {
                return `<span style="color: #27ae60; font-weight: bold;">${val}</span>`;
            }
            return val;
        }

        if (column.fieldname === "difference_percentage") {
            const percent = parseFloat(data.difference_percentage) || 0;
            let val = default_formatter(value, row, column, data);
            if (percent < -5) {
                return `<span style="color: #e74c3c; font-weight: bold;">${val}</span>`;
            } else if (percent > 5) {
                return `<span style="color: #e67e22; font-weight: bold;">${val}</span>`;
            }
            return val;
        }

        if (!data || !value) {
            if (column.fieldname === "net_total" || column.fieldname === "total_taxes" || column.fieldname === "grand_total") {
                return '<span style="color: #888;">0.00</span>';
            }
            return default_formatter(value, row, column, data);
        }
        
        // تنسيق لحالة الجلسة - مع ترميز اللون
        if (column.fieldname === "status") {
            let color = "black";
            let bg_color = "transparent";
            
            switch(value) {
                case "مفتوح":
                case "Open":
                    color = "green";
                    bg_color = "#e8f5e8";
                    break;
                case "مغلق":
                case "Closed":
                    color = "blue";
                    bg_color = "#e8f0ff";
                    break;
                case "مسودة":
                case "Draft":
                    color = "orange";
                    bg_color = "#fff3e0";
                    break;
                case "ملغي":
                case "Cancelled":
                    color = "red";
                    bg_color = "#ffebee";
                    break;
                case "مرحل":
                case "Submitted":
                    color = "green";
                    bg_color = "#e8f5e8";
                    break;
            }
            
            return `<span style="color: ${color}; background-color: ${bg_color}; padding: 2px 6px; border-radius: 3px; font-weight: bold;">${value}</span>`;
        }
        
        // تنسيق للمبالغ النقدية
        if (column.fieldname === "net_total" || column.fieldname === "total_taxes" || column.fieldname === "grand_total") {
            if (value === null || value === undefined || value === 0) {
                return '<span style="color: #888;">0.00</span>';
            }
            value = default_formatter(value, row, column, data);
            return '<span style="font-weight: bold; font-family: monospace;">' + value + '</span>';
        }
        
        // تنسيق لعدد الفواتير
        if (column.fieldname === "total_quantity") {
            if (!value || value === 0) {
                return '<span style="color: #888;">0</span>';
            }
            return '<span style="font-weight: bold; color: #2196F3;">' + value + '</span>';
        }
        
        // تنسيق التواريخ والأوقات
        if (column.fieldname === "period_start_date" || column.fieldname === "period_end_date") {
            if (!value) return '<span style="color: #888;">-</span>';
            
            // تنسيق التاريخ والوقت
            let formatted_datetime = moment(value).format('YYYY-MM-DD HH:mm');
            return '<span style="direction: ltr; font-family: monospace;">' + formatted_datetime + '</span>';
        }
        
        // تنسيق أساسي للإجماليات
        if (data.is_total_row) {
            if (column.fieldname === "pos_profile") {
                return '<span style="font-weight: bold; font-size: 14px; color: #1976D2;">' + value + '</span>';
            }
            return '<span style="font-weight: bold; background-color: #f5f5f5; padding: 2px;">' + default_formatter(value, row, column, data) + '</span>';
        }
        
        return default_formatter(value, row, column, data);
    },
    
    // إضافة أزرار عند تحميل التقرير
    onload: function(report) {
        // التأكد من وجود الصفحة قبل إضافة الأزرار
        if (!report || !report.page) {
            return;
        }
        
        // إضافة زر طباعة منسقة للتقرير
        report.page.add_inner_button(__("Print Report"), function() {
            const is_custom = report.columns.some(col => col.fieldname === "opening_shift");
            if (is_custom) {
                print_custom_report(report);
            } else {
                print_pos_opening_closing_report(report);
            }
        });
        
        // إضافة زر لفتح جلسة نقطة بيع جديدة
        report.page.add_inner_button(__("فتح جلسة جديدة"), function() {
            frappe.new_doc("POS Opening Entry");
        });
        
        // إضافة زر تصدير Excel
        report.page.add_inner_button(__("تصدير Excel"), function() {
            export_pos_report_to_excel(report);
        });
    }
};

// وظيفة الطباعة المنسقة
function print_pos_opening_closing_report(report) {
    if (!report || !report.data || !report.data.length) {
        frappe.msgprint(__("لا توجد بيانات للطباعة"));
        return;
    }
    
    const filters = report.get_values() || {};
    const data = report.data;
    const columns = report.columns;
    
    // تحضير محتوى HTML
    const dateFormat = (datetime) => {
        if (!datetime) return '';
        return moment(datetime).format('YYYY-MM-DD HH:mm');
    };
    
    // بداية محتوى HTML للطباعة
    let print_html = `
        <style>
            @media print {
                .print-format {
                    padding: 0mm;
                    font-size: 11px;
                }
                body { margin: 15mm; }
            }
            .print-format {
                padding: 15px;
                direction: rtl;
                font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            }
            .print-heading {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 15px;
                text-align: center;
                color: #1976D2;
                border-bottom: 2px solid #1976D2;
                padding-bottom: 10px;
            }
            .company-info {
                margin-bottom: 20px;
                text-align: center;
                font-size: 16px;
                font-weight: bold;
            }
            .filters-section {
                margin-bottom: 20px;
                border: 1px solid #ddd;
                padding: 15px;
                border-radius: 8px;
                background-color: #f9f9f9;
            }
            .filter-item {
                display: inline-block;
                margin-left: 20px;
                margin-bottom: 8px;
            }
            .filter-label {
                font-weight: bold;
                color: #333;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                direction: rtl;
                margin-top: 10px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: center;
                font-size: 11px;
            }
            th {
                background-color: #1976D2;
                color: white;
                font-weight: bold;
            }
            .total-row td {
                font-weight: bold;
                background-color: #e3f2fd;
                color: #1976D2;
            }
            .status-open {
                color: green;
                font-weight: bold;
                background-color: #e8f5e8;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .status-closed {
                color: blue;
                font-weight: bold;
                background-color: #e8f0ff;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .status-draft {
                color: orange;
                font-weight: bold;
                background-color: #fff3e0;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .currency {
                font-family: monospace;
                font-weight: bold;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 10px;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 10px;
            }
        </style>
        
        <div class="print-format">
            <div class="print-heading">تقرير جلسات نقاط البيع</div>
            <div class="company-info">
                <div class="company-name">${filters.company || 'جميع الشركات'}</div>
            </div>
            
            <div class="filters-section">
                <div class="filter-item">
                    <span class="filter-label">الفترة:</span>
                    <span>${frappe.datetime.str_to_user(filters.from_date)} إلى ${frappe.datetime.str_to_user(filters.to_date)}</span>
                </div>
                ${filters.pos_profile ? `
                <div class="filter-item">
                    <span class="filter-label">صالة البيع:</span>
                    <span>${filters.pos_profile}</span>
                </div>` : ''}
                ${filters.user ? `
                <div class="filter-item">
                    <span class="filter-label">المستخدم:</span>
                    <span>${filters.user}</span>
                </div>` : ''}
                ${filters.status ? `
                <div class="filter-item">
                    <span class="filter-label">الحالة:</span>
                    <span>${filters.status === 'Open' ? 'مفتوح' : 'مغلق'}</span>
                </div>` : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>م.</th>
                        <th>تاريخ الفتح</th>
                        <th>تاريخ الإغلاق</th>
                        <th>رقم الجلسة</th>
                        <th>صالة البيع</th>
                        <th>المستخدم</th>
                        <th>الحالة</th>
                        <th>عدد الفواتير</th>
                        <th>المبلغ بدون ضريبة</th>
                        <th>الضرائب</th>
                        <th>المبلغ مع الضريبة</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // إضافة صفوف البيانات
    data.forEach((row, index) => {
        if (row.is_total_row) {
            print_html += `
                <tr class="total-row">
                    <td colspan="7" style="text-align: right; font-size: 14px;">الإجمالي العام</td>
                    <td class="currency">${row.total_quantity || 0}</td>
                    <td class="currency">${formatCurrency(row.net_total)}</td>
                    <td class="currency">${formatCurrency(row.total_taxes)}</td>
                    <td class="currency">${formatCurrency(row.grand_total)}</td>
                </tr>
            `;
        } else {
            // تحديد كلاس حالة الجلسة
            let statusClass = '';
            let statusText = row.status;
            switch(row.status) {
                case "مفتوح": statusClass = "status-open"; break;
                case "مغلق": statusClass = "status-closed"; break;
                case "مسودة": statusClass = "status-draft"; break;
            }
            
            print_html += `
                <tr>
                    <td>${index + 1}</td>
                    <td style="direction: ltr;">${dateFormat(row.period_start_date)}</td>
                    <td style="direction: ltr;">${dateFormat(row.period_end_date) || '-'}</td>
                    <td>${row.name || ''}</td>
                    <td>${row.pos_profile || ''}</td>
                    <td>${row.user || ''}</td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${row.total_quantity || 0}</td>
                    <td class="currency">${formatCurrency(row.net_total)}</td>
                    <td class="currency">${formatCurrency(row.total_taxes)}</td>
                    <td class="currency">${formatCurrency(row.grand_total)}</td>
                </tr>
            `;
        }
    });
    
    // إغلاق محتوى HTML
    print_html += `
                </tbody>
            </table>
            
            <div class="footer">
                تم إنشاء هذا التقرير في ${moment().format('YYYY-MM-DD HH:mm')} بواسطة ${frappe.session.user_fullname || frappe.session.user}
            </div>
        </div>
    `;
    
    // فتح نافذة الطباعة
    try {
        const w = window.open();
        if (w) {
            w.document.write(`
                <html>
                    <head>
                        <title>تقرير جلسات نقاط البيع</title>
                        <meta charset="utf-8">
                    </head>
                    <body>
                        ${print_html}
                        <script>
                            window.onload = function() {
                                window.print();
                                window.onfocus = function() { 
                                    setTimeout(function() { window.close(); }, 500);
                                }
                            }
                        </script>
                    </body>
                </html>
            `);
        } else {
            frappe.msgprint(__("تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة."));
        }
    } catch (e) {
        frappe.msgprint(__("حدث خطأ أثناء فتح نافذة الطباعة"));
        console.error("Print error:", e);
    }
}

// وظيفة طباعة التقرير المخصص (POSAwesome Layout)
function print_custom_report(report) {
    const data = frappe.query_report.data || [];
    const columns = frappe.query_report.columns || [];
    const filters = report.get_values();
    const company = filters.company || frappe.defaults.get_user_default("company");
    const from_date = filters.from_date;
    const to_date = filters.to_date;
    const show_details = filters.show_payment_details;

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${__("POS Opening Closing Report")}</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 10mm;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #2c3e50;
                    background: #fff;
                    direction: rtl;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #3498db;
                    padding-bottom: 20px;
                }
                
                .header h1 {
                    margin: 0;
                    color: #2c3e50;
                    font-size: 28px;
                    font-weight: 600;
                }
                
                .header h2 {
                    margin: 10px 0 0 0;
                    color: #3498db;
                    font-size: 20px;
                    font-weight: 400;
                }
                
                .info-section {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .info-item {
                    display: flex;
                    align-items: center;
                }
                
                .info-label {
                    font-weight: 600;
                    color: #7f8c8d;
                    margin-left: 10px;
                }
                
                .info-value {
                    color: #2c3e50;
                    font-weight: 500;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                thead {
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    color: white;
                }
                
                th {
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                    border-left: 1px solid rgba(255,255,255,0.2);
                }
                
                th:last-child {
                    border-left: none;
                }
                
                td {
                    padding: 10px 8px;
                    text-align: center;
                    font-size: 11px;
                    border-bottom: 1px solid #ecf0f1;
                }
                
                tbody tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                
                tbody tr:hover {
                    background-color: #e8f4f8;
                    transition: background-color 0.2s;
                }
                
                .total-row {
                    background: linear-gradient(135deg, #34495e, #2c3e50) !important;
                    color: white;
                    font-weight: 700;
                    font-size: 13px;
                }
                
                .total-row td {
                    border-bottom: none;
                    padding: 15px 8px;
                }
                
                .negative {
                    color: #e74c3c;
                    font-weight: 600;
                }
                
                .positive {
                    color: #27ae60;
                    font-weight: 600;
                }
                
                .status-submitted {
                    background: #27ae60;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    display: inline-block;
                }
                
                .status-draft {
                    background: #f39c12;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    display: inline-block;
                }
                
                .summary {
                    margin-top: 30px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                
                .summary-card {
                    background: #fff;
                    border: 2px solid #ecf0f1;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    transition: all 0.3s;
                }
                
                .summary-card:hover {
                    border-color: #3498db;
                    box-shadow: 0 4px 8px rgba(52, 152, 219, 0.1);
                }
                
                .summary-label {
                    color: #7f8c8d;
                    font-size: 12px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }
                
                .summary-value {
                    color: #2c3e50;
                    font-size: 20px;
                    font-weight: 700;
                }
                
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 11px;
                    border-top: 1px solid #ecf0f1;
                    padding-top: 20px;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .no-print {
                        display: none;
                    }
                    
                    table {
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${company}</h1>
                <h2>${__("POS Opening Closing Report")}</h2>
            </div>
            
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">${__("Period")}:</span>
                    <span class="info-value">${frappe.datetime.str_to_user(from_date)} - ${frappe.datetime.str_to_user(to_date)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${__("Print Date")}:</span>
                    <span class="info-value">${frappe.datetime.now_datetime()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${__("Printed By")}:</span>
                    <span class="info-value">${frappe.session.user_fullname}</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>`;

    columns.forEach(col => {
        if (!show_details && col.fieldname === "mode_of_payment") return;
        html += `<th>${col.label}</th>`;
    });

    html += `</tr></thead><tbody>`;

    data.forEach(row => {
        const is_total = row.is_total_row;
        html += `<tr${is_total ? ' class="total-row"' : ''}>`;
        
        columns.forEach(col => {
            if (!show_details && col.fieldname === "mode_of_payment") return;
            
            let val = row[col.fieldname];
            let formatted_val = val || "";
            
            if (col.fieldtype === "Currency" && val !== null && val !== undefined) {
                formatted_val = formatCurrency(val);
            } else if (col.fieldtype === "Percent" && val !== null && val !== undefined) {
                formatted_val = val.toFixed(2) + "%";
            } else if (col.fieldtype === "Datetime" && val) {
                formatted_val = frappe.datetime.str_to_user(val);
            }
            
            if (col.fieldname === "difference" && val) {
                const diff = parseFloat(val);
                if (diff < 0) {
                    formatted_val = `<span class="negative">${formatted_val}</span>`;
                } else if (diff > 0) {
                    formatted_val = `<span class="positive">${formatted_val}</span>`;
                }
            }
            
            if (col.fieldname === "status" && val) {
                if (val === "Submitted" || val === __("Submitted")) {
                    formatted_val = `<span class="status-submitted">${val}</span>`;
                } else {
                    formatted_val = `<span class="status-draft">${val}</span>`;
                }
            }
            
            html += `<td>${formatted_val}</td>`;
        });
        
        html += `</tr>`;
    });

    html += `</tbody></table>`;

    // Always show summary totals
    let total_row = data.find(r => r.is_total_row);
    
    // If no total row exists, calculate it
    if (!total_row && data.length > 0) {
        total_row = {
            opening_amount: 0,
            sales_amount: 0,
            expected_amount: 0,
            closing_amount: 0,
            difference: 0
        };
        
        data.forEach(row => {
            if (!row.is_total_row) {
                total_row.opening_amount += parseFloat(row.opening_amount) || 0;
                total_row.sales_amount += parseFloat(row.sales_amount) || 0;
                total_row.expected_amount += parseFloat(row.expected_amount) || 0;
                total_row.closing_amount += parseFloat(row.closing_amount) || 0;
                total_row.difference += parseFloat(row.difference) || 0;
            }
        });
    }
    
    if (total_row) {
        html += `
            <div class="summary">
                <div class="summary-card">
                    <div class="summary-label">${__("Total Opening")}</div>
                    <div class="summary-value">${formatCurrency(total_row.opening_amount)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Sales")}</div>
                    <div class="summary-value">${formatCurrency(total_row.sales_amount)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Expected")}</div>
                    <div class="summary-value">${formatCurrency(total_row.expected_amount)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Closing")}</div>
                    <div class="summary-value">${formatCurrency(total_row.closing_amount)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Difference")}</div>
                    <div class="summary-value ${total_row.difference < 0 ? 'negative' : 'positive'}">${formatCurrency(total_row.difference)}</div>
                </div>
            </div>`;
    }

    html += `
            <div class="footer">
                <p>${company} - ${__("HIGH SPEED IT REPORT")}</p>
            </div>
        </body>
        </html>`;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

// وظيفة تصدير Excel
function export_pos_report_to_excel(report) {
    if (!report || !report.data || !report.data.length) {
        frappe.msgprint(__("لا توجد بيانات للتصدير"));
        return;
    }
    const fields = report.columns.map(c => c.fieldname);
    frappe.tools.downloadify(report.data, fields, "POS Opening Closing Report");
}

// وظيفة مساعدة لتنسيق القيم النقدية
function formatCurrency(value) {
    if (value === undefined || value === null || value === 0) return '0.00';
    
    if (typeof value === 'number') {
        return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
    return value;
}