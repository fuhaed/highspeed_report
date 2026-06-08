frappe.query_reports["Sales Invoice Payment Breakdown"] = {
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
            "get_data": function(txt) {
                return frappe.db.get_link_options('POS Profile', txt);
            },
            "width": "150px"
        },
        {
            "fieldname": "owner",
            "label": __("المستخدم"),
            "fieldtype": "MultiSelectList",
            "get_data": function(txt) {
                return frappe.db.get_link_options('User', txt);
            },
            "width": "150px"
        },
        {
            "fieldname": "warehouse",
            "label": __("المستودع"),
            "fieldtype": "MultiSelectList",
            "get_data": function(txt) {
                return frappe.db.get_link_options('Warehouse', txt);
            },
            "width": "150px"
        },
        {
            "fieldname": "mode_of_payment",
            "label": __("Payment Mode"),
            "fieldtype": "MultiSelectList",
            "get_data": function(txt) {
                return frappe.db.get_link_options('Mode of Payment', txt);
            },
            "width": "150px"
        },
        {
            "fieldname": "cost_center",
            "label": __("Cost Center"),
            "fieldtype": "MultiSelectList",
            "get_data": function(txt) {
                return frappe.db.get_link_options('Cost Center', txt);
            },
            "width": "150px"
        },
        {
            "fieldname": "status",
            "label": __("حالة الفاتورة"),
            "fieldtype": "Select",
            "options": "\nPaid\nUnpaid\nPartly Paid\nOverdue\nCredit Note Issued\nReturn",
            "width": "150px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            if (value === null || value === "null") {
                value = "";
            }
            
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
            
            if (column.fieldname === "multiple_payments") {
                if (value === "✓") {
                    return '<span style="color: #fd7e14; font-weight: bold; font-size: 14px;">✓</span>';
                }
                return value;
            }
            
            if (column.fieldname === "payment_amount" || column.fieldname === "invoice_total" || column.fieldname === "tax_amount") {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
            
            if (data.is_total_row) {
                return '<span style="font-weight: bold;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value || "", row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير تفصيل دفعات الفواتير");
        
        $('<style>\
            .datatable .dt-cell { padding: 0px !important; }\
            .datatable .dt-row { border-bottom: 1px solid #eee; }\
            .datatable .dt-header .dt-cell { background-color: #f5f7fa; font-weight: bold; }\
            .payment-summary-section { direction: rtl; }\
            .summary-card { background-color: #f8f8f8; border-radius: 5px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }\
            .summary-card-title { font-weight: bold; margin-bottom: 10px; font-size: 16px; }\
            .summary-amount { font-size: 20px; font-weight: bold; }\
            .summary-card.total { border-right: 5px solid #4272d7; }\
            .summary-card.invoice-count { border-right: 5px solid #28a745; }\
            .summary-card.payment-method { border-right: 5px solid #fd7e14; }\
            .summary-card.payment-lines { border-right: 5px solid #6f42c1; }\
            .total-amount { color: #4272d7; }\
            .invoice-count-value { color: #28a745; }\
            .payment-method-value { color: #fd7e14; }\
            .payment-lines-value { color: #6f42c1; }\
        </style>').appendTo('head');
        
        var $paymentSummarySection = $('<div class="payment-summary-section" style="margin-bottom: 20px; padding: 20px; background-color: #fff; border: 1px solid #ddd; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);"></div>');
        var $paymentSummaryHeader = $('<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;"><h3 style="margin: 0; color: #333; font-weight: bold;">' + __("ملخص تفصيل دفعات الفواتير") + '</h3><div class="report-date"></div></div>');
        
        var $summaryCardsSection = $('<div class="summary-cards" style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;"></div>');
        
        var $totalCard = $('<div class="summary-card total" style="flex: 1;"><div class="summary-card-title">' + __("إجمالي المبالغ المحصلة") + '</div><div class="summary-amount total-amount"></div></div>');
        var $invoiceCountCard = $('<div class="summary-card invoice-count" style="flex: 1;"><div class="summary-card-title">' + __("عدد الفواتير") + '</div><div class="summary-amount invoice-count-value"></div></div>');
        var $paymentMethodsCard = $('<div class="summary-card payment-method" style="flex: 1;"><div class="summary-card-title">' + __("Payment Modes") + '</div><div class="summary-amount payment-method-value"></div></div>');
        var $paymentLinesCard = $('<div class="summary-card payment-lines" style="flex: 1;"><div class="summary-card-title">' + __("عدد خطوط الدفع") + '</div><div class="summary-amount payment-lines-value"></div></div>');
        
        $summaryCardsSection.append($totalCard).append($invoiceCountCard).append($paymentMethodsCard).append($paymentLinesCard);
        
        var $paymentDetailsSection = $('<div class="payment-details" style="margin-top: 20px;"></div>');
        
        $paymentSummarySection.append($paymentSummaryHeader).append($summaryCardsSection).append($paymentDetailsSection);
        
        if (report.page.main.find('.payment-summary-section').length === 0) {
            report.page.main.find('.report-filter-section').after($paymentSummarySection);
        }
        
        var originalRefresh = report.refresh;
        report.refresh = function() {
            originalRefresh.call(this);
            
            if (report.data && report.data.length > 0) {
                updatePaymentSummary(report.data, report.get_values());
            }
        };
        
        function updatePaymentSummary(data, filters) {
            $(".report-date").html(`<span style="font-size: 14px;">${__("تاريخ التقرير")}: ${formatDate(frappe.datetime.get_today())} ${formatTime(frappe.datetime.now_time())}</span>`);
            
            var totalPayments = 0;
            var uniqueInvoices = new Set();
            var paymentMethods = new Set();
            var paymentLines = 0;
            var uniqueInvoicesData = {};
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    totalPayments += flt(row.payment_amount);
                    uniqueInvoices.add(row.voucher_no);
                    if (row.mode_of_payment && row.mode_of_payment !== "غير محدد") {
                        paymentMethods.add(row.mode_of_payment);
                    }
                    paymentLines++;
                    
                    if (!uniqueInvoicesData[row.voucher_no]) {
                        uniqueInvoicesData[row.voucher_no] = {
                            invoice_total: row.invoice_total,
                            tax_amount: row.tax_amount
                        };
                    }
                }
            });
            
            var totalInvoiceAmount = 0;
            var totalTaxAmount = 0;
            Object.keys(uniqueInvoicesData).forEach(function(invoiceNo) {
                totalInvoiceAmount += flt(uniqueInvoicesData[invoiceNo].invoice_total);
                totalTaxAmount += flt(uniqueInvoicesData[invoiceNo].tax_amount);
            });
            
            $(".total-amount").text(format_currency(totalPayments));
            $(".invoice-count-value").text(uniqueInvoices.size);
            $(".payment-method-value").text(paymentMethods.size);
            $(".payment-lines-value").text(paymentLines);
            
            $(".payment-details").empty();
            
            var paymentMethodsData = {};
            var invoiceBreakdown = {};
            var posProfilesData = {};
            var usersData = {};
            var warehousesData = {};
            var costCentersData = {};
            var accountsData = {};
            
            data.forEach(function(row) {
                if (!row.is_total_row) {
                    if (row.mode_of_payment) {
                        if (!paymentMethodsData[row.mode_of_payment]) {
                            paymentMethodsData[row.mode_of_payment] = {
                                count: 0,
                                amount: 0,
                                invoices: new Set()
                            };
                        }
                        paymentMethodsData[row.mode_of_payment].count++;
                        paymentMethodsData[row.mode_of_payment].amount += flt(row.payment_amount);
                        paymentMethodsData[row.mode_of_payment].invoices.add(row.voucher_no);
                    }
                    
                    if (row.voucher_no) {
                        if (!invoiceBreakdown[row.voucher_no]) {
                            invoiceBreakdown[row.voucher_no] = {
                                customer: row.customer_name,
                                total: row.invoice_total,
                                payments: []
                            };
                        }
                        invoiceBreakdown[row.voucher_no].payments.push({
                            method: row.mode_of_payment,
                            amount: row.payment_amount
                        });
                    }
                    
                    if (row.pos_profile) {
                        if (!posProfilesData[row.pos_profile]) {
                            posProfilesData[row.pos_profile] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        posProfilesData[row.pos_profile].count++;
                        posProfilesData[row.pos_profile].amount += flt(row.payment_amount);
                    }
                    
                    if (row.owner) {
                        if (!usersData[row.owner]) {
                            usersData[row.owner] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        usersData[row.owner].count++;
                        usersData[row.owner].amount += flt(row.payment_amount);
                    }
                    
                    if (row.warehouse) {
                        if (!warehousesData[row.warehouse]) {
                            warehousesData[row.warehouse] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        warehousesData[row.warehouse].count++;
                        warehousesData[row.warehouse].amount += flt(row.payment_amount);
                    }
                    
                    if (row.cost_center) {
                        if (!costCentersData[row.cost_center]) {
                            costCentersData[row.cost_center] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        costCentersData[row.cost_center].count++;
                        costCentersData[row.cost_center].amount += flt(row.payment_amount);
                    }
                    
                    if (row.account) {
                        if (!accountsData[row.account]) {
                            accountsData[row.account] = {
                                count: 0,
                                amount: 0
                            };
                        }
                        accountsData[row.account].count++;
                        accountsData[row.account].amount += flt(row.payment_amount);
                    }
                }
            });
            
            var $analysisSection = $('<div style="margin-top: 20px;"></div>');
            
            if (Object.keys(paymentMethodsData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب طريقة الدفع") + '</h4>');
                var $paymentMethodsTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Payment Mode") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("عدد الفواتير") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(paymentMethodsData).forEach(function(method) {
                    $paymentMethodsTable.find('tbody').append('<tr><td>' + method + '</td><td>' + paymentMethodsData[method].count + '</td><td>' + paymentMethodsData[method].invoices.size + '</td><td>' + format_currency(paymentMethodsData[method].amount) + '</td></tr>');
                });
                
                $analysisSection.append($paymentMethodsTable);
            }
            
            if (Object.keys(invoiceBreakdown).length > 0 && Object.keys(invoiceBreakdown).length <= 20) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("تفصيل دفعات الفواتير") + '</h4>');
                var $invoiceBreakdownTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Invoice No") + '</th><th>' + __("Customer") + '</th><th>' + __("إجمالي الفاتورة") + '</th><th>' + __("تفصيل الدفعات") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(invoiceBreakdown).forEach(function(invoiceNo) {
                    var invoice = invoiceBreakdown[invoiceNo];
                    var paymentsText = invoice.payments.map(function(payment) {
                        return payment.method + ': ' + format_currency(payment.amount);
                    }).join('<br/>');
                    
                    $invoiceBreakdownTable.find('tbody').append(`<tr>
                        <td><a href="/app/sales-invoice/${invoiceNo}" target="_blank">${invoiceNo}</a></td>
                        <td>${invoice.customer}</td>
                        <td>${format_currency(invoice.total)}</td>
                        <td>${paymentsText}</td>
                    </tr>`);
                });
                
                $analysisSection.append($invoiceBreakdownTable);
            }
            
            if (Object.keys(posProfilesData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب نقطة البيع") + '</h4>');
                var $posProfilesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("نقطة البيع") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(posProfilesData).forEach(function(profile) {
                    $posProfilesTable.find('tbody').append('<tr><td>' + profile + '</td><td>' + posProfilesData[profile].count + '</td><td>' + format_currency(posProfilesData[profile].amount) + '</td></tr>');
                });
                
                $analysisSection.append($posProfilesTable);
            }
            
            if (Object.keys(usersData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب المستخدم") + '</h4>');
                var $usersTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("المستخدم") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(usersData).forEach(function(user) {
                    $usersTable.find('tbody').append('<tr><td>' + user + '</td><td>' + usersData[user].count + '</td><td>' + format_currency(usersData[user].amount) + '</td></tr>');
                });
                
                $analysisSection.append($usersTable);
            }
            
            if (Object.keys(warehousesData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب المستودع") + '</h4>');
                var $warehousesTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("المستودع") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(warehousesData).forEach(function(warehouse) {
                    $warehousesTable.find('tbody').append('<tr><td>' + warehouse + '</td><td>' + warehousesData[warehouse].count + '</td><td>' + format_currency(warehousesData[warehouse].amount) + '</td></tr>');
                });
                
                $analysisSection.append($warehousesTable);
            }
            
            if (Object.keys(costCentersData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب مركز التكلفة") + '</h4>');
                var $costCentersTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Cost Center") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(costCentersData).forEach(function(center) {
                    $costCentersTable.find('tbody').append('<tr><td>' + center + '</td><td>' + costCentersData[center].count + '</td><td>' + format_currency(costCentersData[center].amount) + '</td></tr>');
                });
                
                $analysisSection.append($costCentersTable);
            }
            
            if (Object.keys(accountsData).length > 0) {
                $analysisSection.append('<h4 style="margin-bottom: 15px; color: #333; font-weight: bold;">' + __("التحليل حسب الحساب") + '</h4>');
                var $accountsTable = $('<table class="table table-bordered" style="width: 100%; margin-bottom: 20px;"><thead><tr><th>' + __("Account") + '</th><th>' + __("عدد الدفعات") + '</th><th>' + __("Amount") + '</th></tr></thead><tbody></tbody></table>');
                
                Object.keys(accountsData).forEach(function(account) {
                    $accountsTable.find('tbody').append('<tr><td>' + account + '</td><td>' + accountsData[account].count + '</td><td>' + format_currency(accountsData[account].amount) + '</td></tr>');
                });
                
                $analysisSection.append($accountsTable);
            }
            
            $(".payment-details").append($analysisSection);
        }
        
        report.page.add_inner_button(__("طباعة تفصيل دفعات الفواتير"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                frappe.show_alert({
                    message: __("جاري تجهيز التقرير للطباعة..."),
                    indicator: 'blue'
                });
                
                createPaymentBreakdownPrintForm(data, filters)
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
        
        report.page.add_inner_button(__("تصدير"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                downloadCSV(data, "payment_breakdown_" + filters.from_date + "_to_" + filters.to_date + ".csv");
            } else {
                frappe.msgprint(__("لا توجد بيانات للتصدير"));
            }
        });
    }
};

function createPaymentBreakdownPrintForm(data, filters) {
    return new Promise(function(resolve, reject) {
        try {
            frappe.db.get_value('Company', filters.company, ['company_name', 'tax_id'], function(companyInfo) {
                
                var paymentRows = [];
                
                data.forEach(function(row) {
                    if (!row.is_total_row) {
                        var posting_date = row.posting_date || "";
                        var posting_time = row.posting_time || "";
                        var voucher_no = row.voucher_no || "";
                        var customer_name = row.customer_name || "";
                        var mode_of_payment = row.mode_of_payment || "";
                        var payment_amount = row.payment_amount || 0;
                        var base_amount = row.base_amount || 0;
                        var invoice_total = row.invoice_total || 0;
                        var tax_amount = row.tax_amount || 0;
                        var invoice_status = row.invoice_status || "";
                        var pos_profile = row.pos_profile || "";
                        var owner = row.owner || "";
                        var warehouse = row.warehouse || "";
                        var cost_center = row.cost_center || "";
                        var account = row.account || "";
                        
                        paymentRows.push(`
                            <tr>
                                <td>${formatDate(posting_date)} ${formatTime(posting_time)}</td>
                                <td>${voucher_no}</td>
                                <td>${customer_name}</td>
                                <td>${mode_of_payment}</td>
                                <td>${format_currency(payment_amount)}</td>
                                <td>${format_currency(invoice_total)}</td>
                                <td>${format_currency(tax_amount)}</td>
                                <td>${invoice_status}</td>
                                <td>${pos_profile}</td>
                                <td>${owner}</td>
                                <td>${warehouse}</td>
                                <td>${cost_center}</td>
                                <td>${account}</td>
                            </tr>
                        `);
                    }
                });
                
                var totalRow = data.find(row => row.is_total_row);
                if (totalRow) {
                    paymentRows.push(`
                        <tr style="font-weight: bold; background-color: #f2f2f2;">
                            <td colspan="4" style="text-align: center;">${__("Grand Total")}</td>
                            <td>${format_currency(totalRow.payment_amount || 0)}</td>
                            <td>${format_currency(totalRow.invoice_total || 0)}</td>
                            <td>${format_currency(totalRow.tax_amount || 0)}</td>
                            <td colspan="5"></td>
                        </tr>
                    `);
                }
                
                var currentDate = frappe.datetime.get_today();
                var currentTime = frappe.datetime.now_time();
                
                var html = `
                <!DOCTYPE html>
                <html dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>تفصيل دفعات الفواتير</title>
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
                            font-size: 10px;
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
                            padding: 2px 1px; 
                            text-align: center;
                            font-size: 9px;
                            overflow: hidden;
                        }
                        th { 
                            background-color: #f2f2f2; 
                            font-weight: bold;
                            font-size: 9px;
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
                        تفصيل دفعات الفواتير / Sales Invoice Payment Breakdown
                    </div>
                    
                    <table class="info-table">
                        <tr>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">الفترة / Period:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(filters.from_date)} ${formatTime(filters.from_time)} - ${formatDate(filters.to_date)} ${formatTime(filters.to_time)}</td>
                            <td style="width: 15%; background-color: #f2f2f2; font-weight: bold; text-align: left;">تاريخ التقرير / Report Date:</td>
                            <td style="width: 35%;" class="en-number">${formatDate(currentDate)} ${formatTime(currentTime)}</td>
                        </tr>
                    </table>
                    
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th style="width: 8%;">التاريخ والوقت<br/>Date & Time</th>
                                <th style="width: 8%;">رقم الفاتورة<br/>Invoice No</th>
                                <th style="width: 10%;">العميل<br/>Customer</th>
                                <th style="width: 8%;">طريقة الدفع<br/>Payment Method</th>
                                <th style="width: 7%;">مبلغ الدفع<br/>Payment Amount</th>
                                <th style="width: 7%;">إجمالي الفاتورة<br/>Invoice Total</th>
                                <th style="width: 6%;">الضريبة<br/>Tax</th>
                                <th style="width: 7%;">حالة الفاتورة<br/>Status</th>
                                <th style="width: 7%;">نقطة البيع<br/>POS</th>
                                <th style="width: 7%;">المستخدم<br/>User</th>
                                <th style="width: 7%;">المستودع<br/>Warehouse</th>
                                <th style="width: 8%;">مركز التكلفة<br/>Cost Center</th>
                                <th style="width: 9%;">الحساب<br/>Account</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRows.join('')}
                        </tbody>
                    </table>
                    
                    <div class="footer avoid-break">
                        تم إصدار هذا التقرير بتاريخ <span class="en-number">${formatDate(currentDate)} ${formatTime(currentTime)}</span>
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

function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    var day = d.getDate().toString().padStart(2, '0');
    var month = (d.getMonth() + 1).toString().padStart(2, '0');
    var year = d.getFullYear();
    return day + '/' + month + '/' + year;
}

function formatTime(timeStr) {
    if (!timeStr) return "";
    return timeStr.substr(0, 5);
}

function downloadCSV(data, filename) {
    var csvContent = "data:text/csv;charset=utf-8,\ufeff";
    
    var headers = ["التاريخ", "الوقت", __("Invoice No"), __("Customer"), __("Payment Mode"), __("Payment Amount"), "دفع متعدد", "إجمالي الفاتورة", __("Tax"), "حالة الفاتورة", "نقطة البيع", "المستخدم", "المستودع", __("Cost Center"), __("Account")];
    csvContent += headers.join(",") + "\r\n";
    
    data.forEach(function(row) {
        if (!row.is_total_row) {
            var rowData = [
                row.posting_date || "",
                row.posting_time || "",
                '"' + (row.voucher_no || "") + '"',
                '"' + (row.customer_name || "") + '"',
                '"' + (row.mode_of_payment || "") + '"',
                row.payment_amount || 0,
                '"' + (row.multiple_payments || "") + '"',
                row.invoice_total || 0,
                row.tax_amount || 0,
                '"' + (row.invoice_status || "") + '"',
                '"' + (row.pos_profile || "") + '"',
                '"' + (row.owner || "") + '"',
                '"' + (row.warehouse || "") + '"',
                '"' + (row.cost_center || "") + '"',
                '"' + (row.account || "") + '"'
            ];
            
            rowData = rowData.map(function(val) {
                if (val === null || val === "null") return "";
                if (val === "") return val;
                return typeof val === 'number' ? val.toFixed(2) : val;
            });
            
            csvContent += rowData.join(",") + "\r\n";
        }
    });
    
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}