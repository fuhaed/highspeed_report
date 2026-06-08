// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Supplier Statement Report"] = {
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
            "fieldname": "supplier",
            "label": __("Supplier"),
            "fieldtype": "Link",
            "options": "Supplier",
            "reqd": 1,
            "width": "200px",
            "get_query": function() {
                return {
                    "filters": [
                        ["Supplier", "disabled", "=", 0]
                    ]
                };
            }
        },
        {
            "fieldname": "from_date",
            "label": __("من تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -3),
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
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // Handle null/undefined values
            if (value === null || value === undefined) {
                value = "";
            }
            
            // Format document type
            if (column.fieldname === "voucher_type") {
                switch(value) {
                    case "Purchase Invoice":
                        return __("Purchase Invoice");
                    case "Payment Entry":
                        return __("Payment Entry");
                    case "Journal Entry":
                        return 'قيد محاسبي';
                    case "Sales Invoice":
                        return __("Sales Invoice");
                    case "Total":
                        return __("Grand Total");
                    case "Opening Balance":
                        return 'رصيد افتتاحي';
                    default:
                        return value || "";
                }
            }
            
            // Format invoice status
            if (column.fieldname === "invoice_status") {
                if (!value) return '';
                
                let color = "black";
                if (value.includes("مرتجع")) {
                    color = "red";
                } else if (value.includes("نقدية") || value.includes("مسددة بالكامل") || value === "سداد") {
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
            
            // Format balance column
            if (column.fieldname === "balance") {
                return '<span style="color: ' + (data.balance >= 0 ? 'blue' : 'red') + ';">' + 
                       default_formatter(Math.abs(value), row, column, data) + ' ' + 
                       (data.balance >= 0 ? 'دائن' : 'مدين') + '</span>';
            }
            
            // Special formatting for opening row
            if (data.is_opening_row) {
                return '<span style="font-weight: bold; color: #4272d7;">' + default_formatter(value, row, column, data) + '</span>';
            }
            
            // Format total row
            if (data.is_total_row) {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value, row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير كشف حساب المورد");
        
        // Add custom CSS for report styling
        $('<style>\
            .datatable .dt-cell { padding: 0px 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .supplier-summary-section { direction: rtl; }\
            .balance-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .balance-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .balance-amount { font-size: 20px; font-weight: bold; }\
            .balance-card.debit { border-right: 5px solid #4272d7; }\
            .balance-card.credit { border-right: 5px solid #28a745; }\
            .balance-card.closing { border-right: 5px solid #fd7e14; }\
            .debit-amount { color: #4272d7; }\
            .credit-amount { color: #28a745; }\
            .closing-amount { color: #fd7e14; }\
            /* تصميم قسم الرصيد السابق */\
            .opening-balance-container { \
                background-color: #f0f7ff; \
                border: 2px solid #4272d7; \
                border-radius: 5px; \
                padding: 15px; \
                margin-bottom: 20px; \
                margin-top: 10px; \
            }\
            .opening-balance-title { \
                font-size: 18px; \
                font-weight: bold; \
                color: #2c5282; \
                margin-bottom: 10px; \
                text-align: center; \
                border-bottom: 1px solid #b3c9e8; \
                padding-bottom: 8px; \
            }\
            .opening-balance-details { \
                display: flex; \
                justify-content: space-between; \
                align-items: center; \
            }\
            .opening-balance-label { \
                font-size: 15px; \
                font-weight: bold; \
            }\
            .opening-balance-value { \
                font-size: 18px; \
                font-weight: bold; \
                padding: 5px 15px; \
                border-radius: 4px; \
                background-color: #ffffff; \
                box-shadow: 0 1px 3px rgba(0,0,0,0.1); \
            }\
            .opening-balance-row td { \
                background-color: #f0f7ff !important; \
            }\
        </style>').appendTo('head');
        
        // إضافة قسم ملخص المورد
        var $supplierSummarySection = $('<div class="supplier-summary-section" style="margin-bottom: 20px;"></div>');
        $supplierSummarySection.html(`<div style="margin-bottom: 10px; padding: 10px;"></div>`);
        
        // قسم الرصيد السابق (نحتفظ بنفس اسم الفئة لمنع أي مشاكل في الكود)
        var $openingBalanceContainer = $('<div class="opening-balance-container"></div>');
        
        // بطاقات الأرصدة
        var $balanceCardsSection = $('<div class="balance-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>');
        var $debitCard = $('<div class="balance-card debit" style="flex: 1;"><div class="balance-card-title">' + __("إجمالي المدين") + '</div><div class="balance-amount debit-amount"></div></div>');
        var $creditCard = $('<div class="balance-card credit" style="flex: 1;"><div class="balance-card-title">' + __("إجمالي الدائن") + '</div><div class="balance-amount credit-amount"></div></div>');
        var $closingBalanceCard = $('<div class="balance-card closing" style="flex: 1;"><div class="balance-card-title">' + __("Closing Balance") + '</div><div class="balance-amount closing-amount"></div></div>');
        
        $balanceCardsSection.append($debitCard).append($creditCard).append($closingBalanceCard);
        
        // معلومات المورد
        var $supplierInfoSection = $('<div class="supplier-info" style="margin-top: 20px; margin-bottom: 20px;"></div>');
        
        // ملخص المعاملات
        var $transactionsSummary = $('<div class="transactions-summary" style="margin-top: 20px;"></div>');
        
        // إضافة العناصر إلى القسم الرئيسي
        report.page.main.find('.report-filter-section').after($supplierSummarySection);
        
        // إضافة قسم الرصيد السابق فوق الجدول
        report.page.main.find('.datatable-wrapper').before($openingBalanceContainer);
        
        // إضافة الأقسام الأخرى
        $supplierSummarySection.append($supplierInfoSection).append($balanceCardsSection).append($transactionsSummary);
        
        // تجاوز دالة التحديث الأصلية
        var originalRefresh = report.refresh;
        report.refresh = function() {
            originalRefresh.call(this);
            
            if (report.data && report.data.length > 0) {
                // التأكد من إخفاء صف الرصيد الافتتاحي من الجدول
                hideOpeningBalanceRow(report);
                
                // تحديث قسم الرصيد السابق
                updateOpeningBalanceContainer(report);
                
                // تحديث ملخص المورد
                updateSupplierSummary(report);
            } else {
                // مسح قسم الرصيد الافتتاحي والملخص إذا لم تتوفر بيانات
                $(".opening-balance-container").empty();
                $(".supplier-info").empty();
                $(".debit-amount").text("0.00");
                $(".credit-amount").text("0.00");
                $(".closing-amount").text("0.00");
                $(".transactions-summary").empty();
            }
        };
        
        // دالة لإخفاء صف الرصيد الافتتاحي من الجدول وعرضه في الأعلى فقط
        function hideOpeningBalanceRow(report) {
            if (!report.datatable) return;
            
            // البحث عن صف الرصيد الافتتاحي
            var rowIndex = -1;
            
            for (var i = 0; i < report.data.length; i++) {
                if (report.data[i].voucher_type === "Opening Balance") {
                    rowIndex = i;
                    break;
                }
            }
            
            // إخفاء صف الرصيد الافتتاحي إذا وجد
            if (rowIndex >= 0) {
                // عرض الصف مع تنسيق خاص
                report.datatable.style.setCellStyle(rowIndex, null, {
                    backgroundColor: '#f0f7ff',
                    fontWeight: 'bold',
                    borderBottom: '2px solid #4272d7'
                });
            }
        }
        
        // دالة لتحديث قسم الرصيد السابق
        function updateOpeningBalanceContainer(report) {
            var report_dict = report.report_dict || {};
            var openingBalance = report_dict.opening_balance || 0;
            var openingDate = report_dict.opening_date || null;
            
            if (!openingDate) {
                try {
                    // محاولة العثور على الرصيد الافتتاحي من البيانات
                    for (var i = 0; i < report.data.length; i++) {
                        if (report.data[i].voucher_type === "Opening Balance") {
                            openingBalance = report.data[i].balance;
                            openingDate = frappe.datetime.str_to_user(report.data[i].posting_date);
                            break;
                        }
                    }
                } catch (e) {
                    console.error("Error finding opening balance from data:", e);
                }
            }
            
            $(".opening-balance-container").empty();
            $(".opening-balance-container").html(`
                <div class="opening-balance-title">رصيد سابق</div>
                <div class="opening-balance-details">
                    <div class="opening-balance-label">الرصيد السابق حتى تاريخ ${openingDate || ""}:</div>
                    <div class="opening-balance-value" style="color: ${openingBalance >= 0 ? '#4272d7' : '#e53e3e'}">
                        ${format_currency(Math.abs(openingBalance))} ${openingBalance >= 0 ? __("دائن") : __("مدين")}
                    </div>
                </div>
            `);
        }
        
        // دالة لتحديث ملخص المورد
        function updateSupplierSummary(report) {
            if (!report.data || report.data.length === 0) return;
            
            var filters = report.get_values();
            
            // حساب إجماليات المدين والدائن والرصيد الختامي
            var totalDebit = 0;
            var totalCredit = 0;
            
            // تخطي صف الرصيد الافتتاحي
            for (var i = 0; i < report.data.length; i++) {
                var row = report.data[i];
                if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
                    totalDebit += flt(row.debit);
                    totalCredit += flt(row.credit);
                }
            }
            
            // الحصول على الرصيد الختامي من الصف الأخير
            var lastRow = report.data[report.data.length - 1];
            var closingBalance = lastRow ? lastRow.balance : 0;
            
            // تحديث بطاقات الرصيد
            $(".debit-amount").text(format_currency(totalDebit));
            $(".credit-amount").text(format_currency(totalCredit));
            $(".closing-amount").text(format_currency(Math.abs(closingBalance)) + " " + (closingBalance >= 0 ? __("دائن") : __("مدين")));
            
            // تحديث معلومات المورد
            updateSupplierInfo(filters);
            
            // تحديث ملخص المعاملات
            updateTransactionSummary(report.data);
        }
        
        // دالة لتحديث معلومات المورد
        function updateSupplierInfo(filters) {
            if (!filters || !filters.supplier) return;
            
            frappe.db.get_value('Supplier', filters.supplier, 
                ['supplier_name', 'supplier_group', 'territory', 'tax_id', 'supplier_type', 'payment_terms'], 
                function(r) {
                    if (r) {
                        frappe.call({
                            method: "erpnext.accounts.utils.get_balance_on",
                            args: {
                                party_type: "Supplier",
                                party: filters.supplier,
                                company: filters.company
                            },
                            callback: function(response) {
                                var systemBalance = response.message || 0;
                                
                                $(".supplier-info").empty();
                                $(".supplier-info").append(`
                                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                                        <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                            <table style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("كود المورد")}</td>
                                                    <td style="padding: 5px 0; font-weight: bold;">${filters.supplier}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("اسم المورد")}</td>
                                                    <td style="padding: 5px 0;">${r.supplier_name || filters.supplier}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("مجموعة المورد")}</td>
                                                    <td style="padding: 5px 0;">${r.supplier_group || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الرقم الضريبي")}</td>
                                                    <td style="padding: 5px 0;">${r.tax_id || ""}</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div style="flex: 1 0 300px; background-color: #f8f8f8; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                            <table style="width: 100%;">
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("نوع المورد")}</td>
                                                    <td style="padding: 5px 0;">${r.supplier_type || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("شروط الدفع")}</td>
                                                    <td style="padding: 5px 0;">${r.payment_terms || ""}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("الفترة")}</td>
                                                    <td style="padding: 5px 0;">${frappe.datetime.str_to_user(filters.from_date)} - ${frappe.datetime.str_to_user(filters.to_date)}</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 5px 10px 5px 0; font-weight: bold; color: #666;">${__("رصيد النظام")}</td>
                                                    <td style="padding: 5px 0; font-weight: bold; color: " + (systemBalance >= 0 ? "blue" : "red") + ";">${format_currency(Math.abs(systemBalance))} ${systemBalance >= 0 ? "دائن" : "مدين"}</td>
                                                </tr>
                                            </table>
                                        </div>
                                    </div>
                                `);
                            }
                        });
                    }
                });
        }
        
        // دالة لتحديث ملخص المعاملات
        function updateTransactionSummary(data) {
            var invoiceCount = 0;
            var paymentCount = 0;
            var returnCount = 0;
            var otherCount = 0;
            
            data.forEach(function(row) {
                if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
                    if (row.voucher_type === "Purchase Invoice") {
                        if (row.invoice_status && row.invoice_status.includes("مرتجع")) {
                            returnCount++;
                        } else {
                            invoiceCount++;
                        }
                    } else if (row.voucher_type === "Payment Entry") {
                        paymentCount++;
                    } else {
                        otherCount++;
                    }
                }
            });
            
            $(".transactions-summary").empty();
            $(".transactions-summary").append(`
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">${__("ملخص المعاملات")}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                        <div style="flex: 1 0 150px; background-color: #eaf4ff; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #4272d7;">${invoiceCount}</div>
                            <div style="color: #666;">${__("فواتير مشتريات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #e8f5e9; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #28a745;">${paymentCount}</div>
                            <div style="color: #666;">${__("سندات صرف")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #fff3e0; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #fd7e14;">${returnCount}</div>
                            <div style="color: #666;">${__("مرتجعات")}</div>
                        </div>
                        <div style="flex: 1 0 150px; background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                            <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${otherCount}</div>
                            <div style="color: #666;">${__("معاملات أخرى")}</div>
                        </div>
                    </div>
                </div>
            `);
        }
        
        // إضافة زر الطباعة
        report.page.add_inner_button(__("طباعة كشف الحساب"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                var report_dict = report.report_dict || {};
                
                // عرض رسالة التحميل
                frappe.show_alert({
                    message: __("جاري تجهيز التقرير للطباعة..."),
                    indicator: 'blue'
                });
                
                createSupplierStatementForm(data, filters, report_dict)
                    .then(function(html) {
                        // فتح نافذة جديدة للطباعة
                        var w = window.open();
                        if (w) {
                            w.document.write(html);
                            w.document.close();
                            setTimeout(function() {
                                w.print();
                            }, 1000);
                        } else {
                            frappe.msgprint(__("تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير."));
                        }
                    })
                    .catch(function(error) {
                        frappe.msgprint(__("حدث خطأ أثناء إعداد التقرير للطباعة: ") + error);
                        console.error(error);
                    });
            } else {
                frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
            }
        });
        
        // إضافة زر التصدير
        report.page.add_inner_button(__("تصدير"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                downloadCSV(data, "supplier_statement_" + filters.supplier + "_" + filters.from_date + "_to_" + filters.to_date + ".csv");
            } else {
                frappe.msgprint(__("لا توجد بيانات للتصدير"));
            }
        });
    },
    
    "initial_setup": true,
    "show_filters_on_top": true
};

// Print function
function createSupplierStatementForm(data, filters, report_dict) {
    return new Promise(function(resolve, reject) {
        try {
            // جلب معلومات الشركة
            frappe.db.get_value('Company', filters.company, 
                ['company_name', 'tax_id', 'company_logo'], 
                function(companyInfo) {
                
                // Get supplier info
                frappe.db.get_value('Supplier', filters.supplier, ['supplier_name', 'tax_id'], function(supplierInfo) {
                    // لا نحتاج لحقل english_name، نستخدم اسم الشركة الأصلي فقط
                    var englishName = companyInfo.company_name;
                    
                    // Get opening balance and date
                    var openingBalance = 0;
                    var openingDate = null;
                    
                    // Try to get opening balance from report_dict
                    if (report_dict && report_dict.opening_balance !== undefined) {
                        openingBalance = report_dict.opening_balance;
                        openingDate = report_dict.opening_date;
                    } else {
                        // Try to find opening balance in data
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].voucher_type === "Opening Balance") {
                                openingBalance = data[i].balance;
                                openingDate = frappe.datetime.str_to_user(data[i].posting_date);
                                break;
                            }
                        }
                    }
                    
                    // Calculate totals
                    var totalDebit = 0;
                    var totalCredit = 0;
                    
                    // Skip opening balance row when calculating totals
                    for (var i = 0; i < data.length; i++) {
                        var row = data[i];
                        if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
                            totalDebit += flt(row.debit);
                            totalCredit += flt(row.credit);
                        }
                    }
                    
                    // Calculate closing balance
                    var closingBalance = openingBalance + totalCredit - totalDebit;
                    
                    // Create transaction rows
                    var transactionRows = [];
                    
                    // Add transaction rows (skip opening balance and total rows)
                    for (var i = 0; i < data.length; i++) {
                        var row = data[i];
                        if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
                            // Determine document type in Arabic
                            var documentType = "";
                            
                            if (row.voucher_type === "Purchase Invoice") {
                                if (row.invoice_status && row.invoice_status.includes("مرتجع")) {
                                    documentType = 'مرتجع مشتريات';
                                } else {
                                    documentType = __("Purchase Invoice");
                                }
                            } else if (row.voucher_type === "Payment Entry") {
                                documentType = __("Payment Entry");
                            } else if (row.voucher_type === "Journal Entry") {
                                documentType = 'قيد محاسبي';
                            } else {
                                documentType = row.voucher_type || "";
                            }
                            
                            // Add row to transactions table
                            transactionRows.push(`
                                <tr>
                                    <td>${frappe.datetime.str_to_user(row.posting_date)}</td>
                                    <td>${row.voucher_no || ""}</td>
                                    <td>${documentType}</td>
                                    <td>${row.description || "لايوجد ملاحظات"}</td>
                                    <td>${row.invoice_status || ""}</td>
                                    <td>${row.debit > 0 ? format_currency(row.debit) : ""}</td>
                                    <td>${row.credit > 0 ? format_currency(row.credit) : ""}</td>
                                    <td class="balance-cell">${format_currency(Math.abs(row.balance))} ${row.balance >= 0 ? "دائن" : "مدين"}</td>
                                </tr>
                            `);
                        }
                    }
                    
                    // Build HTML template for print
                    var currentDate = frappe.datetime.get_today();
                    var currentTime = frappe.datetime.now_time().substr(0, 5);
                    
                    // تنسيق CSS للرأس الجديد
                    var headerStyles = `
                        .company-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 10px 0;
                            margin-bottom: 10px;
                            border-bottom: 1px solid #000;
                        }
                        .company-logo {
                            text-align: center;
                            flex: 1;
                        }
                        .company-logo img {
                            max-height: 80px;
                            max-width: 150px;
                        }
                        .company-name-ar {
                            text-align: right;
                            flex: 1;
                            font-size: 18px;
                            font-weight: bold;
                        }
                        .company-name-en {
                            text-align: left;
                            flex: 1;
                            font-size: 18px;
                            font-weight: bold;
                        }
                        .tax-id {
                            text-align: center;
                            margin-top: 5px;
                            font-size: 12px;
                        }
                    `;
                    
                    // بناء جزء رأس الشركة الجديد - استخدام اسم الشركة الأصلي فقط
                    var companyHeaderHTML = `
                    <div class="company-header">
                        <div class="company-name-ar">
                            ${companyInfo.company_name}
                        </div>
                        <div class="company-logo">
                            ${companyInfo.company_logo ? 
                                `<img src="${companyInfo.company_logo}" alt="Company Logo">` : 
                                `<div style="height: 60px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">${companyInfo.company_name}</div>`}
                            <div class="tax-id">الرقم الضريبي: <span class="en-number">${companyInfo.tax_id || "—"}</span></div>
                        </div>
                        <div class="company-name-en">
                            ${englishName}
                        </div>
                    </div>
                    `;
                    
                    var html = `
                    <!DOCTYPE html>
                    <html dir="rtl">
                    <head>
                        <meta charset="UTF-8">
                        <title>كشف حساب المورد - ${supplierInfo.supplier_name || filters.supplier}</title>
                        <style>
                            @page {
                                size: A4;
                                margin: 0.5cm;
                            }
                            body { 
                                font-family: Arial, sans-serif; 
                                margin: 0; 
                                padding: 0;
                                direction: rtl;
                                font-size: 11px;
                                width: 100%;
                                box-sizing: border-box;
                                page-break-after: avoid;
                            }
                            ${headerStyles}
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin-bottom: 10px; 
                                table-layout: fixed;
                            }
                            th, td { 
                                border: 1px solid #000; 
                                padding: 3px 2px; 
                                text-align: center;
                                font-size: 10px;
                                overflow: hidden;
                            }
                            .balance-cell {
                                white-space: nowrap;
                                text-align: center;
                                font-size: 10px;
                            }
                            th { 
                                background-color: #f2f2f2; 
                                font-weight: bold;
                                font-size: 10px;
                            }
                            .report-title {
                                text-align: center;
                                margin: 5px 0;
                                font-size: 16px;
                                font-weight: bold;
                                border-bottom: 1px solid #000;
                                padding-bottom: 5px;
                            }
                            /* تصميم قسم الرصيد السابق */
                            .opening-balance-info {
                                background-color: #f0f7ff;
                                border: 2px solid #4272d7;
                                border-radius: 5px;
                                padding: 10px;
                                margin: 10px 0 20px;
                                font-weight: bold;
                            }
                            .opening-balance-title {
                                font-size: 14px;
                                font-weight: bold;
                                color: #2c5282;
                                margin-bottom: 8px;
                                text-align: center;
                                border-bottom: 1px solid #b3c9e8;
                                padding-bottom: 5px;
                            }
                            .totals {
                                display: flex;
                                justify-content: space-between;
                                margin: 10px 0;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .total-box {
                                width: 33%;
                                text-align: center;
                                padding: 5px;
                                border: 1px solid #000;
                                background-color: #f2f2f2;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 5px;
                                font-size: 10px;
                                border-top: 1px solid #000;
                                padding-top: 5px;
                            }
                            .signatures {
                                display: flex;
                                justify-content: space-between;
                                margin-top: 10px;
                            }
                            .signature-box {
                                width: 32%;
                                text-align: center;
                            }
                            .signature-line {
                                border-bottom: 1px solid #000;
                                height: 30px;
                                margin-bottom: 5px;
                            }
                            /* Enable English numbers */
                            .en-number {
                                font-family: Arial, sans-serif !important;
                                -webkit-font-feature-settings: 'tnum';
                                font-feature-settings: 'tnum';
                                font-variant-numeric: tabular-nums;
                            }
                            @media print {
                                body { 
                                    margin: 0; 
                                    print-color-adjust: exact;
                                    -webkit-print-color-adjust: exact;
                                }
                                .avoid-break {
                                    page-break-inside: avoid;
                                }
                                thead {
                                    display: table-header-group;
                                }
                            }
                        </style>
                    </head>
                    <body>
                        ${companyHeaderHTML}
                        
                        <div class="report-title">
                            كشف حساب المورد / Supplier Statement
                        </div>
                        
                        <table class="info-table">
                            <tr>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: right;">مورد / Supplier:</td>
                                <td style="width: 35%;">${supplierInfo.supplier_name || filters.supplier}</td>
                                <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: right;">الفترة / Period:</td>
                                <td style="width: 35%;" class="en-number">${frappe.datetime.str_to_user(filters.from_date)} - ${frappe.datetime.str_to_user(filters.to_date)}</td>
                            </tr>
                            <tr>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">الرقم الضريبي / Tax ID:</td>
                                <td class="en-number">${supplierInfo.tax_id || "—"}</td>
                                <td style="background-color: #f2f2f2; font-weight: bold; text-align: right;">تاريخ التقرير / Report Date:</td>
                                <td class="en-number">${frappe.datetime.str_to_user(currentDate)} ${currentTime}</td>
                            </tr>
                        </table>
                        
                        <!-- قسم الرصيد السابق -->
                        <div class="opening-balance-info">
                            <div class="opening-balance-title">رصيد سابق - Previous Balance</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>الرصيد السابق حتى تاريخ ${openingDate || ""}:</div>
                                <div style="color: ${openingBalance >= 0 ? '#4272d7' : '#e53e3e'}; background-color: #fff; padding: 5px 15px; border-radius: 4px; font-size: 14px; border: 1px solid #ddd;">
                                    ${format_currency(Math.abs(openingBalance))} ${openingBalance >= 0 ? "دائن / Credit" : "مدين / Debit"}
                                </div>
                            </div>
                        </div>
                        
                        <!-- جدول المعاملات -->
                        <table class="transactions-table">
                            <thead>
                                <tr>
                                    <th style="width: 12%;">التاريخ<br/>Date</th>
                                    <th style="width: 13%;">رقم المستند<br/>Document No</th>
                                    <th style="width: 10%;">نوع المستند<br/>Type</th>
                                    <th style="width: 16%;">البيان<br/>Description</th>
                                    <th style="width: 11%;">حالة المستند<br/>Status</th>
                                    <th style="width: 11%;">مدين<br/>Debit</th>
                                    <th style="width: 11%;">دائن<br/>Credit</th>
                                    <th style="width: 16%;">الرصيد<br/>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactionRows.join('')}
                            </tbody>
                        </table>
                        
                        <div class="totals avoid-break">
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي المدين / Debit Total:</div>
                                <div class="en-number">${format_currency(totalDebit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">إجمالي الدائن / Credit Total:</div>
                                <div class="en-number">${format_currency(totalCredit)}</div>
                            </div>
                            <div class="total-box">
                                <div style="font-weight: bold; margin-bottom: 5px;">الرصيد الختامي / Closing Balance:</div>
                                <div class="en-number">${format_currency(Math.abs(closingBalance))} ${closingBalance >= 0 ? "دائن / Credit" : "مدين / Debit"}</div>
                            </div>
                        </div>
                        
                        <div class="signatures avoid-break">
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>توقيع المورد / Supplier Signature</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المحاسب / Accountant</div>
                            </div>
                            <div class="signature-box">
                                <div class="signature-line"></div>
                                <div>المدير المالي / Financial Manager</div>
                            </div>
                        </div>
                        
                        <div class="footer avoid-break">
                            تم إصدار هذا الكشف بتاريخ <span class="en-number">${frappe.datetime.str_to_user(currentDate)} ${currentTime}</span>
                        </div>
                    </body>
                    </html>
                    `;
                    
                    resolve(html);
                });
            });
        } catch (error) {
            reject(error);
        }
    });
}

// CSV export function
function downloadCSV(data, filename) {
    var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // Add BOM for Arabic support
    
    // Prepare headers
    var headers = ["التاريخ", "رقم المستند", "نوع المستند", __("Particulars"), "حالة المستند", "مدين", "دائن", __("Balance")];
    csvContent += headers.join(",") + "\r\n";
    
    // Add data
    data.forEach(function(row) {
        if (!row.is_total_row && row.voucher_type !== "Opening Balance") {
            var rowData = [
                frappe.datetime.str_to_user(row.posting_date) || "",
                '"' + (row.voucher_no || "") + '"',
                '"' + (row.voucher_type || "") + '"',
                '"' + (row.description || "لايوجد ملاحظات") + '"',
                '"' + (row.invoice_status || "") + '"',
                row.debit || 0,
                row.credit || 0,
                row.balance || 0
            ];
            
            // Convert numeric values to text to avoid comma issues
            rowData = rowData.map(function(val) {
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