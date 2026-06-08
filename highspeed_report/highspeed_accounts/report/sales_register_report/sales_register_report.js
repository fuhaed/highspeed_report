// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Sales Register Report"] = {
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
            "fieldname": "mode_of_payment",
            "label": __("Payment Mode"),
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": "150px"
        },
        {
            "fieldname": "cost_center",
            "label": __("Cost Center"),
            "fieldtype": "Link",
            "options": "Cost Center",
            "width": "150px"
        },
        {
            "fieldname": "status",
            "label": __("حالة الفاتورة"),
            "fieldtype": "Select",
            "options": "\nDraft\nPaid\nUnpaid\nPartly Paid\nOverdue\nCancelled\nReturn",
            "width": "150px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // تنسيق عمود نوع المستند - ترجمة الأنواع إلى العربية
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
                        return value;
                }
            }
            
            // تنسيق لحالة الفاتورة - مع ترميز اللون
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
            
            // تنسيق للمبلغ
            if (column.fieldname === "grand_total" || column.fieldname === "tax_amount") {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
            
            // تنسيق أساسي للإجماليات
            if (data.is_total_row) {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value, row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير سجل المبيعات");
        
        // إضافة CSS مخصص
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
            .total-amount { color: #4272d7; }\
            .invoice-count-value { color: #28a745; }\
            .payment-method-value { color: #fd7e14; }\
        </style>').appendTo('head');
        
        // إنشاء قسم ملخص المبيعات
        var $salesSummarySection = $('<div class="sales-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>');
        var $salesSummaryHeader = $('<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' + __("ملخص سجل المبيعات") + '</h3><div class="report-date"></div></div>');
        
        // إنشاء صف لبطاقات الملخص
        var $summaryCardsSection = $('<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>');
        
        // إنشاء بطاقات الملخص
        var $totalCard = $('<div class="summary-card total" style="flex: 1;"><div class="summary-card-title">' + __("إجمالي المبيعات") + '</div><div class="summary-amount total-amount"></div></div>');
        var $invoiceCountCard = $('<div class="summary-card invoice-count" style="flex: 1;"><div class="summary-card-title">' + __("عدد الفواتير") + '</div><div class="summary-amount invoice-count-value"></div></div>');
        var $paymentMethodsCard = $('<div class="summary-card payment-method" style="flex: 1;"><div class="summary-card-title">' + __("Payment Modes") + '</div><div class="summary-amount payment-method-value"></div></div>');
        
        $summaryCardsSection.append($totalCard).append($invoiceCountCard).append($paymentMethodsCard);
        
        // إنشاء قسم تفاصيل المبيعات
        var $salesDetailsSection = $('<div class="sales-details" style="margin-top: 20px;"></div>');
        
        $salesSummarySection.append($salesSummaryHeader).append($summaryCardsSection).append($salesDetailsSection);
        
        // إضافة القسم في أعلى التقرير بعد المرشحات
        if (report.page.main.find('.sales-summary-section').length === 0) {
            report.page.main.find('.report-filter-section').after($salesSummarySection);
        }
        
        // تحديث ملخص المبيعات عند تحميل البيانات
        var originalRefresh = report.refresh;
        report.refresh = function() {
            originalRefresh.call(this);
            
            // التأكد من توفر البيانات
            if (report.data && report.data.length > 0) {
                updateSalesSummary(report.data, report.get_values());
            }
        };
        
        // دالة تحديث ملخص المبيعات
        function updateSalesSummary(data, filters) {
            // تحديث تاريخ التقرير
            $(".report-date").html(`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())}</span>`);
            
            // حساب الإجماليات
            var totalAmount = 0;
            var invoiceCount = 0;
            var paymentMethods = new Set();
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    totalAmount += flt(row.grand_total);
                    invoiceCount++;
                    if (row.mode_of_payment && row.mode_of_payment !== "غير محدد") {
                        paymentMethods.add(row.mode_of_payment);
                    }
                }
            });
            
            // تحديث بطاقات الملخص
            $(".total-amount").text(format_currency(totalAmount));
            $(".invoice-count-value").text(invoiceCount);
            $(".payment-method-value").text(paymentMethods.size);
            
            // تحديث تفاصيل المبيعات
            $(".sales-details").empty();
            
            // إنشاء تحليل بسيط للبيانات
            var paymentMethodsData = {};
            var invoiceStatuses = {};
            var costCenters = {};
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    // تجميع حسب طريقة الدفع
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
                    
                    // تجميع حسب حالة الفاتورة
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
                    
                    // تجميع حسب مركز التكلفة
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
                }
            });
            
            // عرض تحليل البيانات
            var $analysisSection = $('<div style="margin-top: 20px;"></div>');
            
            // تحليل حسب طريقة الدفع
            if (Object.keys(paymentMethodsData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب طريقة الدفع") + '</h4>');
                var $paymentMethodsTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Payment Mode") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(paymentMethodsData).forEach(function(method) {
                    $paymentMethodsTable.find('tbody').append('<tr><td>' + method + '</td><td>' + paymentMethodsData[method].count + '</td><td>' + format_currency(paymentMethodsData[method].amount) + '</td></tr>');
                });
                
                $analysisSection.append($paymentMethodsTable);
            }
            
            // تحليل حسب حالة الفاتورة
            if (Object.keys(invoiceStatuses).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب حالة الفاتورة") + '</h4>');
                var $invoiceStatusesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("حالة الفاتورة") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(invoiceStatuses).forEach(function(status) {
                    $invoiceStatusesTable.find('tbody').append('<tr><td>' + status + '</td><td>' + invoiceStatuses[status].count + '</td><td>' + format_currency(invoiceStatuses[status].amount) + '</td></tr>');
                });
                
                $analysisSection.append($invoiceStatusesTable);
            }
            
            // تحليل حسب مركز التكلفة
            if (Object.keys(costCenters).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب مركز التكلفة") + '</h4>');
                var $costCentersTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Cost Center") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(costCenters).forEach(function(center) {
                    $costCentersTable.find('tbody').append('<tr><td>' + center + '</td><td>' + costCenters[center].count + '</td><td>' + format_currency(costCenters[center].amount) + '</td></tr>');
                });
                
                $analysisSection.append($costCentersTable);
            }
            
            $(".sales-details").append($analysisSection);
        }
        
        // إضافة زر الطباعة
        report.page.add_inner_button(__("طباعة سجل المبيعات"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                // عرض رسالة الانتظار أثناء تجهيز التقرير
                frappe.show_alert({
                    message: __("جاري تجهيز التقرير للطباعة..."),
                    indicator: 'blue'
                });
                
                // إنشاء نموذج الطباعة
                createSalesRegisterPrintForm(data, filters)
                    .then(function(html) {
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
                
                downloadCSV(data, "sales_register_" + filters.from_date + "_to_" + filters.to_date + ".csv");
            } else {
                frappe.msgprint(__("لا توجد بيانات للتصدير"));
            }
        });
    }
};

// وظيفة طباعة سجل المبيعات
function createSalesRegisterPrintForm(data, filters) {
    return new Promise(function(resolve, reject) {
        try {
            // الحصول على معلومات الشركة
            frappe.db.get_value('Company', filters.company, ['company_name', 'tax_id'], function(companyInfo) {
                
                // إنشاء صفوف جدول المبيعات
                var salesRows = [];
                
                // إضافة صفوف المبيعات
                data.forEach(function(row) {
                    if (!row.is_total_row) {
                        salesRows.push(`
                            <tr>
                                <td>${formatDate(row.posting_date)}</td>
                                <td>${row.voucher_no || ""}</td>
                                <td>${row.voucher_type || ""}</td>
                                <td>${row.customer_name || ""}</td>
                                <td>${row.invoice_status || ""}</td>
                                <td>${format_currency(row.tax_amount || 0)}</td>
                                <td>${format_currency(row.grand_total)}</td>
                                <td>${row.cost_center || ""}</td>
                                <td>${row.mode_of_payment || ""}</td>
                            </tr>
                        `);
                    }
                });
                
                // إضافة صف الإجمالي
                var totalRow = data.find(row => row.is_total_row);
                if (totalRow) {
                    salesRows.push(`
                        <tr style="font-weight: bold; background-color: #f2f2f2;">
                            <td colspan="5" style="text-align: center;">${__("Grand Total")}</td>
                            <td>${format_currency(totalRow.tax_amount || 0)}</td>
                            <td>${format_currency(totalRow.grand_total)}</td>
                            <td colspan="2"></td>
                        </tr>
                    `);
                }
                
                // بناء قالب HTML للطباعة
                var currentDate = frappe.datetime.get_today();
                
                var html = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>سجل المبيعات</title>
                    <style>
                        @page {
                            size: A4 landscape;
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
                        .company-info {
                            text-align: center;
                            margin-bottom: 5px;
                            padding: 5px;
                            border-bottom: 1px solid #000;
                        }
                        .company-info h3 {
                            margin: 5px 0;
                            font-size: 16px;
                        }
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
                        .footer {
                            text-align: center;
                            margin-top: 5px;
                            font-size: 10px;
                            border-top: 1px solid #000;
                            padding-top: 5px;
                        }
                        /* تفعيل الأرقام الإنجليزية */
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
                    <div class="company-info">
                        <h3>${companyInfo.company_name}</h3>
                        <div>الرقم الضريبي: <span class="en-number">${companyInfo.tax_id || "—"}</span></div>
                    </div>
                    
                    <div class="report-title">
                        سجل المبيعات / Sales Register
                    </div>
                    
                    <table class="info-table">
                        <tr>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(filters.from_date)} - ${formatDate(filters.to_date)}</td>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(currentDate)}</td>
                        </tr>
                    </table>
                    
                    <table class="sales-table">
                        <thead>
                            <tr>
                                <th style="width: 8%;">التاريخ<br/>Date</th>
                                <th style="width: 10%;">رقم المستند<br/>Document No</th>
                                <th style="width: 10%;">نوع المستند<br/>Type</th>
                                <th style="width: 16%;">العميل<br/>Customer</th>
                                <th style="width: 12%;">حالة الفاتورة<br/>Status</th>
                                <th style="width: 10%;">الضريبة<br/>Tax</th>
                                <th style="width: 10%;">المبلغ<br/>Amount</th>
                                <th style="width: 12%;">مركز التكلفة<br/>Cost Center</th>
                                <th style="width: 12%;">طريقة الدفع<br/>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${salesRows.join('')}
                        </tbody>
                    </table>
                    
                    <div class="footer avoid-break">
                        تم إصدار هذا التقرير بتاريخ <span class="en-number">${formatDate(currentDate)}</span>
                    </div>
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

// دالة تنسيق التاريخ
function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    var day = d.getDate().toString().padStart(2, '0');
    var month = (d.getMonth() + 1).toString().padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
}

// دالة تصدير إلى CSV
function downloadCSV(data, filename) {
    var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // إضافة BOM لدعم اللغة العربية
    
    // تجهيز العناوين
    var headers = ["التاريخ", "رقم المستند", "نوع المستند", __("Customer"), "حالة الفاتورة", __("Tax"), __("Amount"), __("Cost Center"), __("Payment Mode")];
    csvContent += headers.join(",") + "\r\n";
    
    // إضافة البيانات
    data.forEach(function(row) {
        if (!row.is_total_row) {
            var rowData = [
                row.posting_date || "",
                '"' + (row.voucher_no || "") + '"',
                '"' + (row.voucher_type || "") + '"',
                '"' + (row.customer_name || "") + '"',
                '"' + (row.invoice_status || "") + '"',
                row.tax_amount || 0,
                row.grand_total || 0,
                '"' + (row.cost_center || "") + '"',
                '"' + (row.mode_of_payment || "") + '"'
            ];
            
            // تحويل القيم الرقمية إلى نص لتجنب مشكلات الفواصل
            rowData = rowData.map(function(val) {
                if (val === "") return val;
                return typeof val === 'number' ? val.toFixed(2) : val;
            });
            
            csvContent += rowData.join(",") + "\r\n";
        }
    });
    
    // تصدير الملف
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}