// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["POS Sales Report"] = {
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
            "fieldname": "pos_profile",
            "label": __("ملف نقطة البيع"),
            "fieldtype": "Link",
            "options": "POS Profile",
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
            "fieldname": "customer",
            "label": __("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "width": "200px",
            "get_query": function() {
                return {
                    "filters": [
                        ["Customer", "disabled", "=", 0]
                    ]
                };
            }
        },
        {
            "fieldname": "cashier",
            "label": __("موظف الكاشير"),
            "fieldtype": "Link",
            "options": "User",
            "width": "200px"
        },
        {
            "fieldname": "mode_of_payment",
            "label": __("Payment Mode"),
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": "150px"
        },
        {
            "fieldname": "status",
            "label": __("حالة الفاتورة"),
            "fieldtype": "Select",
            "options": "\nDraft\nPaid\nUnpaid\nConsolidated\nReturn\nCancelled",
            "width": "150px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // تنسيق لحالة الفاتورة - مع ترميز اللون
            if (column.fieldname === "status") {
                if (!value) return '';
                
                let color = "black";
                let status_text = value;
                
                // ترجمة الحالات إلى العربية
                switch(value) {
                    case "Draft":
                        status_text = "مسودة";
                        color = "gray";
                        break;
                    case "Paid":
                        status_text = "مسددة";
                        color = "green";
                        break;
                    case "Unpaid":
                        status_text = "غير مسددة";
                        color = "orange";
                        break;
                    case "Consolidated":
                        status_text = "مجمعة";
                        color = "blue";
                        break;
                    case "Return":
                        status_text = "مرتجع";
                        color = "red";
                        break;
                    case "Cancelled":
                        status_text = "ملغية";
                        color = "gray";
                        break;
                }
                
                return `<span style="color: ${color}; font-weight: bold;">${status_text}</span>`;
            }
            
            // تنسيق للمبلغ - تم تبسيط التنسيق لتجنب استدعاء الدوال المتكررة
            if (column.fieldname === "grand_total" || column.fieldname === "paid_amount") {
                value = default_formatter(value, row, column, data);
                return '<span style="font-weight: bold;">' + value + '</span>';
            }
            
            // تمت إزالة رقم السند
            
            // إبراز الملاحظات
            if (column.fieldname === "remarks") {
                if (!value) return '<span style="color: #888;">-</span>';
                return '<span style="color: #333;">' + value + '</span>';
            }
            
            // تنسيق أساسي للإجماليات
            if (data.is_total_row) {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value, row, column, data);
    },
    
    // إضافة زر طباعة منسقة للتقرير
    onload: function(report) {
        report.page.add_inner_button(__("طباعة التقرير المنسق"), function() {
            print_pos_sales_report(report);
        });
    }
};

// وظيفة الطباعة المنسقة
function print_pos_sales_report(report) {
    // الحصول على بيانات التقرير
    const filters = report.get_values();
    const data = report.data;
    const columns = report.columns;
    
    if (!data || !data.length) {
        frappe.msgprint(__("لا توجد بيانات للطباعة"));
        return;
    }
    
    // تحضير محتوى HTML
    const dateFormat = (date) => {
        if (!date) return '';
        return frappe.datetime.str_to_user(date);
    };
    
    // بداية محتوى HTML للطباعة
    let print_html = `
        <style>
            @media print {
                .print-format {
                    padding: 0mm;
                    font-size: 12px;
                }
                .print-heading {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    text-align: center;
                }
                .company-info {
                    margin-bottom: 15px;
                    text-align: center;
                }
                .filters-section {
                    margin-bottom: 15px;
                    border: 1px solid #ddd;
                    padding: 10px;
                    border-radius: 5px;
                }
                .filter-item {
                    display: inline-block;
                    margin-right: 15px;
                    margin-bottom: 5px;
                }
                .filter-label {
                    font-weight: bold;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: center;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                .total-row td {
                    font-weight: bold;
                }
                .text-right {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .status-paid {
                    color: green;
                    font-weight: bold;
                }
                .status-unpaid {
                    color: orange;
                    font-weight: bold;
                }
                .status-return {
                    color: red;
                    font-weight: bold;
                }
                .status-draft {
                    color: gray;
                    font-weight: bold;
                }
                .status-cancelled {
                    color: gray;
                    font-weight: bold;
                }
                .status-consolidated {
                    color: blue;
                    font-weight: bold;
                }
                .page-break {
                    page-break-after: always;
                }
                .footer {
                    position: fixed;
                    bottom: 0;
                    text-align: center;
                    width: 100%;
                    font-size: 10px;
                }
            }
            /* للعرض في المتصفح */
            .print-format {
                padding: 15px;
                direction: rtl;
            }
            .print-heading {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 10px;
                text-align: center;
            }
            .company-info {
                margin-bottom: 15px;
                text-align: center;
            }
            .filters-section {
                margin-bottom: 15px;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 5px;
            }
            .filter-item {
                display: inline-block;
                margin-right: 15px;
                margin-bottom: 5px;
            }
            .filter-label {
                font-weight: bold;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                direction: rtl;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: center;
            }
            th {
                background-color: #f2f2f2;
                font-weight: bold;
            }
            .total-row td {
                font-weight: bold;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            .status-paid {
                color: green;
                font-weight: bold;
            }
            .status-unpaid {
                color: orange;
                font-weight: bold;
            }
            .status-return {
                color: red;
                font-weight: bold;
            }
            .status-draft {
                color: gray;
                font-weight: bold;
            }
            .status-cancelled {
                color: gray;
                font-weight: bold;
            }
            .status-consolidated {
                color: blue;
                font-weight: bold;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 10px;
            }
        </style>
        
        <div class="print-format">
            <div class="print-heading">تقرير مبيعات نقاط البيع</div>
            <div class="company-info">
                <div class="company-name">${filters.company}</div>
            </div>
            
            <div class="filters-section">
                <div class="filter-item">
                    <span class="filter-label">الفترة:</span>
                    <span>${dateFormat(filters.from_date)} إلى ${dateFormat(filters.to_date)}</span>
                </div>
                ${filters.pos_profile ? `
                <div class="filter-item">
                    <span class="filter-label">ملف نقطة البيع:</span>
                    <span>${filters.pos_profile}</span>
                </div>` : ''}
                ${filters.customer ? `
                <div class="filter-item">
                    <span class="filter-label">العميل:</span>
                    <span>${filters.customer}</span>
                </div>` : ''}
                ${filters.cashier ? `
                <div class="filter-item">
                    <span class="filter-label">الكاشير:</span>
                    <span>${filters.cashier}</span>
                </div>` : ''}
                ${filters.mode_of_payment ? `
                <div class="filter-item">
                    <span class="filter-label">طريقة الدفع:</span>
                    <span>${filters.mode_of_payment}</span>
                </div>` : ''}
                ${filters.status ? `
                <div class="filter-item">
                    <span class="filter-label">الحالة:</span>
                    <span>${filters.status}</span>
                </div>` : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        ${columns.map(col => `<th>${col.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    // إضافة صفوف البيانات
    data.forEach((row, index) => {
        if (row.is_total_row) {
            print_html += `
                <tr class="total-row">
                    <td colspan="3" class="text-right">الإجمالي</td>
                    <td>${formatCurrency(row.grand_total)}</td>
                    <td colspan="${columns.length - 3}"></td>
                </tr>
            `;
        } else {
            // تحديد لون حالة الفاتورة
            let statusClass = '';
            switch(row.status) {
                case "Paid": statusClass = "status-paid"; break;
                case "Unpaid": statusClass = "status-unpaid"; break;
                case "Return": statusClass = "status-return"; break;
                case "Draft": statusClass = "status-draft"; break;
                case "Cancelled": statusClass = "status-cancelled"; break;
                case "Consolidated": statusClass = "status-consolidated"; break;
            }
            
            // ترجمة حالة الفاتورة
            let statusText = row.status;
            switch(row.status) {
                case "Draft": statusText = "مسودة"; break;
                case "Paid": statusText = "مسددة"; break;
                case "Unpaid": statusText = "غير مسددة"; break;
                case "Consolidated": statusText = "مجمعة"; break;
                case "Return": statusText = "مرتجع"; break;
                case "Cancelled": statusText = "ملغية"; break;
            }
            
            print_html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${dateFormat(row.posting_date)}</td>
                    <td>${row.name || ''}</td>
                    <td>${row.customer_name || ''}</td>
                    <td>${formatCurrency(row.grand_total)}</td>
                    <td class="${statusClass}">${statusText}</td>
                    <td>${row.cashier || ''}</td>
                    <td>${row.mode_of_payment || ''}</td>
                    <td>${row.remarks || '-'}</td>
                </tr>
            `;
        }
    });
    
    // إغلاق محتوى HTML
    print_html += `
                </tbody>
            </table>
            
            <div class="footer">
                تم إنشاء هذا التقرير في ${frappe.datetime.now_datetime()} بواسطة ${frappe.session.user}
            </div>
        </div>
    `;
    
    // فتح نافذة الطباعة
    const w = window.open();
    w.document.write(`
        <html>
            <head>
                <title>تقرير مبيعات نقاط البيع</title>
            </head>
            <body>
                ${print_html}
                <script>
                    // طباعة تلقائية
                    window.onload = function() {
                        window.print();
                        // إغلاق النافذة بعد الطباعة (في بعض المتصفحات فقط)
                        window.onfocus = function() { 
                            setTimeout(function() { window.close(); }, 500);
                        }
                    }
                </script>
            </body>
        </html>
    `);
}

// وظيفة مساعدة بسيطة لتنسيق القيم النقدية - تم إعادة كتابتها لتجنب التكرار غير المنتهي
function formatCurrency(value) {
    if (value === undefined || value === null) return '';
    
    // استخدام طريقة أبسط لتنسيق العملة بدون استدعاء frappe.format
    if (typeof value === 'number') {
        // تنسيق العدد مع فاصلتين عشريتين
        return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    }
    return value;
}