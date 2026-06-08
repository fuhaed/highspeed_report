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
                    color = "green";
                    bg_color = "#e8f5e8";
                    break;
                case "مغلق":
                    color = "blue";
                    bg_color = "#e8f0ff";
                    break;
                case "مسودة":
                    color = "orange";
                    bg_color = "#fff3e0";
                    break;
                case "ملغي":
                    color = "red";
                    bg_color = "#ffebee";
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
            print_pos_opening_closing_report(report);
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

// وظيفة تصدير Excel
function export_pos_report_to_excel(report) {
    if (!report || !report.data || !report.data.length) {
        frappe.msgprint(__("لا توجد بيانات للتصدير"));
        return;
    }
    
    // استخدام وظيفة التصدير المدمجة في Frappe
    frappe.tools.downloadify(report.data, ["name", "period_start_date", "period_end_date", "pos_profile", "user", "status", "total_quantity", "net_total", "total_taxes", "grand_total"], "POS Opening Closing Report");
}

// وظيفة مساعدة لتنسيق القيم النقدية
function formatCurrency(value) {
    if (value === undefined || value === null || value === 0) return '0.00';
    
    if (typeof value === 'number') {
        return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
    return value;
}