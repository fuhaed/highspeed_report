// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Simple Sales Log"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
            "reqd": 1,
            "width": "150px"
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
            "fieldname": "customer",
            "label": __("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "width": "150px",
            "get_query": function() {
                return {
                    "filters": [
                        ["Customer", "disabled", "=", 0]
                    ]
                };
            }
        },
        {
            "fieldname": "status",
            "label": __("حالة الفاتورة"),
            "fieldtype": "Select",
            "options": "\nPaid\nUnpaid\nPartly Paid\nOverdue\nCredit Note Issued\nReturn",
            "width": "150px",
            "translatedOptions": {
                "Paid": __("مسددة بالكامل"),
                "Unpaid": __("غير مسددة"),
                "Partly Paid": __("مسددة جزئياً"),
                "Overdue": __("متأخرة السداد"),
                "Credit Note Issued": __("إشعار دائن مصدر"),
                "Return": __("مرتجع")
            }
        },
        {
            "fieldname": "invoice_type",
            "label": __("نوع الفاتورة"),
            "fieldtype": "Select",
            "options": "\nSales\nReturn",
            "default": "",
            "width": "100px",
            "translatedOptions": {
                "Sales": __("مبيعات"),
                "Return": __("مرتجعات")
            }
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // Avoid showing "null" in any column
            if (value === null || value === "null") {
                value = "";
            }
            
            // Format invoice status - with color coding
            if (column.fieldname === "invoice_status") {
                if (!value) return '';
                
                let color = "black";
                if (value.includes("مرتجع")) {
                    color = "red";
                } else if (value.includes("مسددة بالكامل")) {
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
            
            // Format for amount column
            if (column.fieldname === "grand_total") {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
            
            // Format for voucher_no column - add link
            if (column.fieldname === "voucher_no") {
                return `<a href="/app/sales-invoice/${value}" target="_blank">${value}</a>`;
            }
        }
        
        return default_formatter(value || "", row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير سجل المبيعات البسيط");
        
        try {
            // Add custom CSS
            $('<style>\
                .datatable .dt-cell { padding: 3px 6px !important; }\
                .datatable .dt-row { border-bottom: 1px solid #eee; }\
                .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
                .sales-summary-section { direction: rtl; }\
                .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
                .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
                .summary-amount { font-size: 20px; font-weight: bold; }\
                .summary-card.total { border-right: 5px solid #4272d7; }\
                .summary-card.invoice-count { border-right: 5px solid #28a745; }\
                .total-amount { color: #4272d7; }\
                .invoice-count-value { color: #28a745; }\
            </style>').appendTo('head');
            
            // Create sales summary section
            var $salesSummarySection = $('<div class="sales-summary-section" style="margin-bottom: 20px; padding: 15px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);"></div>');
            var $salesSummaryHeader = $('<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' + __("ملخص سجل المبيعات") + '</h3><div class="report-date"></div></div>');
            
            // Create row for summary cards
            var $summaryCardsSection = $('<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>');
            
            // Create summary cards
            var $totalCard = $('<div class="summary-card total" style="flex: 1;"><div class="summary-card-title">' + __("إجمالي المبيعات") + '</div><div class="summary-amount total-amount"></div></div>');
            var $invoiceCountCard = $('<div class="summary-card invoice-count" style="flex: 1;"><div class="summary-card-title">' + __("عدد الفواتير") + '</div><div class="summary-amount invoice-count-value"></div></div>');
            
            $summaryCardsSection.append($totalCard).append($invoiceCountCard);
            $salesSummarySection.append($salesSummaryHeader).append($summaryCardsSection);
            
            // Add section to the top of the report after filters
            if (report.page.main.find('.sales-summary-section').length === 0) {
                report.page.main.find('.report-filter-section').after($salesSummarySection);
            }
            
            // Update sales summary when data is loaded
            var originalRefresh = report.refresh;
            report.refresh = function() {
                originalRefresh.call(this);
                
                // Check if data is available
                if (report.data && report.data.length > 0) {
                    try {
                        updateSalesSummary(report.data, report.get_values());
                    } catch (e) {
                        console.error("Error updating sales summary:", e);
                        frappe.msgprint({
                            title: __("Error"),
                            message: __("حدث خطأ أثناء تحديث ملخص المبيعات. يرجى تحديث الصفحة."),
                            indicator: 'red'
                        });
                    }
                }
            };
            
            // Add print button
            report.page.add_inner_button(__("Print Report"), function() {
                if (report.data && report.data.length > 0) {
                    printReport(report.data, report.get_values());
                } else {
                    frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
                }
            });
            
            // Add export button
            report.page.add_inner_button(__("تصدير"), function() {
                if (report.data && report.data.length > 0) {
                    downloadCSV(report.data, "simple_sales_log_" + frappe.datetime.get_today() + ".csv");
                } else {
                    frappe.msgprint(__("لا توجد بيانات للتصدير"));
                }
            });
        
        } catch (e) {
            console.error("Error in Simple Sales Log onload:", e);
            frappe.msgprint({
                title: __("Error"),
                message: __("حدث خطأ أثناء تهيئة التقرير. يرجى تحديث الصفحة."),
                indicator: 'red'
            });
        }
    }
};

// Function to update sales summary
function updateSalesSummary(data, filters) {
    // Update report date
    $(".report-date").html(`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())} ${formatTime(frappe.datetime.now_time())}</span>`);
    
    // Separate regular rows from total rows
    var regularRows = [];
    var totalRow = null;
    
    // Identify regular rows and the total row (if any)
    data.forEach(function(row) {
        if (row.is_total_row) {
            totalRow = row;
        } else {
            regularRows.push(row);
        }
    });
    
    // Calculate totals properly from regular rows only
    var totalAmount = regularRows.reduce((sum, row) => sum + flt(row.grand_total), 0);
    var invoiceCount = regularRows.length;
    
    // Update summary cards with the correct values
    $(".total-amount").text(format_currency(totalAmount));
    $(".invoice-count-value").text(invoiceCount);
}

// Function to print the report
function printReport(data, filters) {
    try {
        // Show wait message while preparing the report
        frappe.show_alert({
            message: __("جاري تجهيز التقرير للطباعة..."),
            indicator: 'blue'
        });
    
        // Get company information
        frappe.db.get_value('Company', filters.company, ['company_name', 'tax_id'], function(companyInfo) {
            // Create sales table rows
            var salesRows = [];
            
            // We will only use rows that contain actual invoice data
            // This means excluding ANY row that might be a total, subtotal, or summary row
            var actualDataRows = [];
            
            // Identify actual invoice rows - rows with a valid voucher_no are actual data
            data.forEach(function(row) {
                // Only include rows that have an actual invoice number and are not summary/total rows
                if (row.voucher_no && !row.is_total_row && row.grand_total !== undefined) {
                    actualDataRows.push(row);
                }
            });
            
            // Calculate correct total from actual data rows only
            var totalAmount = actualDataRows.reduce((sum, row) => sum + flt(row.grand_total), 0);
            
            // Add only the actual data rows to the output
            actualDataRows.forEach(function(row) {
                salesRows.push(`
                    <tr>
                        <td>${formatDate(row.posting_date)} ${formatTime(row.posting_time)}</td>
                        <td>${row.voucher_no}</td>
                        <td>${row.voucher_type}</td>
                        <td>${row.customer_name}</td>
                        <td>${row.invoice_status}</td>
                        <td>${format_currency(row.grand_total)}</td>
                        <td>${row.owner}</td>
                    </tr>
                `);
            });
            
            // Add only one total row with the correct total
            salesRows.push(`
                <tr style="font-weight: bold; background-color: #f2f2f2;">
                    <td colspan="5" style="text-align: center;">${__("Grand Total")}</td>
                    <td>${format_currency(totalAmount)}</td>
                    <td></td>
                </tr>
            `);
            
            // Build HTML template for printing
            var currentDate = frappe.datetime.get_today();
            var currentTime = frappe.datetime.now_time();
            
            var html = `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>سجل المبيعات</title>
                <style>
                    @page {
                        size: A4;
                        margin: 1cm;
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        margin: 0; 
                        padding: 0;
                        direction: rtl;
                        font-size: 12px;
                    }
                    .company-info {
                        text-align: center;
                        margin-bottom: 15px;
                        padding: 5px;
                        border-bottom: 1px solid #000;
                    }
                    .company-info h3 {
                        margin: 5px 0;
                        font-size: 18px;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-bottom: 20px; 
                    }
                    th, td { 
                        border: 1px solid #000; 
                        padding: 5px; 
                        text-align: center;
                    }
                    th { 
                        background-color: #f2f2f2; 
                        font-weight: bold;
                    }
                    .report-title {
                        text-align: center;
                        margin: 10px 0;
                        font-size: 16px;
                        font-weight: bold;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        font-size: 10px;
                        border-top: 1px solid #000;
                        padding-top: 5px;
                    }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="company-info">
                    <h3>${companyInfo.company_name}</h3>
                    <div>الرقم الضريبي: ${companyInfo.tax_id || "---"}</div>
                </div>
                
                <div class="report-title">
                    سجل المبيعات / Sales Log
                </div>
                
                <table class="info-table">
                    <tr>
                        <td style="width: 20%; background-color: #f2f2f2; font-weight: bold;">الفترة / Period:</td>
                        <td style="width: 30%;">${formatDate(filters.from_date)} ${formatTime(filters.from_time)} - ${formatDate(filters.to_date)} ${formatTime(filters.to_time)}</td>
                        <td style="width: 20%; background-color: #f2f2f2; font-weight: bold;">تاريخ التقرير / Report Date:</td>
                        <td style="width: 30%;">${formatDate(currentDate)} ${formatTime(currentTime)}</td>
                    </tr>
                    ${filters.customer ? `
                    <tr>
                        <td style="background-color: #f2f2f2; font-weight: bold;">العميل / Customer:</td>
                        <td colspan="3">${filters.customer}</td>
                    </tr>` : ''}
                    ${filters.status ? `
                    <tr>
                        <td style="background-color: #f2f2f2; font-weight: bold;">حالة الفاتورة / Status:</td>
                        <td colspan="3">${filters.status}</td>
                    </tr>` : ''}
                    ${filters.invoice_type ? `
                    <tr>
                        <td style="background-color: #f2f2f2; font-weight: bold;">نوع الفاتورة / Type:</td>
                        <td colspan="3">${filters.invoice_type === 'Sales' ? 'مبيعات' : filters.invoice_type === 'Return' ? 'مرتجعات' : filters.invoice_type}</td>
                    </tr>` : ''}
                </table>
                
                <table class="sales-table">
                    <thead>
                        <tr>
                            <th>التاريخ والوقت<br/>Date & Time</th>
                            <th>رقم المستند<br/>Document No</th>
                            <th>نوع المستند<br/>Type</th>
                            <th>العميل<br/>Customer</th>
                            <th>حالة الفاتورة<br/>Status</th>
                            <th>المبلغ<br/>Amount</th>
                            <th>المستخدم<br/>User</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salesRows.join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    تم إصدار هذا التقرير بتاريخ ${formatDate(currentDate)} ${formatTime(currentTime)}
                </div>
            </body>
            </html>
            `;
            
            // Open print window
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
        }).catch(function(error) {
            console.error("Error getting company info:", error);
            frappe.msgprint({
                title: __("Error"),
                message: __("حدث خطأ أثناء جلب معلومات الشركة للطباعة."),
                indicator: 'red'
            });
        });
    } catch (e) {
        console.error("Error in print report function:", e);
        frappe.msgprint({
            title: __("Error"),
            message: __("حدث خطأ أثناء تجهيز التقرير للطباعة."),
            indicator: 'red'
        });
    }
}

// Function to export data as CSV
function downloadCSV(data, filename) {
    try {
        var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // Add BOM for Arabic support
        
        // Add report title and filters
        csvContent += "سجل المبيعات - Simple Sales Log\r\n";
        const filters = frappe.query_report.get_values();
        csvContent += "الفترة / Period:," + formatDate(filters.from_date) + " " + formatTime(filters.from_time) + " - " + formatDate(filters.to_date) + " " + formatTime(filters.to_time) + "\r\n";
        
        if (filters.customer) {
            csvContent += "العميل / Customer:," + filters.customer + "\r\n";
        }
        
        if (filters.status) {
            csvContent += "حالة الفاتورة / Status:," + filters.status + "\r\n";
        }
        
        if (filters.invoice_type) {
            let typeText = filters.invoice_type === 'Sales' ? 'مبيعات' : 
                           filters.invoice_type === 'Return' ? 'مرتجعات' : filters.invoice_type;
            csvContent += "نوع الفاتورة / Type:," + typeText + "\r\n";
        }
        
        csvContent += "\r\n"; // Add blank line after filters
        
        // Prepare headers
        var headers = ["التاريخ", "الوقت", "رقم المستند", "نوع المستند", __("Customer"), "حالة الفاتورة", __("Amount"), "المستخدم"];
        csvContent += headers.join(",") + "\r\n";
        
        // Separate regular rows from total rows
        var regularRows = [];
        var totalRow = null;
        
        // Identify regular rows and the total row (if any)
        data.forEach(function(row) {
            if (row.is_total_row) {
                totalRow = row;
            } else {
                regularRows.push(row);
            }
        });
        
        // Calculate correct total
        var totalAmount = regularRows.reduce((sum, row) => sum + flt(row.grand_total), 0);
        
        // Add data (only regular rows, not total rows)
        regularRows.forEach(function(row) {
            var rowData = [
                row.posting_date || "",
                row.posting_time || "",
                row.voucher_no || "",
                row.voucher_type || "",
                `"${row.customer_name || ""}"`,
                `"${row.invoice_status || ""}"`,
                row.grand_total || 0,
                `"${row.owner || ""}"`
            ];
            
            csvContent += rowData.join(",") + "\r\n";
        });
        
        // Add total row with the correct total
        csvContent += `"","","","","${__("الإجمالي / Total")}",${totalAmount},""\r\n`;
        
        // Export file
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Error exporting CSV:", e);
        frappe.msgprint({
            title: __("Error"),
            message: __("حدث خطأ أثناء تصدير البيانات."),
            indicator: 'red'
        });
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