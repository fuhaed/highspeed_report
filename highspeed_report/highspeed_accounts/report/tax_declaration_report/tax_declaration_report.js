// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Tax Declaration Report"] = {
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
            "fieldname": "cost_center",
            "label": __("Cost Center"),
            "fieldtype": "Link",
            "options": "Cost Center",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    "filters": {
                        "company": company,
                        "is_group": 0
                    }
                };
            },
            "width": "200px"
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
        },
        {
            "fieldname": "tax_account",
            "label": __("حساب الضريبة"),
            "fieldtype": "Link",
            "options": "Account",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                if (!company) return;
                
                // Filtro mejorado que solo muestra cuentas relacionadas con impuestos
                return {
                    "filters": [
                        ["Account", "company", "=", company],
                        ["Account", "is_group", "=", 0]
                    ],
                    "or_filters": [
                        // Identificadores principales de cuentas de impuestos
                        ["Account", "account_type", "=", "Tax"],
                        // Cuentas bajo grupos de impuestos
                        ["Account", "parent_account", "like", "%Duties and Taxes%"],
                        ["Account", "parent_account", "like", "%ضرائب%"],
                        ["Account", "parent_account", "like", "%ضريبة%"],
                        // Términos específicos de IVA
                        ["Account", "account_name", "like", "%ضريب%"],
                        ["Account", "account_name", "like", "%VAT%"],
                        ["Account", "account_name", "like", "%ضريبة القيمة المضافة%"],
                        // Solo códigos de cuenta específicos de impuestos
                        ["Account", "name", "like", "%ضريب%"],
                        ["Account", "name", "like", "%VAT%"]
                    ]
                };
            },
            "width": "200px",
			"hidden": 1 ,
            "description": __("اختياري: يستخدم لتصفية ضريبة المصروفات حسب حساب محدد")
        },
        {
            "fieldname": "report_type",
            "label": __("نوع التقرير"),
            "fieldtype": "Select",
            "options": "شهري\nربع سنوي\nسنوي",
            "default": "شهري",
			"hidden": 1 ,
            "width": "100px"
        },
        {
            "fieldname": "include_cancelled",
            "label": __("تضمين الفواتير الملغاة"),
            "fieldtype": "Check",
			"hidden": 1 ,
            "default": 0
        },
        {
            "fieldname": "show_non_taxable",
            "label": __("إظهار العناصر غير الخاضعة للضريبة"),
            "fieldtype": "Check",
			"hidden": 1 ,
            "default": 1
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        // Apply thousand separators to currency columns
        if (column.fieldtype === "Currency" && value !== null && value !== undefined && value !== "") {
            // Format numeric values with thousand separators
            var formatted_value = format_currency(value, column.options);
            
            // تخصيص التنسيق للصفوف الهامة مع الحفاظ على التنسيق المالي
            if (data) {
                // التعرف على عناوين الأقسام
                if (data.description && data.description.startsWith("---")) {
                    return '<span style="font-weight: bold; font-size: 1.2em; color: #34495e; background-color: #f8f9fa; padding: 5px 10px; display: block; border-radius: 3px;">' + 
                            data.description.replace(/---/g, '') + 
                           '</span>';
                }
                
                // تنسيق خاص للمجاميع والعناوين الرئيسية
                if (data.description && (
                    data.description.includes("اجمالي") || 
                    data.description.includes("صافي") || 
                    data.description.includes("الفرق الضريبي")
                )) {
                    return '<span style="font-weight: bold; font-size: 1.1em; color: #2c3e50;">' + formatted_value + '</span>';
                }
                
                // إبراز المبيعات الخاضعة والغير خاضعة
                if (data.description && data.description.includes("المبيعات الخاضعة")) {
                    return '<span style="color: #27ae60; font-weight: bold;">' + formatted_value + '</span>';
                }

                if (data.description && data.description.includes("المبيعات غير الخاضعة")) {
                    return '<span style="color: #3498db; font-weight: bold;">' + formatted_value + '</span>';
                }
                
                // إبراز المشتريات الخاضعة والغير خاضعة
                if (data.description && data.description.includes("المشتريات الخاضعة")) {
                    return '<span style="color: #2980b9; font-weight: bold;">' + formatted_value + '</span>';
                }

                if (data.description && data.description.includes("المشتريات غير الخاضعة")) {
                    return '<span style="color: #3498db; font-weight: bold;">' + formatted_value + '</span>';
                }
                
                // إبراز صفوف المرتجعات
                if (data.description && data.description.includes("مرتجعات")) {
                    return '<span style="color: #e74c3c; font-weight: bold;">' + formatted_value + '</span>';
                }
                
                // إبراز صفوف إجمالي المرتجعات
                if (data.description && (data.description === __("Total Sales Returns") || data.description === __("Total Purchase Returns"))) {
                    return '<span style="color: #e74c3c; font-weight: bold; font-size: 1.05em;">' + formatted_value + '</span>';
                }
                
                // تنسيق خاص لضريبة المصروفات
                if (data.description && data.description.includes("المصروفات")) {
                    return '<span style="color: #8e44ad; font-weight: bold;">' + formatted_value + '</span>';
                }
                
                // تنسيق قيم الضرائب
                if (column.fieldname === "tax_amount") {
                    if (data.description === __("Total VAT Due for Current Tax Period")) {
                        var tax_value = parseFloat(value || 0);
                        return tax_value < 0 ? 
                            '<span style="color: #e74c3c; font-weight: bold; font-size: 1.2em;">' + formatted_value + '</span>' : 
                            '<span style="color: #27ae60; font-weight: bold; font-size: 1.2em;">' + formatted_value + '</span>';
                    } else if (data.description === __("Expenses (Journal Entries)")) {
                        return '<span style="color: #8e44ad; font-weight: bold;">' + formatted_value + '</span>';
                    } else if (data.description === __("Expenses (Payment Entries)")) {
                        return '<span style="color: #8e44ad; font-weight: bold;">' + formatted_value + '</span>';
                    } else {
                        return '<span style="color: #2980b9;">' + formatted_value + '</span>';
                    }
                }
                
                // تلوين صف الضريبة المستحقة بالكامل
                if (data.description === __("Total VAT Due for Current Tax Period")) {
                    return '<span style="font-weight: bold; font-size: 1.1em; color: #34495e;">' + formatted_value + '</span>';
                }
            }
            
            return formatted_value;
        }
        
        return default_formatter(value, row, column, data);
    },
    "initial_setup": true,
    "show_filters_on_top": true,
    "onload": function(report) {
        // إضافة الكلاس المخصص للصفحة لتنسيق الكارتات
        report.page.wrapper.addClass("tax-declaration-report-page");
        
        // تطبيق ستايل للجدول مباشرة عند التحميل
        report.page.wrapper.find(".datatable").addClass("tax-declaration-table");
        
        // التأكد من ظهور الفلاتر
        report.page.show_form();
        
        // تعديل سلوك فلتر مركز التكلفة لتحديثه عند تغيير الشركة
        report.page.wrapper.find('[data-fieldname="company"]').on("change", function() {
            var company = $(this).val();
            var cost_center_filter = report.page.wrapper.find('[data-fieldname="cost_center"]');
            
            if (cost_center_filter.length) {
                var cost_center_field = cost_center_filter.find("input");
                // تفريغ حقل مركز التكلفة عند تغيير الشركة
                cost_center_field.val("").trigger("change");
            }
            
            // إعادة تحميل حساب الضريبة عند تغيير الشركة
            var tax_account_filter = report.page.wrapper.find('[data-fieldname="tax_account"]');
            if (tax_account_filter.length) {
                var tax_account_field = tax_account_filter.find("input");
                tax_account_field.val("").trigger("change");
            }
        });
        
        // إضافة زر لعرض نموذج الإقرار الضريبي
        report.page.add_inner_button(__("نموذج الإقرار الضريبي"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                // إنشاء نموذج الإقرار الضريبي
                var html = createTaxDeclarationForm(data, filters);
                
                // فتح نافذة جديدة وعرض النموذج
                var w = window.open();
                w.document.write(html);
                w.document.close();
                setTimeout(function() {
                    w.print();
                }, 1000);
            } else {
                frappe.msgprint(__("لا توجد بيانات لعرضها. يرجى التحقق من المرشحات."));
            }
        });
        
        // إضافة زر للتصدير
        report.page.add_inner_button(__("تصدير"), function() {
            if (report.data && report.data.length > 0) {
                var data = report.data;
                var filters = report.get_values();
                
                downloadCSV(data, "tax_declaration_" + filters.from_date + "_to_" + filters.to_date + ".csv");
            } else {
                frappe.msgprint(__("لا توجد بيانات للتصدير"));
            }
        });
    },
    "after_datatable_render": function(datatable) {
        var report = frappe.query_report;
        if (report.data && report.data.length > 0) {
            // Hide standard summary
            report.page.wrapper.find(".report-summary").hide();
            
            // إزالة الأقسام السابقة إذا وجدت
            report.page.main.find(".tax-summary-section").remove();
            
            // إنشاء قسم ملخص الضرائب في الأعلى
            var $taxSummarySection = $('<div class="tax-summary-section"></div>');
            report.page.main.find(".report-filter-section").after($taxSummarySection);
            
            // تحديث الملخص
            updateTaxSummary(report.data);
            
            // تطبيق ستايل لتمييز أقسام التقرير
            report.page.wrapper.find(".datatable .dt-row").each(function(index) {
                var $row = $(this);
                var rowData = report.data[index];
                
                if (rowData && rowData.description && rowData.description.startsWith("---")) {
                    $row.addClass("section-header");
                    $row.css({
                        "background-color": "#f8f9fa",
                        "border-bottom": "2px solid #ddd",
                        "font-weight": "bold"
                    });
                }
                
                // إضافة تلوين للصفوف حسب نوعها
                if (rowData && rowData.description) {
                    if (rowData.description.includes("اجمالي") || rowData.description.includes("صافي") || 
                        rowData.description.includes("Total") || rowData.description.includes("Net")) {
                        $row.css({
                            "background-color": "#f8fafc",
                            "font-weight": "bold"
                        });
                    }
                    
                    if (rowData.description.includes("مرتجعات") || rowData.description.includes("Returns")) {
                        $row.css({
                            "background-color": "#fff5f5"
                        });
                    }
                    
                    if (rowData.description.includes("المصروفات") || rowData.description.includes("Expenses")) {
                        $row.css({
                            "background-color": "#f9f4fc"
                        });
                    }
                    
                    if (rowData.description === __("Total VAT Due for Current Tax Period") || 
                        rowData.description === "Total VAT Due for Current Tax Period") {
                        $row.css({
                            "background-color": "#f1f5f9",
                            "font-weight": "bold",
                            "border-top": "2px solid #cbd5e1",
                            "border-bottom": "2px solid #cbd5e1"
                        });
                    }
                    
                    if (rowData.description.includes("غير الخاضعة") || rowData.description.includes("Non-Taxable")) {
                        $row.css({
                            "background-color": "#f0f8ff"
                        });
                    }
                }
            });
        }
    }
};

// دالة لإنشاء نموذج الإقرار الضريبي
function createTaxDeclarationForm(data, filters) {
    // تنسيق التاريخ
    var formatDate = function(dateStr) {
        if (!dateStr) return "";
        var d = new Date(dateStr);
        return d.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    var currentDate = frappe.datetime.get_today();
    var currentTime = frappe.datetime.now_time();
    
    // البحث عن الصفوف المطلوبة في البيانات الجديدة بشكل مرن وآمن
    var findRow = function(eng_desc) {
        if (!data) return {};
        var translated = __(eng_desc);
        return data.find(row => row.description === eng_desc || row.description === translated) || {};
    };
    
    // المبيعات
    var taxableSalesRow = findRow("Standard Rate Taxable Sales");
    var nonTaxableSalesRow = findRow("Non-Taxable or Zero-Rated Sales");
    var totalSalesRow = findRow("Total Sales");
    var salesReturnsRow = findRow("Standard Rate Taxable Sales Returns");
    var salesNetRow = findRow("Net Sales (After Returns)");
    
    // المشتريات
    var taxablePurchaseRow = findRow("Standard Rate Taxable Purchases");
    var nonTaxablePurchaseRow = findRow("Non-Taxable or Zero-Rated Purchases");
    var totalPurchaseRow = findRow("Total Purchases");
    var purchaseReturnsRow = findRow("Standard Rate Taxable Purchase Returns");
    var purchaseNetRow = findRow("Net Purchases (After Returns)");
    
    // المصروفات
    var expensesJERow = findRow("Expenses (Journal Entries)");
    var expensesPERow = findRow("Expenses (Payment Entries)");
    var totalRecoverableRow = findRow("Total Recoverable Tax (Purchases and Expenses)");
    
    // الضريبة المستحقة
    var vatDueRow = findRow("Total VAT Due for Current Tax Period");
    
    // إنشاء جداول ملخصة
    var salesPanel = `
    <div style="width: 49%; float: right; margin-left: 1%; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
        <div style="background-color: #27ae60; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المبيعات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المبيعات الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(taxableSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المبيعات الخاضعة:</div>
                <div style="direction: ltr; color: #27ae60;">${format_currency(taxableSalesRow.tax_amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المبيعات غير الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(nonTaxableSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي المبيعات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(totalSalesRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">مرتجعات المبيعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(salesReturnsRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المرتجعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(salesReturnsRow.tax_amount)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي المبيعات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(salesNetRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي ضريبة المبيعات:</div>
                <div style="direction: ltr; color: #27ae60; font-weight: bold;">${format_currency(salesNetRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;
    
    var purchasePanel = `
    <div style="width: 49%; float: left; border: 1px solid #ddd; border-radius: 4px; overflow: hidden;">
        <div style="background-color: #2980b9; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المشتريات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المشتريات الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(taxablePurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المشتريات الخاضعة:</div>
                <div style="direction: ltr; color: #2980b9;">${format_currency(taxablePurchaseRow.tax_amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">المشتريات غير الخاضعة للضريبة:</div>
                <div style="direction: ltr;">${format_currency(nonTaxablePurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي المشتريات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(totalPurchaseRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">مرتجعات المشتريات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(purchaseReturnsRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المرتجعات:</div>
                <div style="direction: ltr; color: #e74c3c;">${format_currency(purchaseReturnsRow.tax_amount)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي المشتريات:</div>
                <div style="direction: ltr; font-weight: bold;">${format_currency(purchaseNetRow.amount)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">صافي ضريبة المشتريات:</div>
                <div style="direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(purchaseNetRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;
    
    var expensesPanel = `
    <div style="width: 100%; clear: both; margin-top: 15px; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; background-color: #fdf9ff;">
        <div style="background-color: #8e44ad; color: white; padding: 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #ddd;">
            المصروفات
        </div>
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المصروفات (القيود اليومية):</div>
                <div style="direction: ltr; color: #8e44ad;">${format_currency(expensesJERow ? expensesJERow.tax_amount : 0)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">ضريبة المصروفات (سندات الصرف):</div>
                <div style="direction: ltr; color: #8e44ad;">${format_currency(expensesPERow ? expensesPERow.tax_amount : 0)}</div>
            </div>
            <hr style="border-top: 1px solid #eee; margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <div style="font-weight: bold; text-align: right;">اجمالي الضريبة المستردة:</div>
                <div style="direction: ltr; color: #2980b9; font-weight: bold;">${format_currency(totalRecoverableRow.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;
    
    var vatDueBox = `
    <div style="clear: both; margin-top: 15px; padding: 15px; text-align: center; border: 2px solid ${parseFloat(vatDueRow.tax_amount) < 0 ? '#e74c3c' : '#27ae60'}; border-radius: 4px; background-color: ${parseFloat(vatDueRow.tax_amount) < 0 ? '#fff5f5' : '#f0fff4'};">
        <div style="font-weight: bold; font-size: 18px;">الفرق الضريبي المستحق:</div>
        <div style="font-weight: bold; font-size: 22px; margin-top: 5px; color: ${parseFloat(vatDueRow.tax_amount) < 0 ? '#e74c3c' : '#27ae60'};">${format_currency(vatDueRow.tax_amount)}</div>
    </div>
    `;
    
    // إعداد صفوف جدول التفاصيل - استبعاد الصفوف الفرعية
    var detailRows = data
        .filter(row => row.description && !row.description.startsWith('---')) // استبعاد صفوف العناوين
        .map(function(row) {
            // تطبيق تنسيق خاص على صفوف المجاميع
            var rowStyle = '';
            if (row.description && (row.description.includes("اجمالي") || row.description.includes("صافي"))) {
                rowStyle = 'font-weight: bold; background-color: #f8fafc;';
            }
            if (row.description === __("Total VAT Due for Current Tax Period")) {
                rowStyle = 'font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1;';
            }
            if (row.description && row.description.includes("المصروفات")) {
                rowStyle = 'background-color: #f9f4fc;';
            }
            if (row.description && row.description.includes("مرتجعات")) {
                rowStyle = 'background-color: #fff5f5;';
            }
            if (row.description && row.description.includes("غير الخاضعة")) {
                rowStyle = 'background-color: #f0f8ff;';
            }
            
            return `
                <tr style="${rowStyle}">
                    <td style="font-size: 16px; border: 1px solid #ddd; padding: 8px;">${row.description || ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.amount !== "" ? format_currency(row.amount) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.adjustments !== "" ? format_currency(row.adjustments) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.net_amount !== "" ? format_currency(row.net_amount) : ""}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: left;">${row.tax_amount !== "" ? format_currency(row.tax_amount) : ""}</td>
                </tr>
            `;
        }).join('');
    
    var html = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>نموذج الإقرار الضريبي</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                direction: rtl;
                color: #333;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px; 
                font-size: 15px;
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 10px; 
                text-align: center; 
            }
            th { 
                background-color: #f5f7fa; 
                font-weight: bold;
                font-size: 16px;
                color: #34495e;
            }
            .header { 
                text-align: center; 
                background-color: #f8f8f8; 
                padding: 15px; 
                margin-bottom: 15px; 
                border: 1px solid #ddd;
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .report-title {
                font-size: 20px;
                font-weight: bold;
                margin: 0;
                color: #2c3e50;
            }
            .meta-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 14px;
                color: #7f8c8d;
            }
            .filter-info {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-bottom: 20px;
                font-size: 14px;
                background-color: #f9f9f9;
                border: 1px solid #eee;
                border-radius: 5px;
                padding: 15px;
            }
            .filter-item {
                flex: 1;
                min-width: 200px;
                margin-bottom: 10px;
            }
            .filter-label {
                font-weight: bold;
                margin-bottom: 5px;
                color: #34495e;
            }
            .filter-value {
                padding: 5px;
                background-color: #f5f5f5;
                border: 1px solid #eee;
                border-radius: 3px;
            }
            .clearfix:after {
                content: "";
                display: table;
                clear: both;
            }
            .details-title {
                margin-top: 30px;
                margin-bottom: 15px;
                text-align: center;
                border-bottom: 2px solid #ddd;
                padding-bottom: 10px;
                font-size: 18px;
                color: #2c3e50;
            }
            .signature-section {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
            .signatures {
                display: flex;
                justify-content: space-between;
                margin-bottom: 100px;
            }
            .signature-box {
                text-align: center;
                width: 30%;
            }
            .signature-label {
                font-weight: bold;
                margin-bottom: 5px;
                color: #2c3e50;
            }
            .signature-line {
                border-top: 1px solid #000;
                padding-top: 5px;
            }
            .details-section {
                margin-top: 30px;
                border: 1px solid #eee;
                border-radius: 5px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .details-header {
                background-color: #f5f5f5;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                border-bottom: 1px solid #ddd;
                color: #2c3e50;
            }
            @media print {
                body { 
                    font-size: 12pt; 
                    color: #000;
                }
                .no-print {
                    display: none;
                }
                .header, .filter-info, .details-section, table {
                    page-break-inside: avoid;
                }
            }
        </style>
    </head>
    <body>
        <div class="meta-info">
            <div>
                التاريخ: ${formatDate(currentDate)}
            </div>
            <div>
                الوقت: ${currentTime}
            </div>
        </div>
        
        <div class="header">
            <div class="report-title">نموذج الإقرار الضريبي</div>
        </div>
        
        <div class="filter-info">
            <div class="filter-item">
                <div class="filter-label">الشركة:</div>
                <div class="filter-value">${filters.company || ""}</div>
            </div>
            ${filters.cost_center ? `
            <div class="filter-item">
                <div class="filter-label">مركز التكلفة:</div>
                <div class="filter-value">${filters.cost_center || ""}</div>
            </div>
            ` : ''}
            <div class="filter-item">
                <div class="filter-label">الفترة:</div>
                <div class="filter-value">من ${formatDate(filters.from_date)} إلى ${formatDate(filters.to_date)}</div>
            </div>
            ${filters.tax_account ? `
            <div class="filter-item">
                <div class="filter-label">حساب الضريبة:</div>
                <div class="filter-value">${filters.tax_account || ""}</div>
            </div>
            ` : ''}
        </div>
        
        <!-- الأقسام الثلاثة بالتنسيق الجديد -->
        <div class="clearfix">
            ${salesPanel}
            ${purchasePanel}
            ${expensesPanel}
            ${vatDueBox}
        </div>
        
        <div class="details-section">
            <div class="details-header">تفاصيل الإقرار الضريبي</div>
            
            <table class="details-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">البيان</th>
                        <th>المبلغ</th>
                        <th>التعديلات</th>
                        <th>الصافي</th>
                        <th>قيمة ضريبة القيمة المضافة</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailRows}
                </tbody>
            </table>
        </div>
        
        <div class="signature-section">
            <div class="signatures">
                <div class="signature-box">
                    <div class="signature-label">إعداد</div>
                    <div class="signature-line">التوقيع</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">المراجعة</div>
                    <div class="signature-line">التوقيع</div>
                </div>
                <div class="signature-box">
                    <div class="signature-label">الاعتماد</div>
                    <div class="signature-line">التوقيع</div>
                </div>
            </div>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
            <button onClick="window.print()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">طباعة النموذج</button>
        </div>
    </body>
    </html>
    `;
    
    return html;
}

// دالة التصدير إلى CSV
function downloadCSV(data, filename) {
    var csvContent = "data:text/csv;charset=utf-8,\ufeff"; // إضافة BOM للدعم العربي
    
    // إعداد العناوين
    var headers = [__("Particulars"), __("Amount"), __("Adjustments"), __("Net"), __("VAT Amount")];
    csvContent += headers.join(",") + "\r\n";
    
    // إضافة البيانات
    data.forEach(function(row) {
        // تخطي صفوف العناوين
        if (row.description && !row.description.startsWith('---')) {
            var rowData = [
                '"' + (row.description || "") + '"', // إضافة علامات اقتباس لمنع مشاكل الفواصل في النص العربي
                row.amount ? format_currency(row.amount, frappe.defaults.get_default("currency")) : "",
                row.adjustments ? format_currency(row.adjustments, frappe.defaults.get_default("currency")) : "",
                row.net_amount ? format_currency(row.net_amount, frappe.defaults.get_default("currency")) : "",
                row.tax_amount ? format_currency(row.tax_amount, frappe.defaults.get_default("currency")) : ""
            ];
            
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

function updateTaxSummary(data) {
    // Inject style if not present
    if (!$('#tax-report-style').length) {
        $('head').append(`
            <style id="tax-report-style">
                .tax-dashboard-container {
                    margin: 20px 15px;
                    direction: rtl;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                .tax-panels-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .tax-panel-card {
                    background: #ffffff;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .tax-panel-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
                }
                .tax-panel-header {
                    color: white;
                    padding: 10px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 15px;
                    border-bottom: 1px solid #ddd;
                }
                .tax-panel-body {
                    padding: 15px;
                }
                .tax-row-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 8px;
                    font-size: 13px;
                }
                .tax-row-item:last-child {
                    margin-bottom: 0;
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .tax-row-label {
                    font-weight: bold;
                    text-align: right;
                    color: #2c3e50;
                }
                .tax-row-value {
                    direction: ltr;
                    font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
                    font-weight: 700;
                    font-size: 14px;
                }
                .tax-due-card-summary {
                    margin-top: 20px;
                    padding: 15px;
                    text-align: center;
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .tax-due-title-summary {
                    font-weight: bold;
                    font-size: 16px;
                    margin-bottom: 5px;
                }
                .tax-due-val-summary {
                    font-weight: bold;
                    font-size: 22px;
                    font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
                }
            </style>
        `);
    }

    // دالة مرنة للبحث عن الصفوف تدعم اللغتين العربية والإنجليزية
    var findRow = function(eng_desc) {
        if (!data) return null;
        var translated = __(eng_desc);
        return data.find(row => row.description === eng_desc || row.description === translated);
    };
    
    // الحصول على بيانات الصفوف المهمة
    var taxableSales = findRow("Standard Rate Taxable Sales");
    var nonTaxableSales = findRow("Non-Taxable or Zero-Rated Sales");
    var totalSales = findRow("Total Sales");
    var salesReturns = findRow("Standard Rate Taxable Sales Returns");
    var salesNet = findRow("Net Sales (After Returns)");
    
    var taxablePurchases = findRow("Standard Rate Taxable Purchases");
    var nonTaxablePurchases = findRow("Non-Taxable or Zero-Rated Purchases");
    var totalPurchases = findRow("Total Purchases");
    var purchaseReturns = findRow("Standard Rate Taxable Purchase Returns");
    var purchaseNet = findRow("Net Purchases (After Returns)");
    
    var journalEntries = findRow("Expenses (Journal Entries)");
    var paymentEntries = findRow("Expenses (Payment Entries)");
    var totalRecoverable = findRow("Total Recoverable Tax (Purchases and Expenses)");
    
    var vatDue = findRow("Total VAT Due for Current Tax Period");
    
    var currency = frappe.defaults.get_default("currency") || "SAR";
    
    // دالة مساعدة لتنسيق المبالغ المالية بأمان
    var formatVal = function(val) {
        if (val === undefined || val === null || val === "" || isNaN(val)) return format_currency(0, currency);
        return format_currency(val, currency);
    };
    
    // إعداد القسم المخصص في الواجهة
    var $taxSummarySection = $(".tax-summary-section");
    $taxSummarySection.empty();
    
    // احتساب وتجهيز بطاقة الفرق الضريبي المستحق
    var rawVatDue = vatDue ? parseFloat(vatDue.tax_amount) : 0;
    var isPayable = rawVatDue >= 0;
    var absoluteVatDue = Math.abs(rawVatDue);
    
    // Sales Panel
    var salesHtml = `
    <div class="tax-panel-card sales-card">
        <div class="tax-panel-header" style="background-color: #27ae60;">
            المبيعات
        </div>
        <div class="tax-panel-body">
            <div class="tax-row-item">
                <div class="tax-row-label">المبيعات الخاضعة للضريبة:</div>
                <div class="tax-row-value">${formatVal(taxableSales?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة المبيعات الخاضعة:</div>
                <div class="tax-row-value" style="color: #27ae60;">${formatVal(taxableSales?.tax_amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">المبيعات غير الخاضعة للضريبة:</div>
                <div class="tax-row-value">${formatVal(nonTaxableSales?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">اجمالي المبيعات:</div>
                <div class="tax-row-value" style="font-weight: bold;">${formatVal(totalSales?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">مرتجع المبيعات الخاضعة:</div>
                <div class="tax-row-value" style="color: #e74c3c;">${formatVal(salesReturns?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة مرتجع المبيعات:</div>
                <div class="tax-row-value" style="color: #e74c3c;">${formatVal(salesReturns?.tax_amount)}</div>
            </div>
            <div class="tax-row-item" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
                <div class="tax-row-label" style="font-size: 14px;">صافي المبيعات:</div>
                <div class="tax-row-value" style="font-size: 15px; font-weight: bold;">${formatVal(salesNet?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label" style="font-size: 14px;">صافي ضريبة المبيعات:</div>
                <div class="tax-row-value" style="font-size: 15px; font-weight: bold; color: #27ae60;">${formatVal(salesNet?.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

    // Purchases Panel
    var purchaseHtml = `
    <div class="tax-panel-card purchases-card">
        <div class="tax-panel-header" style="background-color: #2980b9;">
            المشتريات
        </div>
        <div class="tax-panel-body">
            <div class="tax-row-item">
                <div class="tax-row-label">المشتريات الخاضعة للضريبة:</div>
                <div class="tax-row-value">${formatVal(taxablePurchases?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة المشتريات الخاضعة:</div>
                <div class="tax-row-value" style="color: #2980b9;">${formatVal(taxablePurchases?.tax_amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">المشتريات غير الخاضعة للضريبة:</div>
                <div class="tax-row-value">${formatVal(nonTaxablePurchases?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">اجمالي المشتريات:</div>
                <div class="tax-row-value" style="font-weight: bold;">${formatVal(totalPurchases?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">مرتجع المشتريات:</div>
                <div class="tax-row-value" style="color: #e74c3c;">${formatVal(purchaseReturns?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة المرتجعات:</div>
                <div class="tax-row-value" style="color: #e74c3c;">${formatVal(purchaseReturns?.tax_amount)}</div>
            </div>
            <div class="tax-row-item" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
                <div class="tax-row-label" style="font-size: 14px;">صافي المشتريات:</div>
                <div class="tax-row-value" style="font-size: 15px; font-weight: bold;">${formatVal(purchaseNet?.amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label" style="font-size: 14px;">صافي ضريبة المشتريات:</div>
                <div class="tax-row-value" style="font-size: 15px; font-weight: bold; color: #2980b9;">${formatVal(purchaseNet?.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

    // Expenses Panel
    var expensesHtml = `
    <div class="tax-panel-card expenses-card" style="grid-column: span 2; background-color: #faf5ff;">
        <div class="tax-panel-header" style="background-color: #8e44ad;">
            المصروفات
        </div>
        <div class="tax-panel-body">
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة المصروفات (القيود اليومية):</div>
                <div class="tax-row-value" style="color: #8e44ad;">${formatVal(journalEntries?.tax_amount)}</div>
            </div>
            <div class="tax-row-item">
                <div class="tax-row-label">ضريبة المصروفات (سندات الصرف):</div>
                <div class="tax-row-value" style="color: #8e44ad;">${formatVal(paymentEntries?.tax_amount)}</div>
            </div>
            <div class="tax-row-item" style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
                <div class="tax-row-label" style="font-size: 14px;">اجمالي الضريبة المستردة:</div>
                <div class="tax-row-value" style="font-size: 15px; font-weight: bold; color: #2980b9;">${formatVal(totalRecoverable?.tax_amount)}</div>
            </div>
        </div>
    </div>
    `;

    // Tax Due Card Summary
    var vatDueHtmlSummary = `
    <div class="tax-due-card-summary" style="border: 2px solid ${isPayable ? '#e74c3c' : '#27ae60'}; background-color: ${isPayable ? '#fff5f5' : '#f0fff4'};">
        <div class="tax-due-title-summary" style="color: ${isPayable ? '#991b1b' : '#065f46'};">${isPayable ? 'الفرق الضريبي المستحق للدفع' : 'الفرق الضريبي المستحق للاسترداد (رصيد دائن)'}:</div>
        <div class="tax-due-val-summary" style="color: ${isPayable ? '#b91c1c' : '#047857'};">${formatVal(absoluteVatDue)}</div>
    </div>
    `;
    
    var panelDashboardHtml = `
    <div class="tax-dashboard-container">
        <div class="tax-panels-grid">
            ${salesHtml}
            ${purchaseHtml}
            ${expensesHtml}
        </div>
        ${vatDueHtmlSummary}
    </div>
    `;
    
    // إضافة لوحة التحكم المحسنة إلى الصفحة
    $taxSummarySection.html(panelDashboardHtml);
}