// Copyright (c) 2023, Me and contributors
// For license information, please see license.txt
/* eslint-disable */

// كود للتنفيذ التلقائي عند تحميل الصفحة
$(document).ready(function() {
    console.log("تم تحميل صفحة تقرير الأصناف الراكدة - محاولة تنفيذ التقرير تلقائياً");
    
    // محاولة تنفيذ التقرير تلقائياً
    setTimeout(function() {
        if ($('.primary-action').length > 0) {
            console.log("تم العثور على زر التنفيذ - جاري النقر عليه");
            $('.primary-action').click();
        } else {
            console.log("لم يتم العثور على زر التنفيذ");
            
            if ($('.btn-primary:contains("تنفيذ")').length > 0) {
                console.log("تم العثور على زر تنفيذ بديل - جاري النقر عليه");
                $('.btn-primary:contains("تنفيذ")').click();
            }
        }
    }, 1500);
});

frappe.query_reports["Slow Moving Items"] = {
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
            "fieldname": "date_range",
            "label": __("الفترة الزمنية"),
            "fieldtype": "Select",
            "options": [
                { "value": "6_months", "label": __("6 أشهر") },
                { "value": "1_year", "label": __("سنة واحدة") },
                { "value": "2_years", "label": __("سنتين") },
                { "value": "3_years", "label": __("3 سنوات") },
                { "value": "custom", "label": __("مخصص") }
            ],
            "default": "1_year",
            "reqd": 1,
            "on_change": function() {
                let filter_value = frappe.query_report.get_filter_value('date_range');
                let today = frappe.datetime.get_today();
                let from_date = '';
                
                if (filter_value === 'custom') {
                    frappe.query_report.toggle_filter_display('from_date', true);
                    frappe.query_report.toggle_filter_display('to_date', true);
                } else {
                    frappe.query_report.toggle_filter_display('from_date', false);
                    frappe.query_report.toggle_filter_display('to_date', false);
                    
                    if (filter_value === '6_months') {
                        from_date = frappe.datetime.add_months(today, -6);
                    } else if (filter_value === '1_year') {
                        from_date = frappe.datetime.add_months(today, -12);
                    } else if (filter_value === '2_years') {
                        from_date = frappe.datetime.add_months(today, -24);
                    } else if (filter_value === '3_years') {
                        from_date = frappe.datetime.add_months(today, -36);
                    }
                    
                    frappe.query_report.set_filter_value('from_date', from_date);
                    frappe.query_report.set_filter_value('to_date', today);
                }
            }
        },
        {
            "fieldname": "from_date",
            "label": __("من تاريخ"),
            "fieldtype": "Date",
            "hidden": 1
        },
        {
            "fieldname": "to_date",
            "label": __("إلى تاريخ"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "hidden": 1
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
            "fieldname": "warehouse",
            "label": __("المستودع"),
            "fieldtype": "Link",
            "options": "Warehouse"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (column.fieldname === "days_since_last_sale") {
            var color = "black";
            if (value > 365*2) color = "red";
            else if (value > 365) color = "orange";
            else if (value <= 180) color = "green";
            
            return `<span style="color: ${color}; font-weight: bold;">${value}</span>`;
        }
        else if (column.fieldname === "available_qty" && value > 0) {
            return `<span style="font-weight: bold;">${value}</span>`;
        }
        return default_formatter(value, row, column, data);
    },
    onload: function(report) {
        console.log("تم تحميل التقرير - محاولة إضافة زر الطباعة");
        
        // تأخير إضافة الزر قليلاً للتأكد من اكتمال تحميل الواجهة
        setTimeout(function() {
            report.page.add_inner_button(__("Print Report"), function() {
                // الحصول على الفلاتر المطبقة حالياً
                let filters = report.get_values();
                
                // التأكد من وجود بيانات للطباعة
                if (!report.data || !report.data.length) {
                    frappe.msgprint(__("لا توجد بيانات للطباعة. يرجى تطبيق مرشحات أخرى."));
                    return;
                }
                
                // الحصول على البيانات المرئية
                let data = [];
                if (report.datatable && report.datatable.datamanager) {
                    try {
                        let visible_idx = report.datatable.datamanager.getFilteredRowIndices();
                        data = visible_idx.map(idx => report.data[idx]);
                    } catch (e) {
                        console.error("خطأ في الحصول على الصفوف المفلترة:", e);
                        data = report.data;
                    }
                } else {
                    data = report.data;
                }
                
                // إنشاء وفتح عرض الطباعة
                generatePrintView(filters, data);
            }).addClass("btn-primary");
        }, 1000);
    }
};

function generatePrintView(filters, data) {
    if (!filters) filters = {};
    if (!data || !data.length) {
        frappe.msgprint(__("لا توجد بيانات للطباعة. يرجى تطبيق مرشحات أخرى."));
        return;
    }
    
    // تحضير البيانات للطباعة
    let dateTime = frappe.datetime.now_datetime();
    let formattedDate = frappe.datetime.str_to_user(dateTime);
    let company = filters.company || frappe.defaults.get_user_default("Company");
    
    // تحضير معلومات المرشحات للعرض
    let filterInfo = [];
    if (filters.company) filterInfo.push(`الشركة: ${filters.company}`);
    
    // إضافة معلومات الفترة الزمنية
    let date_range_text = '';
    if (filters.date_range === '6_months') date_range_text = '6 أشهر';
    else if (filters.date_range === '1_year') date_range_text = 'سنة واحدة';
    else if (filters.date_range === '2_years') date_range_text = 'سنتين';
    else if (filters.date_range === '3_years') date_range_text = '3 سنوات';
    else date_range_text = 'مخصص';
    
    filterInfo.push(`الفترة الزمنية: ${date_range_text}`);
    
    // إضافة معلومات المرشحات الإضافية
    if (filters.item_group) filterInfo.push(`مجموعة الصنف: ${filters.item_group}`);
    if (filters.item_code) filterInfo.push(`كود الصنف: ${filters.item_code}`);
    if (filters.warehouse) filterInfo.push(`المستودع: ${filters.warehouse}`);
    if (filters.from_date && filters.to_date) {
        filterInfo.push(`الفترة: ${frappe.format(filters.from_date, {fieldtype: 'Date'})} إلى ${frappe.format(filters.to_date, {fieldtype: 'Date'})}`);
    }
    
    // إنشاء محتوى HTML للطباعة
    let htmlContent = `
    <div class="print-content">
        <div class="print-header">
            <div class="company-info">
                <h1 class="company-name">${company}</h1>
                <h2 class="report-title">تقرير الأصناف الراكدة</h2>
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
                    <th>مجموعة الصنف</th>
                    <th>الكمية المتاحة</th>
                    <th>قيمة المخزون</th>
                    <th>آخر حركة بيع</th>
                    <th>أيام منذ آخر بيع</th>
                    <th>آخر حركة شراء</th>
                    <th>المستودع</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // إضافة صفوف البيانات
    data.forEach((row, index) => {
        let days_color = "black";
        if (row.days_since_last_sale > 365*2) days_color = "red";
        else if (row.days_since_last_sale > 365) days_color = "orange";
        else if (row.days_since_last_sale <= 180) days_color = "green";
        
        htmlContent += `
            <tr>
                <td class="center">${index + 1}</td>
                <td>${row.item_code || ''}</td>
                <td>${row.item_name || ''}</td>
                <td>${row.item_group || ''}</td>
                <td class="number">${frappe.format(row.available_qty, {fieldtype: 'Float'})}</td>
                <td class="number">${frappe.format(row.stock_value, {fieldtype: 'Currency'})}</td>
                <td class="center">${row.last_sale_date ? frappe.format(row.last_sale_date, {fieldtype: 'Date'}) : 'لا يوجد'}</td>
                <td class="number" style="color: ${days_color}; font-weight: bold;">${row.days_since_last_sale || 'لا يوجد'}</td>
                <td class="center">${row.last_purchase_date ? frappe.format(row.last_purchase_date, {fieldtype: 'Date'}) : 'لا يوجد'}</td>
                <td>${row.warehouse || ''}</td>
            </tr>
        `;
    });
    
    htmlContent += `
            </tbody>
        </table>
        
        <div class="print-footer">
            <div class="footer-info">
                <p>عدد الأصناف الراكدة: ${data.length}</p>
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
                <title>تقرير الأصناف الراكدة</title>
                <style>
                    @page {
                        size: A4 landscape;
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
