// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Item Movement Report"] = {
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
            "fieldname": "from_date",
            "label": __("من تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            "reqd": 1
        },
        {
            "fieldname": "to_date",
            "label": __("إلى تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1
        },
        {
            "fieldname": "item_code",
            "label": __("Item Code"),
            "fieldtype": "Link",
            "options": "Item",
            "reqd": 1,
            "get_query": function() {
                return {
                    filters: {
                        "disabled": 0
                    }
                };
            }
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
            "fieldname": "voucher_type",
            "label": __("نوع المستند"),
            "fieldtype": "Select",
            "options": "\n" + 
                       __("فاتورة شراء") + "\n" +
                       __("Sales Invoice") + "\n" +
                       __("استلام مشتريات") + "\n" +
                       __("إذن تسليم") + "\n" +
                       __("سند مخزون") + "\n" +
                       __("تسوية مخزون")
        },
        {
            "fieldname": "include_zero_qty",
            "label": __("إظهار المستندات بكميات صفرية"),
            "fieldtype": "Check",
            "default": 0
        },
        {
            "fieldname": "show_variant_attributes",
            "label": __("إظهار خصائص المتغيرات"),
            "fieldtype": "Check",
            "default": 0,
            "depends_on": "eval:doc.item_code && doc.item_code.includes('ATTR')"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (data) {
            // تنسيق نوع المستند (إضافة لون)
            if (column.fieldname === "voucher_type" && data.document_color) {
                var indicator_class = data.document_color;
                // تطبيق نمط مختلف للمستندات المرتجعة
                var icon = data.is_return ? '<i class="fa fa-undo" style="margin-left: 5px;"></i>' : '';
                return `<span class="indicator-pill ${indicator_class}"><span>${default_formatter(value, row, column, data)}${icon}</span></span>`;
            }
            
            // تنسيق نوع الحركة
            if (column.fieldname === "movement_type") {
                var movement_color = "";
                var label = default_formatter(value, row, column, data);
                
                if (label.includes("وارد") && !label.includes("مرتجع")) {
                    movement_color = "incoming-bg";
                } else if (label.includes("صادر") && !label.includes("مرتجع")) {
                    movement_color = "outgoing-bg";
                } else if (label.includes("مرتجع وارد")) {
                    movement_color = "return-in-bg";
                } else if (label.includes("مرتجع صادر")) {
                    movement_color = "return-out-bg";
                } else if (label.includes("رصيد افتتاحي")) {
                    movement_color = "opening-bg";
                } else {
                    movement_color = "neutral-bg";
                }
                
                return `<span class="movement-label ${movement_color}">${label}</span>`;
            }
            
            // تنسيق رقم المستند (إضافة رابط)
            if (column.fieldname === "voucher_no" && data.voucher_no && data.voucher_type_original) {
                var icon = `<i class="fa fa-link" style="margin-left: 5px;"></i>`;
                return `<a href="/app/${data.voucher_type_original.toLowerCase().replace(/\s+/g, '-')}/${data.voucher_no}" target="_blank">${default_formatter(value, row, column, data)} ${icon}</a>`;
            }
            
            // تنسيق الكميات الواردة
            if (column.fieldname === "incoming_qty" && value > 0) {
                return `<span style="color: #28a745; font-weight: bold; text-align: center;">${default_formatter(value, row, column, data)}</span>`;
            }
            
            // تنسيق الكميات الصادرة
            if (column.fieldname === "outgoing_qty" && value > 0) {
                return `<span style="color: #dc3545; font-weight: bold; text-align: center;">${default_formatter(value, row, column, data)}</span>`;
            }
            
            // تنسيق الرصيد
            if (column.fieldname === "balance_qty") {
                var color = value >= 0 ? "#17a2b8" : "#dc3545";
                return `<span style="color: ${color}; font-weight: bold; text-align: center;">${default_formatter(value, row, column, data)}</span>`;
            }
            
            // تنسيق صف المجموع
            if (data.is_total_row) {
                return '<span style="font-weight: bold; color: #204060; background-color: #f8f9fa; display: block; padding: 2px 5px; text-align: center;">' + default_formatter(value, row, column, data) + '</span>';
            }
        }
        
        return default_formatter(value, row, column, data);
    },

    "onload": function(report) {
        console.log("تم تحميل تقرير حركة الصنف");
        
        // إضافة CSS مخصص - فقط للألوان الأساسية والتنسيقات المهمة
        $('<style>\
            /* تنسيق الجدول */\
            .datatable .dt-row:last-child .dt-cell {\
                background-color: #f8f9fa !important;\
                font-weight: bold;\
                border-top: 2px solid #ddd;\
                border-bottom: 2px solid #ddd;\
            }\
            \
            /* ألوان نوع المستند */\
            .indicator-pill { padding: 4px 8px; border-radius: 4px; color: white; }\
            .indicator-pill.blue { background-color: #2563eb;color: white; }\
            .indicator-pill.green { background-color: #16a34a;color: white; }\
            .indicator-pill.red { background-color: #dc2626;color: white; }\
            .indicator-pill.orange { background-color: #ea580c; }\
            .indicator-pill.purple { background-color: #9333ea;color: white; }\
            .indicator-pill.teal { background-color: #0d9488; }\
            .indicator-pill.gray { background-color: #4b5563;color: white; }\
            .indicator-pill.black { background-color: #111827;color: white; }\
            \
            /* ألوان المستندات المرتجعة */\
            .indicator-pill.return-blue { background-color: #93c5fd; color: #1e3a8a; }\
            .indicator-pill.return-green { background-color: #86efac; color: #14532d; }\
            \
            /* ألوان أنواع الحركة */\
            .movement-label { padding: 4px 8px; border-radius: 4px; display: inline-block; text-align: center; }\
            .incoming-bg { background-color: #d1fae5; color: #065f46; }\
            .outgoing-bg { background-color: #fee2e2; color: #991b1b; }\
            .return-in-bg { background-color: #bfdbfe; color: #1e3a8a; }\
            .return-out-bg { background-color: #ddd6fe; color: #5b21b6; }\
            .opening-bg { background-color: #f3f4f6; color: #374151; }\
            .neutral-bg { background-color: #e5e7eb; color: #1f2937; }\
        </style>').appendTo('head');
        
        // إضافة زر الطباعة
        report.page.add_inner_button(__("Print Report"), function() {
            printReport(report);
        });
    }
};

// دالة لطباعة التقرير بطريقة تطابق النموذج المرفق
function printReport(report) {
    // الحصول على بيانات التقرير
    var data = report.data;
    var columns = report.columns;
    
    if (!data || data.length === 0) {
        frappe.msgprint(__("لا توجد بيانات للطباعة"));
        return;
    }
    
    // تحضير معلومات التقرير
    var itemCode = frappe.query_report.get_filter_value('item_code');
    var fromDate = frappe.datetime.str_to_user(frappe.query_report.get_filter_value('from_date'));
    var toDate = frappe.datetime.str_to_user(frappe.query_report.get_filter_value('to_date'));
    
    // فتح نافذة جديدة للطباعة
    var w = window.open();
    
    // تعيين العنوان للصفحة
    w.document.title = __("تقرير حركة الصنف") + " - " + itemCode;
    
    // إعداد نمط CSS للطباعة
    var printCss = `
        <style>
            @page {
                size: A4;
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
            .movement-type {
                font-weight: bold;
            }
            .movement-incoming {
                color: #16a34a;
            }
            .movement-outgoing {
                color: #dc2626;
            }
            .movement-return-in {
                color: #2563eb;
            }
            .movement-return-out {
                color: #9333ea;
            }
            .movement-opening {
                color: #4b5563;
            }
        </style>
    `;
    
    // إنشاء هيكل HTML للتقرير
    var html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${printCss}
            <title>${__("تقرير حركة الصنف")}</title>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <div class="report-title">${__("تقرير حركة الصنف")} ${itemCode}</div>
                    <div class="report-date">${__("of")} ${fromDate} ${__("إلى")} ${toDate}</div>
                </div>
                <div class="report-alert">
                    ${__("تم إنشاء هذا التقرير منذ")} 1 ${__("دقيقة")}. ${__("للحصول على التقرير المحدث ، انقر على إعادة بناء. عرض جميع التقارير السابقة")}
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th class="row-number-cell">#</th>
                            <th>${__("التاريخ")}</th>
                            <th>${__("نوع المستند")}</th>
                            <th>${__("رقم المستند")}</th>
                            <th>${__("الجهة")}</th>
                            <th>${__("نوع الحركة")}</th>
                            <th>${__("Incoming Qty")}</th>
                            <th>${__("Outgoing Qty")}</th>
                            <th>${__("Balance")}</th>
                            <th>${__("UOM")}</th>
                            <th>${__("سعر الوحدة")}</th>
                            <th>${__("القيمة")}</th>
                            <th>${__("المستودع")}</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    // إضافة صفوف البيانات
    var rowNumber = 1;
    data.forEach(function(row) {
        // تخطي صف المجموع - سنضيفه لاحقاً
        if (row.is_total_row) return;
        
        // تحديد لون نوع الحركة
        var movementClass = "";
        if (row.movement_type) {
            if (row.movement_type.includes("وارد") && !row.movement_type.includes("مرتجع")) {
                movementClass = "movement-incoming";
            } else if (row.movement_type.includes("صادر") && !row.movement_type.includes("مرتجع")) {
                movementClass = "movement-outgoing";
            } else if (row.movement_type.includes("مرتجع وارد")) {
                movementClass = "movement-return-in";
            } else if (row.movement_type.includes("مرتجع صادر")) {
                movementClass = "movement-return-out";
            } else if (row.movement_type.includes("رصيد افتتاحي")) {
                movementClass = "movement-opening";
            }
        }
        
        html += `
            <tr>
                <td class="row-number-cell">${rowNumber}</td>
                <td>${row.date ? frappe.format(row.date, {fieldtype: 'Date'}) : ''}</td>
                <td>${row.voucher_type || ''}</td>
                <td>${row.voucher_no || ''}</td>
                <td class="text-right">${row.party || ''}</td>
                <td class="text-center"><span class="movement-type ${movementClass}">${row.movement_type || ''}</span></td>
                <td class="text-center">${row.incoming_qty ? format_number(row.incoming_qty, null, 3) : ''}</td>
                <td class="text-center">${row.outgoing_qty ? format_number(row.outgoing_qty, null, 3) : ''}</td>
                <td class="text-center">${format_number(row.balance_qty, null, 3)}</td>
                <td class="text-center">${row.stock_uom || ''}</td>
                <td class="text-center">${row.unit_price ? format_number(row.unit_price, null, 2) : ''}</td>
                <td class="text-center">${row.value ? format_number(row.value, null, 2) : ''}</td>
                <td>${row.warehouse || ''}</td>
            </tr>
        `;
        
        rowNumber++;
    });
    
    // إضافة صف المجموع
    var totalRow = data.find(row => row.is_total_row);
    if (totalRow) {
        html += `
            <tr class="total-row">
                <td colspan="6" class="text-center">${__("Total")}</td>
                <td class="text-center">${format_number(totalRow.incoming_qty, null, 3)}</td>
                <td class="text-center">${format_number(totalRow.outgoing_qty, null, 3)}</td>
                <td class="text-center">${format_number(totalRow.balance_qty, null, 3)}</td>
                <td class="text-center">${totalRow.stock_uom || ''}</td>
                <td></td>
                <td class="text-center">${format_number(totalRow.value, null, 2)}</td>
                <td></td>
            </tr>
        `;
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
