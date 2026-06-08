frappe.query_reports["Simple Items Barcode"] = {
    "filters": [
        {
            "fieldname": "item_code",
            "label": __("Item Code"),
            "fieldtype": "Link",
            "options": "Item"
        },
        {
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group"
        },
        {
            "fieldname": "barcode",
            "label": __("Barcode"),
            "fieldtype": "Data"
        },
        {
            "fieldname": "price_list",
            "label": __("Price List"),
            "fieldtype": "Link",
            "options": "Price List",
            "default": frappe.defaults.get_default("selling_price_list"),
            "get_query": function() {
                return {
                    filters: {
                        "selling": 1,
                        "enabled": 1
                    }
                };
            }
        },
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company")
        }
    ],

    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) return default_formatter(value, row, column, data);
        
        if (value === null || value === undefined || value === "null") {
            value = "";
        }
        
        if (column.fieldname === "barcode" && value) {
            return `<span style="font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1em;">${value}</span>`;
        }
        
        if (column.fieldname === "selling_price") {
            let price = parseFloat(value) || 0;
            let currency = data.currency || frappe.defaults.get_default("currency");
            let formatted = format_currency(price, currency);
            
            let color = price > 0 ? "#2ecc71" : "#e74c3c";
            return `<span style="font-weight: bold; color: ${color};">${formatted}</span>`;
        }
        
        if (column.fieldname === "barcode_type" && value) {
            let typeColors = {
                "EAN": "#3498db",
                "UPC": "#e74c3c",
                "CODE128": "#f39c12",
                "CODE39": "#9b59b6",
                "QR": "#1abc9c"
            };
            let color = typeColors[value] || "#7f8c8d";
            return `<span style="color: ${color}; font-weight: 600;">${value}</span>`;
        }
        
        if (column.fieldname === "print_label") {
            return `<div style="text-align: center;">
                    <button class="btn btn-xs btn-primary print-single-label" 
                        data-item-code="${data.item_code}" 
                        data-item-name="${data.item_name}" 
                        data-barcode="${data.barcode}" 
                        data-price="${data.selling_price}">
                        <i class="fa fa-print"></i> طباعة
                    </button>
                    </div>`;
        }
        
        if (column.fieldname === "print_barcode") {
            return `<div style="text-align: center;">
                    <button class="btn btn-xs btn-warning print-barcode-only" 
                        data-barcode="${data.barcode}">
                        <i class="fa fa-barcode"></i> شريط باركود
                    </button>
                    </div>`;
        }
        
        return default_formatter(value, row, column, data);
    },

    "onload": function(report) {
        report.page.add_inner_button(__("Export Barcodes"), function() {
            exportBarcodes(report);
        });
        
        frappe.ui.keys.add_shortcut({
            shortcut: 'ctrl+e',
            action: () => exportBarcodes(report),
            page: report.page,
            description: __('Export Barcodes')
        });
    },

    "after_datatable_render": function(datatable_obj, report) {
        if (!datatable_obj) return;
        
        window.current_report = report;
        
        if (report && report.data) {
            report.data.forEach((row, idx) => {
                if (!row.selling_price || parseFloat(row.selling_price) === 0) {
                    $(`.dt-row-${idx}`).css('background-color', 'rgba(231, 76, 60, 0.1)');
                }
            });
        }
        
        $(document).off('click', '.print-single-label').on('click', '.print-single-label', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            let $btn = $(this);
            let itemData = {
                item_code: $btn.attr('data-item-code'),
                item_name: $btn.attr('data-item-name'),
                barcode: $btn.attr('data-barcode'),
                price: parseFloat($btn.attr('data-price')) || 0
            };
            
            printSingleLabel(itemData);
        });
        
        $(document).off('click', '.print-barcode-only').on('click', '.print-barcode-only', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            let $btn = $(this);
            let itemData = {
                barcode: $btn.attr('data-barcode')
            };
            
            printBarcodeOnly(itemData);
        });
        
        $(document).off('click', '.dt-cell--col-5').on('click', '.dt-cell--col-5', function() {
            let barcode = $(this).text().trim();
            if (barcode) {
                showBarcodeDialog(barcode);
            }
        });
    }
};

function printSingleLabel(item) {
    frappe.show_alert({message: __("جاري طباعة الملصق..."), indicator: 'blue'});
    
    let company = frappe.defaults.get_user_default("Company") || "";
    
    let labelHTML = `
        <div class="label">
            <div class="content-wrapper">
                <div class="company-name">${company}</div>
                <div class="item-name">${item.item_name || ''}</div>
                <div class="barcode-container">
                    <svg class="barcode" id="barcode-svg"></svg>
                    <div class="barcode-text">${item.barcode || ''}</div>
                </div>
                <div class="price">${format_currency(item.price || 0, frappe.defaults.get_default("currency"))}</div>
            </div>
        </div>
    `;
    
    let html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة ملصق - ${item.item_name || ''}</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page { 
                    size: 50mm 25mm;
                    margin: 0;
                }
                
                html, body {
                    width: 50mm;
                    height: 25mm;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                
                body {
                    font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif;
                    direction: rtl;
                }
                
                .label {
                    width: 50mm;
                    height: 25mm;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1mm;
                    box-sizing: border-box;
                }
                
                .content-wrapper {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-around;
                    text-align: center;
                    align-items: center;
                }
                
                .company-name {
                    font-size: 6pt;
                    font-weight: bold;
                    color: #000;
                    line-height: 1;
                    margin: 0;
                }
                
                .item-name {
                    font-size: 6.5pt;
                    font-weight: bold;
                    color: #000;
                    line-height: 1;
                    max-height: 4mm;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    margin: 0;
                }
                
                .barcode-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                }
                
                .barcode {
                    max-width: 46mm;
                    max-height: 8mm;
                }
                
                .barcode-text {
                    font-size: 7pt;
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    line-height: 1;
                    font-weight: bold;
                }
                
                .price {
                    font-size: 7pt;
                    font-weight: bold;
                    color: #000;
                    line-height: 1;
                    margin: 0;
                }
                
                @media print {
                    @page {
                        size: 50mm 25mm;
                        margin: 0;
                    }
                    
                    html, body {
                        width: 50mm !important;
                        height: 25mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    .label {
                        width: 50mm !important;
                        height: 25mm !important;
                        page-break-inside: avoid;
                        page-break-after: avoid;
                        page-break-before: avoid;
                    }
                }
            </style>
        </head>
        <body>
            ${labelHTML}
            <script>
                window.onload = function() {
                    try {
                        if ("${item.barcode}") {
                            JsBarcode("#barcode-svg", "${item.barcode}", {
                                format: "CODE128",
                                width: 1,
                                height: 30,
                                displayValue: false,
                                margin: 0
                            });
                        }
                    } catch(e) {
                        console.error('Error generating barcode:', e);
                    }
                    
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }, 100);
                };
            </script>
        </body>
        </html>
    `;
    
    try {
        let printWindow = window.open('', '_blank', 'width=400,height=300,resizable=yes,scrollbars=yes');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            frappe.msgprint(__("يرجى السماح بالنوافذ المنبثقة لطباعة الملصق"));
        }
    } catch(e) {
        frappe.msgprint(__("حدث خطأ أثناء فتح نافذة الطباعة: ") + e.message);
    }
}

function printBarcodeOnly(item) {
    frappe.show_alert({message: __("جاري طباعة الباركود فقط..."), indicator: 'blue'});
    
    let labelHTML = `
        <div class="label">
            <div class="content-wrapper">
                <div class="barcode-container">
                    <svg class="barcode" id="barcode-svg"></svg>
                    <div class="barcode-text">${item.barcode || ''}</div>
                </div>
            </div>
        </div>
    `;
    
    let html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة باركود - ${item.barcode || ''}</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page { 
                    size: 50mm 25mm;
                    margin: 0;
                }
                
                html, body {
                    width: 50mm;
                    height: 25mm;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                
                body {
                    font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif;
                    direction: rtl;
                }
                
                .label {
                    width: 50mm;
                    height: 25mm;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1mm;
                    box-sizing: border-box;
                }
                
                .content-wrapper {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    text-align: center;
                    align-items: center;
                }
                
                .barcode-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                }
                
                .barcode {
                    max-width: 46mm;
                    max-height: 15mm;
                }
                
                .barcode-text {
                    font-size: 8pt;
                    font-family: 'Courier New', monospace;
                    margin: 2px 0 0 0;
                    line-height: 1;
                    font-weight: bold;
                }
                
                @media print {
                    @page {
                        size: 50mm 25mm;
                        margin: 0;
                    }
                    
                    html, body {
                        width: 50mm !important;
                        height: 25mm !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    .label {
                        width: 50mm !important;
                        height: 25mm !important;
                        page-break-inside: avoid;
                        page-break-after: avoid;
                        page-break-before: avoid;
                    }
                }
            </style>
        </head>
        <body>
            ${labelHTML}
            <script>
                window.onload = function() {
                    try {
                        if ("${item.barcode}") {
                            JsBarcode("#barcode-svg", "${item.barcode}", {
                                format: "CODE128",
                                width: 1.2,
                                height: 50,
                                displayValue: false,
                                margin: 0
                            });
                        }
                    } catch(e) {
                        console.error('Error generating barcode:', e);
                    }
                    
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }, 100);
                };
            </script>
        </body>
        </html>
    `;
    
    try {
        let printWindow = window.open('', '_blank', 'width=400,height=300,resizable=yes,scrollbars=yes');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
        } else {
            frappe.msgprint(__("يرجى السماح بالنوافذ المنبثقة لطباعة الباركود"));
        }
    } catch(e) {
        frappe.msgprint(__("حدث خطأ أثناء فتح نافذة الطباعة: ") + e.message);
    }
}

function exportBarcodes(report) {
    if (!report.data || report.data.length === 0) {
        frappe.msgprint(__("No data to export"));
        return;
    }
    
    let export_data = [];
    export_data.push(["Item Code", "Item Name", "Item Group", "UOM", "Selling Price", "Barcode", "Barcode Type"]);
    
    report.data.forEach(row => {
        export_data.push([
            row.item_code || '',
            row.item_name || '',
            row.item_group || '',
            row.uom || '',
            row.selling_price || 0,
            row.barcode || '',
            row.barcode_type || ''
        ]);
    });
    
    frappe.tools.downloadify(export_data, null, 'Items_Barcode_Report');
}

function showBarcodeDialog(barcode) {
    let dialog = new frappe.ui.Dialog({
        title: __('Barcode: ') + barcode,
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'barcode_display'
            }
        ]
    });
    
    let canvas = document.createElement('canvas');
    try {
        JsBarcode(canvas, barcode, {
            format: "CODE128",
            width: 2,
            height: 100,
            displayValue: true
        });
        
        dialog.fields_dict.barcode_display.$wrapper.html(`
            <div style="text-align: center; padding: 20px;">
                <img src="${canvas.toDataURL()}" alt="${barcode}" />
                <p style="margin-top: 10px; font-size: 14px;">
                    <button class="btn btn-primary btn-sm" onclick="navigator.clipboard.writeText('${barcode}')">
                        ${__('Copy Barcode')}
                    </button>
                </p>
            </div>
        `);
    } catch(e) {
        dialog.fields_dict.barcode_display.$wrapper.html(`
            <div style="text-align: center; padding: 20px; color: red;">
                ${__('Error generating barcode')}: ${e.message}
            </div>
        `);
    }
    
    dialog.show();
}