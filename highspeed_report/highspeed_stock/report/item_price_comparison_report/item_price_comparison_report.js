// Copyright (c) 2023, Me and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Item Price Comparison Report"] = {
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
            "fieldname": "item_group",
            "label": __("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group"
        },
        {
            "fieldname": "item_code",
            "label": __("Item Code"),
            "fieldtype": "Link",
            "options": "Item"
        },
        {
            "fieldname": "selling_price_list",
            "label": __("قائمة أسعار البيع"),
            "fieldtype": "Link",
            "options": "Price List",
            "get_query": function() {
                return {
                    filters: {
                        'selling': 1
                    }
                };
            }
        },
        {
            "fieldname": "buying_price_list",
            "label": __("قائمة أسعار الشراء"),
            "fieldtype": "Link",
            "options": "Price List",
            "get_query": function() {
                return {
                    filters: {
                        'buying': 1
                    }
                };
            }
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (column.fieldname === "profit_percentage") {
            var color = "black";
            if (value < 0) color = "red";
            else if (value < 10) color = "orange";
            else if (value >= 20) color = "green";
            
            return `<span style="color: ${color}; font-weight: bold;">${value}%</span>`;
        }
        return default_formatter(value, row, column, data);
    },
    onload: function(report) {
        console.log("تم تحميل التقرير - بدء تنفيذ التقرير تلقائياً");
        
        // تنفيذ التقرير تلقائياً
        setTimeout(function() {
            if (report.page.btn_primary) {
                console.log("النقر على زر التنفيذ الأساسي");
                report.page.btn_primary.click();
            } else {
                console.log("زر التنفيذ الأساسي غير موجود، البحث عن زر بديل");
                if ($('.primary-action').length > 0) {
                    console.log("العثور على primary-action، جاري النقر");
                    $('.primary-action').click();
                } else if ($('.btn-primary:contains("تنفيذ")').length > 0) {
                    console.log("العثور على زر تنفيذ، جاري النقر");
                    $('.btn-primary:contains("تنفيذ")').click();
                } else {
                    console.log("جاري إرسال الفورم يدوياً");
                    // محاولة أخيرة باستخدام واجهة برمجة التطبيقات الداخلية
                    report.refresh();
                }
            }
        }, 800);
        
        // إضافة زر الطباعة
        setTimeout(function() {
            report.page.add_inner_button(__("Print Report"), function() {
                printReport(report);
            }).addClass("btn-primary");
        }, 1000);
    }
};

function printReport(report) {
    // التحقق من وجود بيانات
    if (!report.data || !report.data.length) {
        frappe.msgprint(__("لا توجد بيانات للطباعة. يرجى تطبيق مرشحات أخرى أو تنفيذ التقرير."));
        return;
    }
    
    // الحصول على الفلاتر المطبقة
    let filters = report.get_values();
    
    // الحصول على البيانات المرئية
    let data = report.data;
    
    // إنشاء محتوى HTML للطباعة
    generatePrintView(filters, data);
}

function generatePrintView(filters, data) {
    // تحضير البيانات للطباعة
    let dateTime = frappe.datetime.now_datetime();
    let formattedDate = frappe.datetime.str_to_user(dateTime);
    let company = filters.company || frappe.defaults.get_user_default("Company");
    
    // تحضير معلومات المرشحات للعرض
    let filterInfo = [];
    if (filters.company) filterInfo.push(`الشركة: ${filters.company}`);
    if (filters.item_group) filterInfo.push(`مجموعة الصنف: ${filters.item_group}`);
    if (filters.item_code) filterInfo.push(`كود الصنف: ${filters.item_code}`);
    if (filters.selling_price_list) filterInfo.push(`قائمة أسعار البيع: ${filters.selling_price_list}`);
    if (filters.buying_price_list) filterInfo.push(`قائمة أسعار الشراء: ${filters.buying_price_list}`);
    
    // إنشاء محتوى HTML للطباعة
    let htmlContent = `
    <div class="print-content">
        <div class="print-header">
            <div class="company-info">
                <h1 class="company-name">${company}</h1>
                <h2 class="report-title">تقرير مقارنة أسعار الأصناف</h2>
                <p class="report-date">تاريخ التقرير: ${formattedDate}</p>
            </div>
        </div>
        
        <div class="filter-section">
            <div class="filter-title">المرشحات المطبقة:</div>
            <div class="filter-details">
                ${filterInfo.length > 0 ? filterInfo.join(' | ') : 'لا توجد مرشحات إضافية'}
            </div>
        </div>
        
        <table class="report-table">
            <thead>
                <tr>
                    <th>م</th>
                    <th>كود الصنف</th>
                    <th>اسم الصنف</th>
                    <th>سعر البيع</th>
                    <th>سعر الشراء</th>
                    <th>نسبة الربح</th>
                    <th>مجموعة الصنف</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // إضافة صفوف البيانات
    data.forEach((row, index) => {
        let profitColor = "black";
        if (row.profit_percentage < 0) profitColor = "red";
        else if (row.profit_percentage < 10) profitColor = "orange";
        else if (row.profit_percentage >= 20) profitColor = "green";
        
        htmlContent += `
            <tr>
                <td class="center">${index + 1}</td>
                <td>${row.item_code || ''}</td>
                <td>${row.item_name || ''}</td>
                <td class="number">${frappe.format(row.sell_price, {fieldtype: 'Currency'})}</td>
                <td class="number">${frappe.format(row.buy_price, {fieldtype: 'Currency'})}</td>
                <td class="number" style="color: ${profitColor}; font-weight: bold;">${row.profit_percentage}%</td>
                <td>${row.item_group || ''}</td>
            </tr>
        `;
    });
    
    htmlContent += `
            </tbody>
        </table>
        
        <div class="print-footer">
            <div class="footer-info">
                <p>عدد الأصناف: ${data.length}</p>
                <p>تم إنشاء هذا التقرير بواسطة: ${frappe.session.user} | تاريخ الطباعة: ${formattedDate}</p>
            </div>
            <div class="page-number">صفحة <span class="page-num"></span></div>
        </div>
    </div>
    `;
    
    // فتح نافذة جديدة للطباعة
    try {
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
            frappe.msgprint(__("فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات حظر النوافذ المنبثقة."));
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>تقرير مقارنة أسعار الأصناف</title>
                <style>
                    @page {
                        size: A4;
                        margin: 1.5cm;
                    }
                    @media print {
                        body {
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                        .page-break {
                            page-break-after: always;
                        }
                        .no-print { 
                            display: none; 
                        }
                        .report-table thead { 
                            display: table-header-group; 
                        }
                    }
                    body {
                        font-family: 'Arial', 'Tahoma', sans-serif;
                        font-size: 12px;
                        color: #000;
                        direction: rtl;
                        background-color: white;
                        margin: 0;
                        padding: 20px;
                    }
                    .print-content {
                        max-width: 100%;
                        margin: 0 auto;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #666;
                    }
                    .company-name {
                        font-size: 22px;
                        font-weight: bold;
                        margin: 0 0 5px 0;
                    }
                    .report-title {
                        font-size: 18px;
                        margin: 5px 0;
                    }
                    .report-date {
                        font-size: 14px;
                        margin: 5px 0;
                    }
                    .filter-section {
                        margin-bottom: 20px;
                        padding: 10px;
                        background-color: #f5f5f5;
                        border-radius: 5px;
                    }
                    .filter-title {
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .report-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    .report-table th, .report-table td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: right;
                    }
                    .report-table th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    .report-table tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .center {
                        text-align: center;
                    }
                    .number {
                        text-align: left;
                        direction: ltr;
                    }
                    .print-footer {
                        margin-top: 30px;
                        padding-top: 10px;
                        border-top: 1px solid #ddd;
                        font-size: 10px;
                        color: #666;
                        display: flex;
                        justify-content: space-between;
                    }
                    .page-number {
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = function() {
                        // تحديث أرقام الصفحات
                        let pageElements = document.getElementsByClassName('page-num');
                        for (let i = 0; i < pageElements.length; i++) {
                            pageElements[i].textContent = (i + 1);
                        }
                        // طباعة الصفحة بعد تأخير قصير للتأكد من تحميل كل شيء
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
            </html>
        `);
        
        printWindow.document.close();
    } catch (e) {
        console.error("خطأ في دالة الطباعة:", e);
        frappe.msgprint(__("حدث خطأ أثناء محاولة الطباعة. يرجى المحاولة مرة أخرى."));
    }
}
