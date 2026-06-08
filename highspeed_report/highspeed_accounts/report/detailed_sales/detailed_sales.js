// Enhanced function to generate interactive print page with simplified design
function generatePrintPage(data, filters) {
    return new Promise(function(resolve, reject) {
        try {
            // Get company information
            frappe.db.get_value('Company', filters.company, ['company_name', 'tax_id', 'email'], function(companyInfo) {
                if (!companyInfo) {
                    reject("لم يتم العثور على معلومات الشركة");
                    return;
                }
                
                // Calculate summary data
                var totalAmount = 0;
                var totalTax = 0;
                var invoiceCount = 0;
                var creditReturnsCount = 0;
                var creditReturnsAmount = 0;
                var paidInvoices = 0;
                var unpaidInvoices = 0;
                var paymentMethods = {};
                
                // Process data and create table rows
                var tableRows = [];
                
                data.forEach(function(row, index) {
                    if (!row.is_total_row) {
                        var amount = flt(row.grand_total || 0);
                        var tax = flt(row.tax_amount || 0);
                        
                        totalAmount += amount;
                        totalTax += tax;
                        invoiceCount++;
                        
                        // Count payment statuses
                        if (row.invoice_status && row.invoice_status.includes("مسددة")) {
                            paidInvoices++;
                        } else if (row.invoice_status && (row.invoice_status.includes("غير مسددة") || row.invoice_status.includes("متأخرة"))) {
                            unpaidInvoices++;
                        }
                        
                        // Count payment methods
                        if (row.mode_of_payment && row.mode_of_payment !== "غير محدد") {
                            if (!paymentMethods[row.mode_of_payment]) {
                                paymentMethods[row.mode_of_payment] = 0;
                            }
                            paymentMethods[row.mode_of_payment]++;
                        }
                        
                        if (row.credit_return_status) {
                            creditReturnsCount++;
                            creditReturnsAmount += Math.abs(amount);
                        }
                        
                        // Row styling and content
                        var rowClass = row.credit_return_status ? 'credit-return-row' : (index % 2 === 0 ? 'even-row' : 'odd-row');
                        var returnInfo = row.return_against ? `<div class="return-info">مرتجع مقابل: ${row.return_against}</div>` : '';
                        var creditBadge = row.credit_return_status ? `<span class="credit-badge">${row.credit_return_status}</span>` : '';
                        
                        tableRows.push(`
                            <tr class="${rowClass}">
                                <td class="serial-number">${index + 1}</td>
                                <td class="date-cell">${formatDate(row.posting_date)}</td>
                                <td class="time-cell">${formatTime(row.posting_time)}</td>
                                <td class="document-cell">
                                    <div class="document-number">${row.voucher_no || ''}</div>
                                    ${returnInfo}
                                </td>
                                <td class="type-cell">
                                    ${translateDocumentType(row.voucher_type)}
                                    ${creditBadge}
                                </td>
                                <td class="customer-cell">${row.customer_name || ''}</td>
                                <td class="status-cell ${getStatusClass(row.invoice_status)}">${row.invoice_status || ''}</td>
                                <td class="amount-cell">${format_currency(tax)}</td>
                                <td class="amount-cell total-amount">${format_currency(amount)}</td>
                                <td class="payment-cell">${row.mode_of_payment || ''}</td>
                                <td class="pos-cell">${row.pos_profile || ''}</td>
                                <td class="user-cell">${row.owner || ''}</td>
                            </tr>
                        `);
                    }
                });
                
                // Generate payment methods summary
                var paymentMethodsHtml = '';
                Object.keys(paymentMethods).forEach(function(method) {
                    paymentMethodsHtml += `<div class="payment-method-item"><span class="method-name">${method}:</span> <span class="method-count">${paymentMethods[method]}</span></div>`;
                });
                
                // Get current date and time
                var currentDate = frappe.datetime.get_today();
                var currentTime = frappe.datetime.now_time();
                
                // Build the complete HTML page with simplified design
                var html = `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>سجل المبيعات المفصل - ${companyInfo.company_name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
                        
                        @page {
                            size: A4 landscape;
                            margin: 1cm;
                        }
                        
                        * {
                            box-sizing: border-box;
                            margin: 0;
                            padding: 0;
                        }
                        
                        body {
                            font-family: 'Cairo', 'Arial', sans-serif;
                            background: #f5f5f5;
                            color: #333;
                            line-height: 1.6;
                            direction: rtl;
                        }
                        
                        .print-container {
                            max-width: 1200px;
                            margin: 10px auto;
                            background: white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        
                        .header-section {
                            background: #2c3e50;
                            color: white;
                            padding: 20px;
                            text-align: center;
                        }
                        
                        .company-name {
                            font-size: 2em;
                            font-weight: 700;
                            margin-bottom: 10px;
                        }
                        
                        .company-details {
                            font-size: 0.9em;
                            opacity: 0.9;
                            margin-bottom: 10px;
                        }
                        
                        .report-title {
                            font-size: 1.5em;
                            font-weight: 600;
                            margin-top: 10px;
                        }
                        
                        .controls-section {
                            background: #f8f9fa;
                            padding: 15px 20px;
                            border-bottom: 1px solid #ddd;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        
                        .print-button {
                            background: #27ae60;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            font-size: 1em;
                            font-weight: 600;
                            cursor: pointer;
                            transition: background 0.2s;
                        }
                        
                        .print-button:hover {
                            background: #229954;
                        }
                        
                        .report-info {
                            font-size: 0.9em;
                            color: #666;
                        }
                        
                        .info-section {
                            padding: 20px;
                            background: #34495e;
                            color: white;
                        }
                        
                        .info-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                            gap: 15px;
                        }
                        
                        .info-card {
                            background: rgba(255,255,255,0.1);
                            padding: 15px;
                            border: 1px solid rgba(255,255,255,0.2);
                        }
                        
                        .info-label {
                            font-weight: 600;
                            margin-bottom: 5px;
                            font-size: 0.9em;
                        }
                        
                        .info-value {
                            font-size: 1.1em;
                            font-weight: 500;
                        }
                        
                        .summary-section {
                            padding: 20px;
                            background: #ecf0f1;
                            border-bottom: 1px solid #ddd;
                        }
                        
                        .summary-title {
                            font-size: 1.4em;
                            font-weight: 700;
                            text-align: center;
                            margin-bottom: 20px;
                            color: #2c3e50;
                        }
                        
                        .summary-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                            gap: 15px;
                        }
                        
                        .summary-card {
                            background: white;
                            padding: 15px;
                            text-align: center;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                            border-left: 4px solid;
                        }
                        
                        .summary-card.total { border-left-color: #3498db; }
                        .summary-card.tax { border-left-color: #e74c3c; }
                        .summary-card.count { border-left-color: #2ecc71; }
                        .summary-card.returns { border-left-color: #f39c12; }
                        .summary-card.paid { border-left-color: #27ae60; }
                        .summary-card.unpaid { border-left-color: #e67e22; }
                        
                        .summary-label {
                            font-size: 0.85em;
                            color: #7f8c8d;
                            margin-bottom: 5px;
                            font-weight: 600;
                        }
                        
                        .summary-value {
                            font-size: 1.3em;
                            font-weight: 700;
                            color: #2c3e50;
                        }
                        
                        .payment-methods {
                            margin-top: 15px;
                            padding: 15px;
                            background: white;
                            border: 1px solid #ddd;
                        }
                        
                        .payment-methods-title {
                            font-weight: 600;
                            margin-bottom: 10px;
                            color: #2c3e50;
                        }
                        
                        .payment-methods-list {
                            display: flex;
                            flex-wrap: wrap;
                            gap: 10px;
                        }
                        
                        .payment-method-item {
                            background: #f8f9fa;
                            padding: 5px 12px;
                            font-size: 0.9em;
                            border: 1px solid #e9ecef;
                        }
                        
                        .method-name {
                            font-weight: 600;
                            color: #2c3e50;
                        }
                        
                        .method-count {
                            background: #3498db;
                            color: white;
                            padding: 2px 6px;
                            margin-right: 5px;
                            font-size: 0.8em;
                        }
                        
                        .data-section {
                            padding: 20px;
                        }
                        
                        .data-table {
                            width: 100%;
                            border-collapse: collapse;
                            background: white;
                            font-size: 0.85em;
                        }
                        
                        .data-table thead {
                            background: #2c3e50;
                            color: white;
                        }
                        
                        .data-table th {
                            padding: 10px 8px;
                            text-align: center;
                            font-weight: 600;
                            border: 1px solid #34495e;
                        }
                        
                        .data-table td {
                            padding: 8px 6px;
                            border: 1px solid #ddd;
                            vertical-align: middle;
                        }
                        
                        .even-row {
                            background-color: #f8f9fa;
                        }
                        
                        .odd-row {
                            background-color: white;
                        }
                        
                        .credit-return-row {
                            background: #ffe6e6;
                        }
                        
                        .serial-number {
                            text-align: center;
                            font-weight: 600;
                            color: #666;
                            width: 3%;
                        }
                        
                        .date-cell, .time-cell {
                            text-align: center;
                            font-family: 'Courier New', monospace;
                            width: 8%;
                        }
                        
                        .document-cell {
                            width: 12%;
                        }
                        
                        .document-number {
                            font-weight: 600;
                            color: #2980b9;
                        }
                        
                        .return-info {
                            font-size: 0.75em;
                            color: #7f8c8d;
                            margin-top: 2px;
                        }
                        
                        .type-cell {
                            width: 10%;
                            text-align: center;
                        }
                        
                        .credit-badge {
                            background: #e74c3c;
                            color: white;
                            padding: 2px 6px;
                            font-size: 0.7em;
                            margin-top: 2px;
                            display: inline-block;
                        }
                        
                        .customer-cell {
                            width: 15%;
                            font-weight: 500;
                        }
                        
                        .status-cell {
                            width: 10%;
                            text-align: center;
                            font-weight: 600;
                            padding: 5px;
                        }
                        
                        .status-paid {
                            background: #d5f4e6;
                            color: #27ae60;
                        }
                        
                        .status-unpaid {
                            background: #ffeaa7;
                            color: #f39c12;
                        }
                        
                        .status-return {
                            background: #ffcccc;
                            color: #e74c3c;
                        }
                        
                        .amount-cell {
                            text-align: left;
                            font-family: 'Courier New', monospace;
                            font-weight: 600;
                            width: 8%;
                        }
                        
                        .total-amount {
                            background: #e8f5e8;
                            color: #155724;
                            font-weight: 700;
                        }
                        
                        .payment-cell, .pos-cell, .user-cell {
                            width: 8%;
                            font-size: 0.8em;
                        }
                        
                        .footer-section {
                            background: #2c3e50;
                            color: white;
                            padding: 15px 20px;
                            text-align: center;
                        }
                        
                        .generation-info {
                            font-size: 0.9em;
                            margin-bottom: 5px;
                        }
                        
                        .system-info {
                            font-size: 0.85em;
                            opacity: 0.8;
                        }
                        
                        .en-number {
                            font-family: 'Courier New', monospace;
                            direction: ltr;
                            display: inline-block;
                        }
                        
                        @media print {
                            body {
                                background: white;
                            }
                            
                            .print-container {
                                margin: 0;
                                box-shadow: none;
                            }
                            
                            .controls-section {
                                display: none;
                            }
                            
                            .data-table {
                                page-break-inside: auto;
                            }
                            
                            .data-table tr {
                                page-break-inside: avoid;
                                page-break-after: auto;
                            }
                            
                            .data-table thead {
                                display: table-header-group;
                            }
                            
                            .summary-section,
                            .info-section {
                                page-break-inside: avoid;
                            }
                        }
                        
                        @media screen and (max-width: 768px) {
                            .print-container {
                                margin: 5px;
                            }
                            
                            .info-grid {
                                grid-template-columns: 1fr;
                            }
                            
                            .summary-grid {
                                grid-template-columns: repeat(2, 1fr);
                            }
                            
                            .data-table {
                                font-size: 0.7em;
                            }
                            
                            .data-table th,
                            .data-table td {
                                padding: 5px 3px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <!-- Header Section -->
                        <div class="header-section">
                            <h1 class="company-name">${companyInfo.company_name || 'اسم الشركة'}</h1>
                            <div class="company-details">
                                ${companyInfo.tax_id ? 'الرقم الضريبي: ' + companyInfo.tax_id : ''} 
                                ${companyInfo.email ? ' | البريد الإلكتروني: ' + companyInfo.email : ''}
                            </div>
                            <div class="report-title">سجل المبيعات المفصل</div>
                        </div>
                        
                        <!-- Controls Section -->
                        <div class="controls-section">
                            <button id="printBtn" class="print-button">طباعة التقرير</button>
                            <div class="report-info">
                                <strong>تاريخ الإصدار:</strong> <span class="en-number">${formatDate(currentDate)} - ${formatTime(currentTime)}</span>
                            </div>
                        </div>
                        
                        <!-- Report Info Section -->
                        <div class="info-section">
                            <div class="info-grid">
                                <div class="info-card">
                                    <div class="info-label">فترة التقرير:</div>
                                    <div class="info-value en-number">${formatDate(filters.from_date)} ${formatTime(filters.from_time)} إلى ${formatDate(filters.to_date)} ${formatTime(filters.to_time)}</div>
                                </div>
                                ${filters.customer ? `<div class="info-card">
                                    <div class="info-label">العميل المحدد:</div>
                                    <div class="info-value">${filters.customer}</div>
                                </div>` : ''}
                                ${filters.mode_of_payment ? `<div class="info-card">
                                    <div class="info-label">طريقة الدفع:</div>
                                    <div class="info-value">${filters.mode_of_payment}</div>
                                </div>` : ''}
                                ${filters.pos_profile ? `<div class="info-card">
                                    <div class="info-label">نقطة البيع:</div>
                                    <div class="info-value">${Array.isArray(filters.pos_profile) ? filters.pos_profile.join(', ') : filters.pos_profile}</div>
                                </div>` : ''}
                            </div>
                        </div>
                        
                        <!-- Summary Section -->
                        <div class="summary-section">
                            <h2 class="summary-title">ملخص المبيعات</h2>
                            <div class="summary-grid">
                                <div class="summary-card total">
                                    <div class="summary-label">إجمالي المبيعات</div>
                                    <div class="summary-value en-number">${format_currency(totalAmount)}</div>
                                </div>
                                <div class="summary-card tax">
                                    <div class="summary-label">إجمالي الضريبة</div>
                                    <div class="summary-value en-number">${format_currency(totalTax)}</div>
                                </div>
                                <div class="summary-card count">
                                    <div class="summary-label">عدد الفواتير</div>
                                    <div class="summary-value en-number">${invoiceCount}</div>
                                </div>
                                <div class="summary-card returns">
                                    <div class="summary-label">مرتجعات آجلة</div>
                                    <div class="summary-value en-number">${creditReturnsCount}</div>
                                </div>
                                <div class="summary-card paid">
                                    <div class="summary-label">فواتير مسددة</div>
                                    <div class="summary-value en-number">${paidInvoices}</div>
                                </div>
                                <div class="summary-card unpaid">
                                    <div class="summary-label">فواتير غير مسددة</div>
                                    <div class="summary-value en-number">${unpaidInvoices}</div>
                                </div>
                            </div>
                            
                            ${Object.keys(paymentMethods).length > 0 ? `
                            <div class="payment-methods">
                                <div class="payment-methods-title">طرق الدفع المستخدمة:</div>
                                <div class="payment-methods-list">
                                    ${paymentMethodsHtml}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <!-- Data Table Section -->
                        <div class="data-section">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>التاريخ</th>
                                        <th>الوقت</th>
                                        <th>رقم المستند</th>
                                        <th>النوع</th>
                                        <th>العميل</th>
                                        <th>الحالة</th>
                                        <th>الضريبة</th>
                                        <th>المبلغ</th>
                                        <th>طريقة الدفع</th>
                                        <th>نقطة البيع</th>
                                        <th>المستخدم</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows.join('')}
                                    <tr style="background: #2c3e50; color: white; font-weight: bold;">
                                        <td colspan="7" style="text-align: center; padding: 10px;">الإجمالي العام</td>
                                        <td style="text-align: left; font-family: 'Courier New', monospace;">${format_currency(totalTax)}</td>
                                        <td style="text-align: left; font-family: 'Courier New', monospace; font-size: 1.1em;">${format_currency(totalAmount)}</td>
                                        <td colspan="3" style="text-align: center;">عدد الفواتير: ${invoiceCount}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        
                        <!-- Footer Section -->
                        <div class="footer-section">
                            <div class="generation-info">
                                تم إنشاء هذا التقرير في: <span class="en-number">${formatDate(currentDate)} - ${formatTime(currentTime)}</span>
                            </div>
                            <div class="system-info">
                                تم الإنشاء بواسطة نظام ERPNext | تقرير سجل المبيعات المفصل
                            </div>
                        </div>
                    </div>
                    
                    <script>
                        // Print functionality
                        document.getElementById('printBtn').addEventListener('click', function() {
                            window.print();
                        });
                        
                        // Auto-focus for better UX
                        window.addEventListener('load', function() {
                            document.getElementById('printBtn').focus();
                        });
                        
                        // Keyboard shortcuts
                        document.addEventListener('keydown', function(e) {
                            if (e.ctrlKey && e.key === 'p') {
                                e.preventDefault();
                                window.print();
                            }
                        });
                    </script>
                </body>
                </html>
                `;
                
                resolve(html);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Helper function to get status class for styling
function getStatusClass(status) {
    if (!status) return '';
    
    if (status.includes("مسددة") || status.includes("مدفوع")) {
        return 'status-paid';
    } else if (status.includes("غير مسددة") || status.includes("متأخرة")) {
        return 'status-unpaid';
    } else if (status.includes("مرتجع")) {
        return 'status-return';
    }
    
    return '';
}// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Detailed Sales"] = {
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
            "fieldname": "from_time",
            "label": __("من وقت"),
            "fieldtype": "Time",
            "default": "00:00:00",
            "reqd": 1,
            "width": "100px"
        },
        {
            "fieldname": "to_time",
            "label": __("إلى وقت"),
            "fieldtype": "Time",
            "default": "23:59:59",
            "reqd": 1,
            "width": "100px"
        },
        {
            "fieldname": "pos_profile",
            "label": __("نقطة البيع"),
            "fieldtype": "MultiSelectList",
            "width": "150px",
            "get_data": function (txt) {
				return frappe.db.get_link_options("POS Profile", txt)}
        },
        {
            "fieldname": "owner",
            "label": __("المستخدم"),
            "fieldtype": "MultiSelectList",
            "width": "150px",
            "get_data": function (txt) {
				return frappe.db.get_link_options("User", txt)}
        },
        {
            "fieldname": "warehouse",
            "label": __("المستودع"),
            "fieldtype": "MultiSelectList",
            "width": "150px",
            "get_data": function (txt) {
				return frappe.db.get_link_options("Warehouse", txt)}
        },
        {
            "fieldname": "mode_of_payment",
            "label": __("Payment Mode"),
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": "150px"
        },
        {
            "fieldname": "cost_center",
            "label": __("Cost Center"),
            "fieldtype": "MultiSelectList",
            "options": "Cost Center",
            "width": "150px",
            "get_data": function (txt) {
				return frappe.db.get_link_options("Warehouse", txt)}
        },
        {
            "fieldname": "status",
            "label": __("حالة الفاتورة"),
            "fieldtype": "Select",
            "options": "\nPaid\nUnpaid\nPartly Paid\nOverdue\nCredit Note Issued\nReturn",
            "width": "150px"
        },
        {
            "fieldname": "show_credit_returns",
            "label": __("إظهار مرتجعات الفواتير الآجلة فقط"),
            "fieldtype": "Check",
            "default": 0,
            "width": "200px",
            "onchange": function() {
                console.log("Credit returns filter changed");
            }
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // Avoid showing "null" in any column
            if (value === null || value === "null") {
                value = "";
            }
            
            // Format document type column - translate types to Arabic
            if (column.fieldname === "voucher_type") {
                switch(value) {
                    case "Sales Invoice":
                        return __("Sales Invoice");
                    case "Payment Entry":
                        return 'سند قبض';
                    case "Journal Entry":
                        return 'قيد محاسبي';
                    case "Purchase Invoice":
                        return __("Purchase Invoice");
                    default:
                        return value || "";
                }
            }
            
            // Format invoice status - with color coding
            if (column.fieldname === "invoice_status") {
                if (!value) return '';
                
                let color = "black";
                if (value.includes("مرتجع")) {
                    color = "red";
                } else if (value.includes("نقدية") || value.includes("مسددة بالكامل")) {
                    color = "green";
                } else if (value.includes("غير مسددة") || value.includes("متأخرة")) {
                    color = "orange";
                } else if (value.includes("مسددة جزئياً")) {
                    color = "blue";
                } else if (value.includes("ملغية")) {
                    color = "gray";
                }
                
                return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
            }
            
            // Format for return_against column - add link to original invoice
            if (column.fieldname === "return_against" && value) {
                return `<a href="/app/sales-invoice/${value}" target="_blank">${value}</a>`;
            }
            
            // Format for credit return status - highlight with a badge
            if (column.fieldname === "credit_return_status" && value) {
                return `<span class="indicator-pill red" style="font-size: 0.8em; padding: 3px 8px; white-space: nowrap; display: inline-block;">${value}</span>`;
            }
            
            // Format for amount columns
            if (column.fieldname === "grand_total" || column.fieldname === "tax_amount") {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
            
            // Basic format for totals
            if (data.is_total_row) {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value || "", row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير سجل المبيعات المفصل");
        
        // Add custom CSS
        $('<style>\
            .datatable .dt-cell { padding: 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .sales-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.total { border-right: 5px solid #4272d7; }\
            .summary-card.invoice-count { border-right: 5px solid #28a745; }\
            .summary-card.payment-method { border-right: 5px solid #fd7e14; }\
            .summary-card.credit-returns { border-right: 5px solid #dc3545; }\
            .total-amount { color: #4272d7; }\
            .invoice-count-value { color: #28a745; }\
            .payment-method-value { color: #fd7e14; }\
            .credit-returns-value { color: #dc3545; }\
            .indicator-pill.red { background-color: #dc3545; color: white; padding: 3px 8px; border-radius: 10px; font-size: 0.8em; }\
            .credit-return-row { background-color: #fff0f0; }\
            .print-button { background-color: #28a745; color: white; margin-left: 10px; }\
            .export-button { background-color: #007bff; color: white; margin-left: 10px; }\
        </style>').appendTo('head');
        
        // Create sales summary section
        var $salesSummarySection = $('<div class="sales-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>');
        var $salesSummaryHeader = $('<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' + __("ملخص سجل المبيعات المفصل") + '</h3><div class="report-date"></div></div>');
        
        // Create row for summary cards
        var $summaryCardsSection = $('<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>');
        
        // Create summary cards
        var $totalCard = $('<div class="summary-card total" style="flex: 1;"><div class="summary-card-title">' + __("إجمالي المبيعات") + '</div><div class="summary-amount total-amount"></div></div>');
        var $invoiceCountCard = $('<div class="summary-card invoice-count" style="flex: 1;"><div class="summary-card-title">' + __("عدد الفواتير") + '</div><div class="summary-amount invoice-count-value"></div></div>');
        var $paymentMethodsCard = $('<div class="summary-card payment-method" style="flex: 1;"><div class="summary-card-title">' + __("Payment Modes") + '</div><div class="summary-amount payment-method-value"></div></div>');
        var $creditReturnsCard = $('<div class="summary-card credit-returns" style="flex: 1;"><div class="summary-card-title">' + __("مرتجعات الفواتير الآجلة غير المسددة") + '</div><div class="summary-amount credit-returns-value">0</div></div>');
        
        $summaryCardsSection.append($totalCard).append($invoiceCountCard).append($paymentMethodsCard).append($creditReturnsCard);
        
        // Create sales details section
        var $salesDetailsSection = $('<div class="sales-details" style="margin-top: 20px;"></div>');
        
        $salesSummarySection.append($salesSummaryHeader).append($summaryCardsSection).append($salesDetailsSection);
        
        // Add section to the top of the report after filters
        if (report.page.main.find('.sales-summary-section').length === 0) {
            report.page.main.find('.report-filter-section').after($salesSummarySection);
        }
        
        // Watch for filter changes
        report.page.main.find('[data-fieldname="show_credit_returns"]').on('change', function() {
            var isChecked = $(this).is(':checked');
            console.log("Credit returns filter changed:", isChecked);
            // Force refresh when this filter changes
            report.refresh();
        });
        
        // Check if the filter for credit returns exists
        checkFiltersIncludesCreditReturnOption();
        
        // Add custom row styling for credit returns
        function applyCreditReturnStyling() {
            setTimeout(function() {
                $('.datatable .dt-row').each(function() {
                    var $row = $(this);
                    // Look for credit return status
                    var hasCreditReturn = $row.find('.indicator-pill.red').length > 0 || 
                                         $row.find('td:contains("فاتورة آجلة")').length > 0 || 
                                         $row.find('td:contains("فاتورة آجلة غير مسددة")').length > 0;
                    
                    if (hasCreditReturn) {
                        $row.addClass('credit-return-row');
                    }
                });
            }, 100);
        }
        
        // Update sales summary when data is loaded
        var originalRefresh = report.refresh;
        report.refresh = function() {
            originalRefresh.call(this);
            
            // Check if data is available
            if (report.data && report.data.length > 0) {
                // Get current filters
                const filters = report.get_values();
                
                // Store original data first
                let originalData = JSON.parse(JSON.stringify(report.data));
                
                // Apply filter for credit returns
                if (filters.show_credit_returns) {
                    console.log("Filtering for credit returns only");
                    
                    // When checkbox is checked, filter for returns against credit invoices
                    report.data = originalData.filter(row => {
                        return row.credit_return_status !== null && 
                               row.credit_return_status !== undefined && 
                               row.credit_return_status !== "" && 
                               row.is_credit_return === 1;  // Use the new field we added for more reliable filtering
                    });
                    
                    console.log("Filtered data length:", report.data.length);
                    
                    // If no data found after filtering, show message
                    if (report.data.length === 0) {
                        frappe.msgprint({
                            title: __("لا توجد بيانات"),
                            message: __("لم يتم العثور على مرتجعات لفواتير آجلة للفترة المحددة"),
                            indicator: 'orange'
                        });
                    }
                } else {
                    // When unchecked, show all data
                    report.data = originalData;
                }
                
                // ALWAYS refresh the table after filtering
                report.render_datatable();
                
                // Apply styling after rendering
                applyCreditReturnStyling();
                
                // Update summary
                updateSalesSummary(report.data, filters);
            }
        };
        
        // Function to check if the main filters include the new "show_credit_returns" option
        function checkFiltersIncludesCreditReturnOption() {
            // Check if the filter already exists
            var hasCreditReturnsFilter = false;
            if (frappe.query_reports["Detailed Sales"] && frappe.query_reports["Detailed Sales"].filters) {
                frappe.query_reports["Detailed Sales"].filters.forEach(function(filter) {
                    if (filter.fieldname === "show_credit_returns") {
                        hasCreditReturnsFilter = true;
                    }
                });
            }
            
            // If the filter doesn't exist, add it
            if (!hasCreditReturnsFilter && frappe.query_reports["Detailed Sales"]) {
                frappe.query_reports["Detailed Sales"].filters.push({
                    "fieldname": "show_credit_returns",
                    "label": __("إظهار مرتجعات الفواتير الآجلة فقط"),
                    "fieldtype": "Check",
                    "default": 0,
                    "width": "200px",
                    "onchange": function() {
                        console.log("Credit returns filter changed");
                    }
                });
            }
        }
        
        // Function to update sales summary
        function updateSalesSummary(data, filters) {
            // Update report date
            $(".report-date").html(`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())} ${formatTime(frappe.datetime.now_time())}</span>`);
            
            // Calculate totals - excluding the total row we add
            var totalAmount = 0;
            var invoiceCount = 0;
            var paymentMethods = new Set();
            var posProfiles = new Set();
            var users = new Set();
            var warehouses = new Set();
            var creditReturnsCount = 0;
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    totalAmount += flt(row.grand_total);
                    invoiceCount++;
                    if (row.mode_of_payment && row.mode_of_payment !== "غير محدد") {
                        paymentMethods.add(row.mode_of_payment);
                    }
                    if (row.pos_profile && row.pos_profile !== "غير محدد") {
                        posProfiles.add(row.pos_profile);
                    }
                    if (row.owner && row.owner !== "غير محدد") {
                        users.add(row.owner);
                    }
                    if (row.warehouse && row.warehouse !== "غير محدد") {
                        warehouses.add(row.warehouse);
                    }
                    if (row.credit_return_status) {
                        creditReturnsCount++;
                    }
                }
            });
            
            // Update summary cards
            $(".total-amount").text(format_currency(totalAmount));
            $(".invoice-count-value").text(invoiceCount);
            $(".payment-method-value").text(paymentMethods.size);
            $(".credit-returns-value").text(creditReturnsCount);
            
            // Update sales details
            $(".sales-details").empty();
            
            // Create simple data analysis
            var paymentMethodsData = {};
            var invoiceStatuses = {};
            var costCenters = {};
            var posProfilesData = {};
            var usersData = {};
            var warehousesData = {};
            var creditReturnsData = {};
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    // Group by payment method
                    if (row.mode_of_payment) {
                        if (!paymentMethodsData[row.mode_of_payment]) {
                            paymentMethodsData[row.mode_of_payment] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        paymentMethodsData[row.mode_of_payment].count++;
                        paymentMethodsData[row.mode_of_payment].amount += flt(row.grand_total);
                    }
                    
                    // Group by invoice status
                    if (row.invoice_status) {
                        if (!invoiceStatuses[row.invoice_status]) {
                            invoiceStatuses[row.invoice_status] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        invoiceStatuses[row.invoice_status].count++;
                        invoiceStatuses[row.invoice_status].amount += flt(row.grand_total);
                    }
                    
                    // Group by cost center
                    if (row.cost_center) {
                        if (!costCenters[row.cost_center]) {
                            costCenters[row.cost_center] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        costCenters[row.cost_center].count++;
                        costCenters[row.cost_center].amount += flt(row.grand_total);
                    }
                    
                    // Group by POS profile
                    if (row.pos_profile) {
                        if (!posProfilesData[row.pos_profile]) {
                            posProfilesData[row.pos_profile] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        posProfilesData[row.pos_profile].count++;
                        posProfilesData[row.pos_profile].amount += flt(row.grand_total);
                    }
                    
                    // Group by user
                    if (row.owner) {
                        if (!usersData[row.owner]) {
                            usersData[row.owner] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        usersData[row.owner].count++;
                        usersData[row.owner].amount += flt(row.grand_total);
                    }
                    
                    // Group by warehouse
                    if (row.warehouse) {
                        if (!warehousesData[row.warehouse]) {
                            warehousesData[row.warehouse] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        warehousesData[row.warehouse].count++;
                        warehousesData[row.warehouse].amount += flt(row.grand_total);
                    }
                    
                    // Group by credit return status
                    if (row.credit_return_status && row.return_against) {
                        if (!creditReturnsData[row.return_against]) {
                            creditReturnsData[row.return_against] = {
                                count: 0,
                                amount: 0,
                                voucher_nos: []
                            };
                        }
                        creditReturnsData[row.return_against].count++;
                        creditReturnsData[row.return_against].amount += flt(row.grand_total);
                        creditReturnsData[row.return_against].voucher_nos.push(row.voucher_no);
                    }
                }
            });
            
            // Display data analysis
            var $analysisSection = $('<div style="margin-top: 20px;"></div>');
            
            // Analysis by credit returns (if there are any)
            if (Object.keys(creditReturnsData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #dc3545; font-weight: bold;">' + __("مرتجعات الفواتير الآجلة غير المسددة") + ' (' + Object.keys(creditReturnsData).length + ')' + '</h4>');
                var $creditReturnsTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px; border: 2px solid #dc3545;"><thead style="background-color: #fff5f5;"><tr><th>' + __("الفاتورة الأصلية") + '</th><th>' + __("عدد المرتجعات") + '</th><th>' + __("مبلغ المرتجعات") + '</th><th>' + __("مستندات المرتجعات") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(creditReturnsData).forEach(function(invoiceNo) {
                    var returnLinks = creditReturnsData[invoiceNo].voucher_nos.map(function(voucherNo) {
                        return `<a href="/app/sales-invoice/${voucherNo}" target="_blank">${voucherNo}</a>`;
                    }).join(', ');
                    
                    $creditReturnsTable.find('tbody').append(`<tr>
                        <td><a href="/app/sales-invoice/${invoiceNo}" target="_blank">${invoiceNo}</a></td>
                        <td>${creditReturnsData[invoiceNo].count}</td>
                        <td>${format_currency(Math.abs(creditReturnsData[invoiceNo].amount))}</td>
                        <td>${returnLinks}</td>
                    </tr>`);
                });
                
                $analysisSection.append($creditReturnsTable);
            }
            
            // Analysis by payment method
            if (Object.keys(paymentMethodsData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب طريقة الدفع") + '</h4>');
                var $paymentMethodsTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Payment Mode") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(paymentMethodsData).forEach(function(method) {
                    $paymentMethodsTable.find('tbody').append('<tr><td>' + method + '</td><td>' + paymentMethodsData[method].count + '</td><td>' + format_currency(paymentMethodsData[method].amount) + '</td></tr>');
                });
                
                $analysisSection.append($paymentMethodsTable);
            }
            
            // Analysis by invoice status
            if (Object.keys(invoiceStatuses).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب حالة الفاتورة") + '</h4>');
                var $invoiceStatusesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("حالة الفاتورة") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(invoiceStatuses).forEach(function(status) {
                    $invoiceStatusesTable.find('tbody').append('<tr><td>' + status + '</td><td>' + invoiceStatuses[status].count + '</td><td>' + format_currency(invoiceStatuses[status].amount) + '</td></tr>');
                });
                
                $analysisSection.append($invoiceStatusesTable);
            }
            
            // Analysis for other categories...
            if (Object.keys(costCenters).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب مركز التكلفة") + '</h4>');
                var $costCentersTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Cost Center") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(costCenters).forEach(function(center) {
                    $costCentersTable.find('tbody').append('<tr><td>' + center + '</td><td>' + costCenters[center].count + '</td><td>' + format_currency(costCenters[center].amount) + '</td></tr>');
                });
                
                $analysisSection.append($costCentersTable);
            }
            
            // Analysis by POS profile
            if (Object.keys(posProfilesData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب نقطة البيع") + '</h4>');
                var $posProfilesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("نقطة البيع") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(posProfilesData).forEach(function(profile) {
                    $posProfilesTable.find('tbody').append('<tr><td>' + profile + '</td><td>' + posProfilesData[profile].count + '</td><td>' + format_currency(posProfilesData[profile].amount) + '</td></tr>');
                });
                
                $analysisSection.append($posProfilesTable);
            }
            
            // Analysis by user
            if (Object.keys(usersData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب المستخدم") + '</h4>');
                var $usersTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("المستخدم") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(usersData).forEach(function(user) {
                    $usersTable.find('tbody').append('<tr><td>' + user + '</td><td>' + usersData[user].count + '</td><td>' + format_currency(usersData[user].amount) + '</td></tr>');
                });
                
                $analysisSection.append($usersTable);
            }
            
            // Analysis by warehouse
            if (Object.keys(warehousesData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب المستودع") + '</h4>');
                var $warehousesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("المستودع") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(warehousesData).forEach(function(warehouse) {
                    $warehousesTable.find('tbody').append('<tr><td>' + warehouse + '</td><td>' + warehousesData[warehouse].count + '</td><td>' + format_currency(warehousesData[warehouse].amount) + '</td></tr>');
                });
                
                $analysisSection.append($warehousesTable);
            }
            
            $(".sales-details").append($analysisSection);
        }
        
        // Print Page button - Opens a formatted print page
        report.page.add_inner_button(__("🖨️ صفحة الطباعة"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                // Show loading message
                frappe.show_alert({
                    message: __("جاري تجهيز صفحة الطباعة..."),
                    indicator: 'blue'
                }, 3);
                
                // Generate and open print page
                generatePrintPage(data, filters)
                    .then(function(html) {
                        // Open in new window/tab for printing
                        var printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes');
                        if (printWindow) {
                            printWindow.document.write(html);
                            printWindow.document.close();
                            printWindow.focus();
                            
                            frappe.show_alert({
                                message: __("تم فتح صفحة الطباعة"),
                                indicator: 'green'
                            }, 2);
                        } else {
                            frappe.msgprint(__("تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لفتح صفحة الطباعة."));
                        }
                    })
                    .catch(function(error) {
                        frappe.msgprint(__("حدث خطأ أثناء إعداد صفحة الطباعة: ") + error);
                        console.error("Print Page Error:", error);
                    });
            } else {
                frappe.msgprint(__("لا توجد بيانات للطباعة. يرجى التحقق من المرشحات."));
            }
        });
        
        // Quick Print button - Direct print without preview
        report.page.add_inner_button(__("⚡ طباعة مباشرة"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                frappe.show_alert({
                    message: __("جاري الطباعة..."),
                    indicator: 'blue'
                }, 2);
                
                generatePrintPage(data, filters)
                    .then(function(html) {
                        // Create hidden iframe for direct printing
                        var iframe = document.createElement('iframe');
                        iframe.style.position = 'fixed';
                        iframe.style.left = '-9999px';
                        iframe.style.top = '-9999px';
                        iframe.style.width = '1px';
                        iframe.style.height = '1px';
                        iframe.style.opacity = '0';
                        document.body.appendChild(iframe);
                        
                        iframe.contentDocument.write(html);
                        iframe.contentDocument.close();
                        
                        // Wait for content to load then print
                        iframe.onload = function() {
                            setTimeout(function() {
                                iframe.contentWindow.focus();
                                iframe.contentWindow.print();
                                
                                // Clean up after printing
                                setTimeout(function() {
                                    document.body.removeChild(iframe);
                                }, 2000);
                            }, 1000);
                        };
                    })
                    .catch(function(error) {
                        frappe.msgprint(__("حدث خطأ أثناء الطباعة: ") + error);
                        console.error("Direct Print Error:", error);
                    });
            } else {
                frappe.msgprint(__("لا توجد بيانات للطباعة"));
            }
        });
        
        // Export button
        report.page.add_inner_button(__("📊 تصدير إكسل"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                downloadCSV(data, "detailed_sales_log_" + filters.from_date + "_to_" + filters.to_date + ".csv");
                
                frappe.show_alert({
                    message: __("تم تصدير التقرير بنجاح"),
                    indicator: 'green'
                }, 3);
            } else {
                frappe.msgprint(__("لا توجد بيانات للتصدير"));
            }
        });
        
        // Add buttons after a short delay to ensure report is fully loaded
        setTimeout(function() {
            if (!report.page.main.find('.btn:contains("🖨️")').length) {
                // Try to add buttons again if they don't exist
                addPrintButtons(report);
            }
        }, 1000);
        
        function addPrintButtons(report) {
            try {
                // Print Page button
                if (report.page && report.page.add_inner_button) {
                    report.page.add_inner_button(__("🖨️ صفحة الطباعة"), function() {
                        if (report.data && report.data.length > 0) {
                            generatePrintPage(report.data, report.get_values())
                                .then(function(html) {
                                    var printWindow = window.open('', '_blank', 'width=1200,height=800');
                                    if (printWindow) {
                                        printWindow.document.write(html);
                                        printWindow.document.close();
                                        printWindow.focus();
                                    }
                                });
                        } else {
                            frappe.msgprint(__("لا توجد بيانات للطباعة"));
                        }
                    });
                    
                    // Direct Print button  
                    report.page.add_inner_button(__("⚡ طباعة مباشرة"), function() {
                        if (report.data && report.data.length > 0) {
                            generatePrintPage(report.data, report.get_values())
                                .then(function(html) {
                                    var iframe = document.createElement('iframe');
                                    iframe.style.display = 'none';
                                    document.body.appendChild(iframe);
                                    iframe.contentDocument.write(html);
                                    iframe.contentDocument.close();
                                    iframe.contentWindow.print();
                                    setTimeout(() => document.body.removeChild(iframe), 2000);
                                });
                        } else {
                            frappe.msgprint(__("لا توجد بيانات للطباعة"));
                        }
                    });
                    
                    // Export button
                    report.page.add_inner_button(__("📊 تصدير"), function() {
                        if (report.data && report.data.length > 0) {
                            downloadCSV(report.data, "detailed_sales_" + Date.now() + ".csv");
                        } else {
                            frappe.msgprint(__("لا توجد بيانات للتصدير"));
                        }
                    });
                }
            } catch (error) {
                console.error("Error adding print buttons:", error);
            }
        }
    }
};

// Enhanced function to generate printable report (legacy function kept for compatibility)
function generatePrintableReport(data, filters) {
    // Just call the new generatePrintPage function
    return generatePrintPage(data, filters);
}

// Helper function to translate document types
function translateDocumentType(type) {
    switch(type) {
        case "Sales Invoice":
            return __("Sales Invoice");
        case "Payment Entry":
            return 'سند قبض';
        case "Journal Entry":
            return 'قيد محاسبي';
        case "Purchase Invoice":
            return __("Purchase Invoice");
        default:
            return type || "";
    }
}

// Date formatting function
function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    var day = d.getDate().toString().padStart(2, '0');
    var month = (d.getMonth() + 1).toString().padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
}

// Time formatting function
function formatTime(timeStr) {
    if (!timeStr) return "";
    return timeStr.substr(0, 5); // Show only hours and minutes (HH:MM)
}

// CSV export function
function downloadCSV(data, filename) {
    var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // Add BOM for Arabic support
    
    // Prepare headers
    var headers = [__("No"), "التاريخ", "الوقت", "رقم المستند", "نوع المستند", "مرتجع مقابل", __("Customer"), "حالة الفاتورة", __("Tax"), __("Amount"), "نقطة البيع", "المستخدم", "المستودع", __("Cost Center"), __("Payment Mode"), "حالة مرتجع الآجل"];
    csvContent += headers.join(",") + "\r\n";
    
    // Add data
    data.forEach(function(row, index) {
        if (!row.is_total_row) {
            var rowData = [
                index + 1,
                row.posting_date || "",
                row.posting_time || "",
                '"' + (row.voucher_no || "") + '"',
                '"' + (translateDocumentType(row.voucher_type) || "") + '"',
                '"' + (row.return_against || "") + '"',
                '"' + (row.customer_name || "") + '"',
                '"' + (row.invoice_status || "") + '"',
                row.tax_amount || 0,
                row.grand_total || 0,
                '"' + (row.pos_profile || "") + '"',
                '"' + (row.owner || "") + '"',
                '"' + (row.warehouse || "") + '"',
                '"' + (row.cost_center || "") + '"',
                '"' + (row.mode_of_payment || "") + '"',
                '"' + (row.credit_return_status || "") + '"'
            ];
            
            // Convert numeric values to text to avoid comma issues
            rowData = rowData.map(function(val) {
                if (val === null || val === "null") return "";
                if (val === "") return val;
                return typeof val === 'number' ? val.toFixed(2) : val;
            });
            
            csvContent += rowData.join(",") + "\r\n";
        }
    });
    
    // Export file
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}