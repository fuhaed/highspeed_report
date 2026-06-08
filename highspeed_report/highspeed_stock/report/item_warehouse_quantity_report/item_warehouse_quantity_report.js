// Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.query_reports["Item Warehouse Quantity Report"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company"),
            "reqd": 1
        },
        {
            "fieldname": "warehouse",
            "label": __("المستودع"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    filters: {
                        "company": company
                    }
                };
            }
        },
        {
            "fieldname": "item_code",
            "label": __("Item Code"),
            "fieldtype": "Link",
            "options": "Item",
            "get_query": function() {
                return {
                    filters: {
                        "disabled": 0
                    }
                };
            }
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group"
        },
        {
            "fieldname": "include_zero_qty",
            "label": __("إظهار الأصناف بكميات صفرية"),
            "fieldtype": "Check",
            "default": 0
        },
        {
            "fieldname": "show_variant_attributes",
            "label": __("إظهار خصائص المتغيرات"),
            "fieldtype": "Check",
            "default": 0
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // تنسيق الكميات والأرقام
            if (column.fieldtype === "Float" && value !== undefined) {
                const formatted_value = default_formatter(value, row, column, data);
                
                if (value === 0) {
                    return `<span style="color: #999; text-align: center;">${formatted_value}</span>`;
                } else if (value > 0) {
                    return `<span style="color: #28a745; font-weight: bold; text-align: center;">${formatted_value}</span>`;
                } else {
                    return `<span style="color: #dc3545; font-weight: bold; text-align: center;">${formatted_value}</span>`;
                }
            }
            
            // تنسيق صف المجموع
            if (data.is_total_row) {
                return '<span style="font-weight: bold; color: #204060; background-color: #f8f9fa; display: block; padding: 2px 5px; text-align: center;">' + default_formatter(value, row, column, data) + '</span>';
            }

            // عرض كود الصنف فقط بدون اسم الصنف
            if (column.fieldname === "item_code" && value) {
                // استخراج الكود فقط (افتراض أن الكود هو رقم)
                const itemCode = value.split(':')[0];
                var icon = `<i class="fa fa-link" style="margin-left: 5px;"></i>`;
                return `<a href="/app/item/${data.item_code}" target="_blank">${itemCode} ${icon}</a>`;
            }
        }
        
        return default_formatter(value, row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير كميات المستودعات");
        
        // إضافة CSS مخصص
        $('<style>\
            /* تنسيق الجدول */\
            .datatable .dt-row:last-child .dt-cell {\
                background-color: #f8f9fa !important;\
                font-weight: bold;\
                border-top: 2px solid #ddd;\
                border-bottom: 2px solid #ddd;\
            }\
            \
            /* تلوين الخلايا حسب القيمة */\
            .qty-zero { color: #999; }\
            .qty-positive { color: #28a745; font-weight: bold; }\
            .qty-negative { color: #dc3545; font-weight: bold; }\
        </style>').appendTo('head');
        
        // إضافة زر الطباعة
        report.page.add_inner_button(__("Print Report"), function() {
            printReport(report);
        });

        // إضافة زر لتصدير البيانات
        report.page.add_inner_button(__("Export to Excel"), function() {
            frappe.query_report.export_report();
        });
    }
};

// دالة لطباعة التقرير
function printReport(report) {
    // الحصول على بيانات التقرير
    var data = report.data;
    var columns = report.columns;
    
    if (!data || data.length === 0) {
        frappe.msgprint(__("لا توجد بيانات للطباعة"));
        return;
    }
    
    // تحضير معلومات التقرير
    var company = frappe.query_report.get_filter_value('company');
    var itemCode = frappe.query_report.get_filter_value('item_code') || __("جميع الأصناف");
    var itemGroup = frappe.query_report.get_filter_value('item_group') || __("جميع المجموعات");
    
    // فتح نافذة جديدة للطباعة
    var w = window.open();
    
    // تعيين العنوان للصفحة
    w.document.title = __("تقرير كميات المستودعات");
    
    // إعداد نمط CSS للطباعة
    var printCss = `
        <style>
            @page {
                size: A4 landscape;
                margin: 10mm;
                direction: rtl;
            }
            body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                direction: rtl;
                margin: 0;
                padding: 0;
            }
            .report-header {
                text-align: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #ddd;
            }
            .report-title {
                font-size: 16px;
                font-weight: bold;
                margin: 0;
                padding: 0;
            }
            .report-date {
                margin-top: 5px;
            }
            table.report-table {
                width: 100%;
                border-collapse: collapse;
                border: 1px solid #ddd;
                margin-bottom: 15px;
            }
            table.report-table th, table.report-table td {
                border: 1px solid #ddd;
                padding: 5px;
                text-align: center;
            }
            table.report-table th {
                background-color: #f5f5f5;
                font-weight: bold;
                font-size: 12px;
            }
            table.report-table tbody tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .row-number-cell {
                width: 30px;
                text-align: center;
                font-weight: bold;
            }
            .text-right {
                text-align: right;
            }
            .text-center {
                text-align: center;
            }
            .total-row td {
                font-weight: bold;
                border-top: 2px solid #ddd;
                background-color: #f5f5f5;
            }
            .report-footer {
                font-size: 10px;
                text-align: center;
                margin-top: 15px;
                border-top: 1px solid #ddd;
                padding-top: 5px;
            }
            .qty-positive { color: #28a745; font-weight: bold; }
            .qty-zero { color: #999; }
            .qty-negative { color: #dc3545; font-weight: bold; }
        </style>
    `;
    
    // تحديد الأعمدة التي تحتوي على كميات المستودعات
    var warehouseColumns = columns.filter(col => 
        col.fieldtype === 'Float' && 
        col.fieldname !== 'total_qty'
    );
    
    // إنشاء هيكل HTML للتقرير
    var html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${printCss}
            <title>${__("تقرير كميات المستودعات")}</title>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <div class="report-title">${__("تقرير كميات المستودعات")}</div>
                    <div class="report-date">${__("Company")}: ${company}</div>
                    <div class="report-date">${__("الصنف")}: ${itemCode}</div>
                    <div class="report-date">${__("Item Group")}: ${itemGroup}</div>
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th class="row-number-cell">#</th>
                            <th>${__("Item Code")}</th>
                            <th>${__("Item Name")}</th>
                            <th>${__("UOM")}</th>
                            <th>${__("Item Group")}</th>
    `;
    
    // إضافة أعمدة المستودعات
    warehouseColumns.forEach(function(col) {
        html += `<th>${col.label}</th>`;
    });
    
    // إضافة عمود المجموع
    html += `<th>${__("Total")}</th>`;
    
    // إضافة أعمدة خصائص المتغيرات إذا كانت موجودة
    var variantColumn = columns.find(col => col.fieldname === 'variant_attributes');
    if (variantColumn) {
        html += `<th>${variantColumn.label}</th>`;
    }
    
    html += `
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // إضافة صفوف البيانات
    var rowNumber = 1;
    data.forEach(function(row) {
        // تخطي صف المجموع - سنضيفه لاحقاً
        if (row.is_total_row) return;
        
        html += `
            <tr>
                <td class="row-number-cell">${rowNumber}</td>
                <td>${row.item_code || ''}</td>
                <td class="text-right">${row.item_name || ''}</td>
                <td class="text-center">${row.stock_uom || ''}</td>
                <td>${row.item_group || ''}</td>
        `;
        
        // إضافة كميات المستودعات
        warehouseColumns.forEach(function(col) {
            var qty = row[col.fieldname] || 0;
            var qty_class = qty > 0 ? 'qty-positive' : (qty < 0 ? 'qty-negative' : 'qty-zero');
            html += `<td class="text-center ${qty_class}">${format_number(qty, null, 3)}</td>`;
        });
        
        // إضافة كمية المجموع
        html += `<td class="text-center">${format_number(row.total_qty, null, 3)}</td>`;
        
        // إضافة خصائص المتغيرات إذا كانت موجودة
        if (variantColumn) {
            html += `<td class="text-right">${row.variant_attributes || ''}</td>`;
        }
        
        html += `</tr>`;
        
        rowNumber++;
    });
    
    // إضافة صف المجموع
    var totalRow = data.find(row => row.is_total_row);
    if (totalRow) {
        html += `
            <tr class="total-row">
                <td colspan="5" class="text-center">${__("Total")}</td>
        `;
        
        // إضافة مجاميع المستودعات
        warehouseColumns.forEach(function(col) {
            html += `<td class="text-center">${format_number(totalRow[col.fieldname] || 0, null, 3)}</td>`;
        });
        
        // إضافة المجموع الكلي
        html += `<td class="text-center">${format_number(totalRow.total_qty, null, 3)}</td>`;
        
        // إضافة خلية فارغة لعمود خصائص المتغيرات إذا كان موجوداً
        if (variantColumn) {
            html += `<td></td>`;
        }
        
        html += `</tr>`;
    }
    
    // إضافة تذييل التقرير والإغلاق
    var currentDate = frappe.datetime.get_today();
    var currentTime = frappe.datetime.now_time().substr(0, 5);
    var totalRows = rowNumber - 1; // عدد الصفوف باستثناء صف المجموع
    
    html += `
                    </tbody>
                </table>
                <div class="report-footer">
                    ${__("Pages")}: 1 ${__("of")} 1 | ${__("Rows")}: ${totalRows} | ${__("Exported")}: ${currentDate} ${currentTime}
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                };
            </script>
        </body>
        </html>
    `;
    
    // كتابة المحتوى إلى النافذة الجديدة
    w.document.write(html);
    w.document.close();
}