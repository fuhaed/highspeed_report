frappe.query_reports["Daily Inventory Movement"] = {
    "filters": [
        {
            "fieldname": "date",
            "label": __("التاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1
        },
        {
            "fieldname": "from_time",
            "label": __("من الساعة"),
            "fieldtype": "Time",
            "default": "00:00:00"
        },
        {
            "fieldname": "to_time",
            "label": __("إلى الساعة"),
            "fieldtype": "Time",
            "default": "23:59:59"
        },
        {
            "fieldname": "warehouse",
            "label": __("المخزن"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "get_query": function() {
                return {
                    filters: {
                        "is_group": 0
                    }
                }
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
                        "is_stock_item": 1
                    }
                }
            }
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group"
        },
        {
            "fieldname": "movement_type",
            "label": __("نوع الحركة"),
            "fieldtype": "Select",
            "options": "\nالكل\nمشتريات فقط\nمبيعات فقط\nحركات أخرى فقط\nأصناف بحركة\nأصناف بدون حركة\nأصناف بفروقات",
            "default": "الكل"
        },
        {
            "fieldname": "show_zero_values",
            "label": __("عرض الأصناف بدون حركة"),
            "fieldtype": "Check",
            "default": 0,
            "hidden": 1
        },
        {
            "fieldname": "debug",
            "label": __("وضع التتبع"),
            "fieldtype": "Check",
            "default": 0,
            "hidden": 1
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        // للصفوف العادية، استخدم القيمة الافتراضية أولاً
        if (!data._bold) {
            // تأكد من أن القيمة ليست undefined أو null
            if (value === undefined || value === null || value === "") {
                if (column.fieldtype === "Float" || column.fieldtype === "Currency") {
                    value = "0.00";
                } else {
                    value = "";
                }
            }
        }
        
        value = default_formatter(value, row, column, data);
        
        // لا تطبق تنسيقات خاصة على صف الإجماليات
        if (data._bold) {
            return value;
        }
        
        // تنسيق كود الصنف
        if (column.fieldname == "item_code" && data.item_code) {
            return `<a href="/app/item/${encodeURIComponent(data.item_code)}" style="font-weight: 500;">${data.item_code}</a>`;
        }
        
        // تنسيق الحقول الرقمية
        if (column.fieldtype === "Float" || column.fieldtype === "Currency") {
            let num = parseFloat(data[column.fieldname]) || 0;
            let formatted_value = column.fieldtype === "Currency" ? format_currency(num) : num.toFixed(2);
            
            switch(column.fieldname) {
                case "purchases_qty":
                case "purchases_value":
                    if (num > 0) {
                        return `<span style="color: #28a745; font-weight: 600;">${formatted_value}</span>`;
                    }
                    break;
                    
                case "sold_qty":
                case "cogs":
                    if (num > 0) {
                        return `<span style="color: #dc3545; font-weight: 600;">${formatted_value}</span>`;
                    }
                    break;
                    
                case "sales_revenue":
                    if (num > 0) {
                        return `<span style="color: #004085; font-weight: 700;">${formatted_value}</span>`;
                    }
                    break;
                    
                case "gross_profit":
                    if (num > 0) {
                        return `<span style="color: #28a745; font-weight: 700;">+${formatted_value}</span>`;
                    } else if (num < 0) {
                        return `<span style="color: #dc3545; font-weight: 700;">${formatted_value}</span>`;
                    }
                    return `<span style="color: #6c757d;">${formatted_value}</span>`;
                    
                case "other_movements":
                    if (Math.abs(num) > 0.01) {
                        let sign = num > 0 ? "+" : "";
                        return `<span style="color: #007bff; font-weight: 600;">${sign}${num.toFixed(2)}</span>`;
                    }
                    return `<span style="color: #6c757d;">0.00</span>`;
                    
                case "opening_balance":
                case "closing_balance":
                case "available_qty":
                    if (num < 0) {
                        return `<span style="color: #dc3545; font-weight: 700;">${num.toFixed(2)}</span>`;
                    }
                    return `<span style="color: #495057; font-weight: 600;">${num.toFixed(2)}</span>`;
                    
                case "difference":
                    if (Math.abs(num) < 0.01) {
                        return `<span style="color: #6c757d;">0.00</span>`;
                    } else if (num > 0) {
                        return `<span style="color: #28a745; font-weight: bold;">+${num.toFixed(2)}</span>`;
                    } else {
                        return `<span style="color: #dc3545; font-weight: bold;">${num.toFixed(2)}</span>`;
                    }
                    
                default:
                    return formatted_value;
            }
        }
        
        return value;
    },
    
    onload: function(report) {
        if (!$('#daily-inventory-report-style').length) {
            $('head').append(`
                <style id="daily-inventory-report-style">
                    .totals-row td {
                        font-weight: 900 !important;
                        font-size: 13px !important;
                        padding: 10px 8px !important;
                        background-color: #e9ecef !important;
                        border-top: 3px solid #343a40 !important;
                    }
                    .totals-row {
                        box-shadow: 0 -2px 5px rgba(0,0,0,0.1), 0 2px 5px rgba(0,0,0,0.1);
                    }
                    .report-footer table {
                        margin-top: -1px !important;
                        border-top: 3px solid #343a40 !important;
                    }
                    
                    .color-legend {
                        display: flex;
                        justify-content: center;
                        gap: 20px;
                        margin: 10px 0;
                        padding: 10px;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-size: 12px;
                    }
                    .color-legend-item {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                </style>
            `);
        }
        
        report.page.add_inner_button(__("طباعة"), function() {
            frappe.query_reports["Daily Inventory Movement"].print_report(report);
        });
        
        report.page.add_inner_button(__("تصدير Excel"), function() {
            report.export();
        });
        
        report.page.add_inner_button(__("تحديث"), function() {
            report.refresh();
        });
        
        report.page.add_inner_button(__("دليل الألوان"), function() {
            frappe.msgprint(`
                <div class="color-legend">
                    <div class="color-legend-item">
                        <span style="color: #28a745; font-weight: 600; font-size: 16px;">●</span>
                        <span>المشتريات</span>
                    </div>
                    <div class="color-legend-item">
                        <span style="color: #dc3545; font-weight: 600; font-size: 16px;">●</span>
                        <span>المبيعات</span>
                    </div>
                    <div class="color-legend-item">
                        <span style="color: #004085; font-weight: 600; font-size: 16px;">●</span>
                        <span>الإيرادات</span>
                    </div>
                    <div class="color-legend-item">
                        <span style="color: #007bff; font-weight: 600; font-size: 16px;">●</span>
                        <span>حركات أخرى</span>
                    </div>
                    <div class="color-legend-item">
                        <span style="color: #495057; font-weight: 600; font-size: 16px;">●</span>
                        <span>الأرصدة</span>
                    </div>
                    <div class="color-legend-item">
                        <span style="color: #fd7e14; font-weight: 600; font-size: 16px;">●</span>
                        <span>الفروقات</span>
                    </div>
                </div>
            `, __("دليل الألوان"));
        });
        
        report.after_datatable_render = function(datatable) {
            if (report.data && report.data.length > 0) {
                frappe.query_reports["Daily Inventory Movement"].add_totals_row(report);
            }
        };
    },
    
    add_totals_row: function(report) {
        let data = report.data || [];
        
        let dataForCalc = data;
        if (data.length > 0 && data[data.length - 1]._bold) {
            dataForCalc = data.slice(0, -1);
        }
        
        let totals = {
            item_code: "<b style='font-size: 14px;'>الإجمالي</b>",
            item_name: "",
            warehouse: "",
            opening_balance: 0,
            purchases_qty: 0,
            purchases_value: 0,
            sold_qty: 0,
            cogs: 0,
            sales_revenue: 0,
            gross_profit: 0,
            other_movements: 0,
            closing_balance: 0,
            available_qty: 0,
            difference: 0
        };
        
        dataForCalc.forEach(function(row) {
            totals.opening_balance += flt(row.opening_balance || 0);
            totals.purchases_qty += flt(row.purchases_qty || 0);
            totals.purchases_value += flt(row.purchases_value || 0);
            totals.sold_qty += flt(row.sold_qty || 0);
            totals.cogs += flt(row.cogs || 0);
            totals.sales_revenue += flt(row.sales_revenue || 0);
            totals.gross_profit += flt(row.gross_profit || 0);
            totals.other_movements += flt(row.other_movements || 0);
            totals.closing_balance += flt(row.closing_balance || 0);
            totals.available_qty += flt(row.available_qty || 0);
            totals.difference += flt(row.difference || 0);
        });
        
        $('.totals-row').remove();
        $('.report-footer').remove();
        
        let opening_balance_html = totals.opening_balance < 0 ? 
            `<span style="color: #dc3545; font-weight: 900;">${totals.opening_balance.toFixed(2)}</span>` : 
            `<span style="color: #495057; font-weight: 900;">${totals.opening_balance.toFixed(2)}</span>`;
            
        let closing_balance_html = totals.closing_balance < 0 ? 
            `<span style="color: #dc3545; font-weight: 900;">${totals.closing_balance.toFixed(2)}</span>` : 
            `<span style="color: #495057; font-weight: 900;">${totals.closing_balance.toFixed(2)}</span>`;
            
        let available_qty_html = totals.available_qty < 0 ? 
            `<span style="color: #dc3545; font-weight: 900;">${totals.available_qty.toFixed(2)}</span>` : 
            `<span style="color: #495057; font-weight: 900;">${totals.available_qty.toFixed(2)}</span>`;
            
        let other_movements_html = Math.abs(totals.other_movements) < 0.01 ? 
            `<span style="color: #6c757d; font-weight: 900;">0.00</span>` :
            `<span style="color: #007bff; font-weight: 900;">${totals.other_movements.toFixed(2)}</span>`;
            
        let difference_html = Math.abs(totals.difference) < 0.01 ? 
            `<span style="color: #6c757d; font-weight: 900;">0.00</span>` :
            totals.difference > 0 ? 
            `<span style="color: #28a745; font-weight: 900;">+${totals.difference.toFixed(2)}</span>` :
            `<span style="color: #dc3545; font-weight: 900;">${totals.difference.toFixed(2)}</span>`;
            
        let gross_profit_html = totals.gross_profit > 0 ? 
            `<span style="color: #28a745; font-weight: 900;">${format_currency(totals.gross_profit)}</span>` :
            totals.gross_profit < 0 ?
            `<span style="color: #dc3545; font-weight: 900;">${format_currency(totals.gross_profit)}</span>` :
            `<span style="color: #6c757d; font-weight: 900;">0.00</span>`;
        
        let $totals_row = $(`
            <tr class="totals-row" style="background-color: #e9ecef; font-weight: bold; border-top: 3px solid #495057; border-bottom: 3px solid #495057;">
                <td style="font-weight: 900; font-size: 13px;">${totals.item_code}</td>
                <td style="font-weight: 900;">${totals.item_name}</td>
                <td style="font-weight: 900;">${totals.warehouse}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${opening_balance_html}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;"><span style="color: #28a745;">${totals.purchases_qty.toFixed(2)}</span></td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;"><span style="color: #28a745;">${format_currency(totals.purchases_value)}</span></td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;"><span style="color: #dc3545;">${totals.sold_qty.toFixed(2)}</span></td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;"><span style="color: #dc3545;">${format_currency(totals.cogs)}</span></td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;"><span style="color: #004085;">${format_currency(totals.sales_revenue)}</span></td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${gross_profit_html}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${other_movements_html}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${closing_balance_html}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${available_qty_html}</td>
                <td class="text-right" style="font-weight: 900; font-size: 13px;">${difference_html}</td>
            </tr>
        `);
        
        report.$report_footer = $(`<div class="report-footer" style="margin-top: -1px;"></div>`);
        report.$report_footer.append(`
            <table class="table table-bordered" style="margin-top: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tbody>${$totals_row.prop('outerHTML')}</tbody>
            </table>
        `);
        report.$datatable_wrapper.after(report.$report_footer);
    },
    
    print_report: function(report) {
        let filters = report.get_values();
        let data = report.data || [];
        
        let dataForPrint = [];
        let totalsRow = null;
        
        data.forEach(function(row) {
            if (row._bold || (row.item_code && row.item_code.includes(__("Grand Total")))) {
                totalsRow = row;
            } else {
                dataForPrint.push(row);
            }
        });
        
        let totals = {
            purchases_value: 0,
            cogs: 0,
            sales_revenue: 0,
            gross_profit: 0,
            difference: 0,
            negative_items: 0,
            items_with_difference: 0
        };
        
        dataForPrint.forEach(function(row) {
            totals.purchases_value += row.purchases_value || 0;
            totals.cogs += row.cogs || 0;
            totals.sales_revenue += row.sales_revenue || 0;
            totals.gross_profit += row.gross_profit || 0;
            totals.difference += row.difference || 0;
            
            if (row.available_qty < 0) {
                totals.negative_items++;
            }
            
            if (Math.abs(row.difference || 0) > 0.01) {
                totals.items_with_difference++;
            }
        });
        
        let print_html = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير حركة المخزون اليومي - ${filters.date}</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { 
                    font-family: Arial, Tahoma, sans-serif; 
                    font-size: 11pt; 
                    direction: rtl; 
                    margin: 0;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 20px; 
                    border-bottom: 2px solid #333;
                    padding-bottom: 10px;
                }
                h1 { 
                    margin: 0; 
                    font-size: 20pt; 
                    color: #2c3e50; 
                }
                .info-bar {
                    display: flex;
                    justify-content: space-between;
                    margin: 15px 0;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 5px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-bottom: 20px;
                    font-size: 9pt;
                }
                th { 
                    padding: 8px 5px; 
                    text-align: center;
                    background: #2c3e50;
                    color: white;
                    font-weight: bold;
                    border: 1px solid #2c3e50;
                }
                
                td { 
                    padding: 5px; 
                    text-align: center; 
                    border: 1px solid #ddd; 
                    background: white;
                }
                
                td:nth-child(5), td:nth-child(6) { 
                    color: #28a745; 
                    font-weight: 600;
                }
                td:nth-child(7), td:nth-child(8) { 
                    color: #dc3545; 
                    font-weight: 600;
                }
                td:nth-child(9) { 
                    color: #004085; 
                    font-weight: 600;
                }
                td:nth-child(10) { 
                    font-weight: 700;
                }
                td:nth-child(11) { 
                    color: #007bff; 
                    font-weight: 600;
                }
                td:nth-child(4), td:nth-child(12), td:nth-child(13) {
                    color: #495057;
                    font-weight: 600;
                }
                td:nth-child(14) { 
                    color: #fd7e14; 
                    font-weight: 700;
                }
                
                td:nth-child(1), td:nth-child(2), td:nth-child(3) {
                    color: #212529;
                    font-weight: 500;
                }
                
                tr:hover td { background-color: #f8f9fa !important; }
                .negative { color: #dc3545 !important; font-weight: bold; }
                .positive { color: #28a745 !important; }
                .diff-negative { color: #dc3545 !important; font-weight: bold; }
                .diff-positive { color: #28a745 !important; font-weight: bold; }
                .number { text-align: left; direction: ltr; }
                .text-right { text-align: right; }
                
                .totals-row {
                    background: #e9ecef !important;
                    font-weight: 900;
                    font-size: 11pt;
                    border-top: 3px solid #343a40;
                    border-bottom: 3px solid #343a40;
                }
                .totals-row td {
                    padding: 8px;
                    font-weight: 900;
                    background: #e9ecef !important;
                    color: inherit;
                }
                .totals-row td:nth-child(5), .totals-row td:nth-child(6) {
                    color: #28a745 !important;
                }
                .totals-row td:nth-child(7), .totals-row td:nth-child(8) {
                    color: #dc3545 !important;
                }
                .totals-row td:nth-child(9) {
                    color: #004085 !important;
                }
                .totals-row td:nth-child(11) {
                    color: #007bff !important;
                }
                .totals-row td:nth-child(14) {
                    color: #fd7e14 !important;
                }
                
                td:nth-child(4), td:nth-child(6), td:nth-child(8), td:nth-child(10), td:nth-child(11), td:nth-child(13) {
                    border-right: 2px solid #adb5bd;
                }
                @media print {
                    body { font-size: 10pt; }
                    table { font-size: 8pt; }
                    .no-print { display: none; }
                    td, .negative, .positive, .diff-negative, .diff-positive {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>تقرير حركة المخزون اليومي</h1>
                <div style="margin-top: 10px; color: #666;">
                    التاريخ: ${filters.date}
                    ${filters.from_time !== "00:00:00" || filters.to_time !== "23:59:59" ? 
                        ` | من ${filters.from_time} إلى ${filters.to_time}` : ''}
                </div>
            </div>
            
            <div class="info-bar">
                <div>الشركة: ${frappe.defaults.get_user_default("company") || ""}</div>
                <div>تاريخ الطباعة: ${frappe.datetime.now_datetime()}</div>
                <div>المستخدم: ${frappe.session.user_fullname}</div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>كود الصنف</th>
                        <th>اسم الصنف</th>
                        <th>المخزن</th>
                        <th>رصيد أول</th>
                        <th>مشتريات</th>
                        <th>قيمة المشتريات</th>
                        <th>مبيعات</th>
                        <th>تكلفة المبيعات</th>
                        <th>إيراد المبيعات</th>
                        <th>الربح الإجمالي</th>
                        <th>حركات أخرى</th>
                        <th>رصيد آخر</th>
                        <th>الرصيد الحالي</th>
                        <th>الفرق</th>
                    </tr>
                </thead>
                <tbody>`;
        
        dataForPrint.forEach(function(row) {
            let diff_class = "";
            if (Math.abs(row.difference || 0) > 0.01) {
                diff_class = row.difference > 0 ? "diff-positive" : "diff-negative";
            }
            
            let profit_class = "";
            if (row.gross_profit > 0) {
                profit_class = "positive";
            } else if (row.gross_profit < 0) {
                profit_class = "negative";
            }
            
            print_html += `
                    <tr>
                        <td>${row.item_code || ""}</td>
                        <td class="text-right">${row.item_name || ""}</td>
                        <td class="text-right">${row.warehouse || ""}</td>
                        <td class="number ${row.opening_balance < 0 ? 'negative' : ''}">${(row.opening_balance || 0).toFixed(2)}</td>
                        <td class="number">${(row.purchases_qty || 0).toFixed(2)}</td>
                        <td class="number">${(row.purchases_value || 0).toFixed(2)}</td>
                        <td class="number">${(row.sold_qty || 0).toFixed(2)}</td>
                        <td class="number">${(row.cogs || 0).toFixed(2)}</td>
                        <td class="number">${(row.sales_revenue || 0).toFixed(2)}</td>
                        <td class="number ${profit_class}">${(row.gross_profit || 0).toFixed(2)}</td>
                        <td class="number ${row.other_movements < 0 ? 'negative' : row.other_movements > 0 ? 'positive' : ''}">
                            ${row.other_movements ? (row.other_movements > 0 ? '+' : '') + row.other_movements.toFixed(2) : '-'}
                        </td>
                        <td class="number ${row.closing_balance < 0 ? 'negative' : ''}">${(row.closing_balance || 0).toFixed(2)}</td>
                        <td class="number ${row.available_qty < 0 ? 'negative' : ''}">${(row.available_qty || 0).toFixed(2)}</td>
                        <td class="number ${diff_class}">
                            ${Math.abs(row.difference || 0) > 0.01 ? (row.difference > 0 ? '+' : '') + row.difference.toFixed(2) : '-'}
                        </td>
                    </tr>`;
        });
        
        if (totalsRow) {
            print_html += `
                    <tr class="totals-row">
                        <td><b>الإجمالي</b></td>
                        <td></td>
                        <td></td>
                        <td class="number ${totalsRow.opening_balance < 0 ? 'negative' : ''}">${(totalsRow.opening_balance || 0).toFixed(2)}</td>
                        <td class="number">${(totalsRow.purchases_qty || 0).toFixed(2)}</td>
                        <td class="number">${(totalsRow.purchases_value || 0).toFixed(2)}</td>
                        <td class="number">${(totalsRow.sold_qty || 0).toFixed(2)}</td>
                        <td class="number">${(totalsRow.cogs || 0).toFixed(2)}</td>
                        <td class="number">${(totalsRow.sales_revenue || 0).toFixed(2)}</td>
                        <td class="number ${totalsRow.gross_profit < 0 ? 'negative' : totalsRow.gross_profit > 0 ? 'positive' : ''}">${(totalsRow.gross_profit || 0).toFixed(2)}</td>
                        <td class="number ${totalsRow.other_movements < 0 ? 'negative' : totalsRow.other_movements > 0 ? 'positive' : ''}">${(totalsRow.other_movements || 0).toFixed(2)}</td>
                        <td class="number ${totalsRow.closing_balance < 0 ? 'negative' : ''}">${(totalsRow.closing_balance || 0).toFixed(2)}</td>
                        <td class="number ${totalsRow.available_qty < 0 ? 'negative' : ''}">${(totalsRow.available_qty || 0).toFixed(2)}</td>
                        <td class="number ${totalsRow.difference < -0.01 ? 'negative' : totalsRow.difference > 0.01 ? 'positive' : ''}">${(totalsRow.difference || 0).toFixed(2)}</td>
                    </tr>`;
        }
        
        print_html += `
                </tbody>
            </table>
        </body>
        </html>`;
        
        let print_window = window.open('', '_blank');
        print_window.document.write(print_html);
        print_window.document.close();
        
        setTimeout(function() {
            print_window.print();
        }, 500);
    },
    
    "get_summary": function(data) {
        let total_purchases_value = 0;
        let total_cogs = 0;
        let total_sales_revenue = 0;
        let total_gross_profit = 0;
        let total_difference = 0;
        let total_other_movements = 0;
        let items_with_difference = 0;
        let negative_stock_items = 0;
        let items_with_profit = 0;
        let items_with_loss = 0;
        
        data.forEach(function(row) {
            if (!row._bold) {
                total_purchases_value += row.purchases_value || 0;
                total_cogs += row.cogs || 0;
                total_sales_revenue += row.sales_revenue || 0;
                total_gross_profit += row.gross_profit || 0;
                total_difference += row.difference || 0;
                total_other_movements += row.other_movements || 0;
                
                if (Math.abs(row.difference || 0) > 0.01) {
                    items_with_difference++;
                }
                
                if ((row.available_qty || 0) < 0) {
                    negative_stock_items++;
                }
                
                if ((row.gross_profit || 0) > 0) {
                    items_with_profit++;
                } else if ((row.gross_profit || 0) < 0) {
                    items_with_loss++;
                }
            }
        });
        
        let gross_profit_margin = total_sales_revenue > 0 ? 
            ((total_gross_profit / total_sales_revenue) * 100).toFixed(2) : 0;
        
        return [
            {
                "label": __("إجمالي قيمة المشتريات"),
                "value": format_currency(total_purchases_value),
                "indicator": "Green"
            },
            {
                "label": __("إجمالي إيراد المبيعات"),
                "value": format_currency(total_sales_revenue),
                "indicator": "Blue"
            },
            {
                "label": __("إجمالي تكلفة المبيعات"),
                "value": format_currency(total_cogs),
                "indicator": "Orange"
            },
            {
                "label": __("إجمالي الربح الإجمالي"),
                "value": format_currency(total_gross_profit),
                "indicator": total_gross_profit >= 0 ? "Green" : "Red"
            },
            {
                "label": __("نسبة الربح الإجمالي"),
                "value": gross_profit_margin + "%",
                "indicator": gross_profit_margin >= 20 ? "Green" : gross_profit_margin >= 10 ? "Orange" : "Red"
            },
            {
                "label": __("أصناف رابحة / خاسرة"),
                "value": items_with_profit + " / " + items_with_loss,
                "indicator": items_with_loss === 0 ? "Green" : "Yellow"
            },
            {
                "label": __("إجمالي الحركات الأخرى"),
                "value": total_other_movements.toFixed(2),
                "indicator": total_other_movements >= 0 ? "Blue" : "Orange"
            },
            {
                "label": __("إجمالي الفروقات"),
                "value": (total_difference > 0 ? "+" : "") + total_difference.toFixed(2),
                "indicator": Math.abs(total_difference) < 0.01 ? "Green" : "Red"
            },
            {
                "label": __("أصناف بمخزون سالب"),
                "value": negative_stock_items,
                "indicator": negative_stock_items === 0 ? "Green" : "Red"
            }
        ];
    }
};