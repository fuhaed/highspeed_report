// Copyright (c) 2026, Highspeed and contributors
// For license information, please see license.txt

frappe.query_reports["Accountant Quick Financial Summary"] = {
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
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.month_start(),
            "reqd": 1,
            "width": "120px"
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1,
            "width": "120px"
        }
    ],
    "formatter": function(value, row, column, data, default_formatter) {
        if (!data) {
            return default_formatter(value, row, column, data);
        }

        if (column.fieldname === "category" || column.fieldname === "metric" || column.fieldname === "remarks") {
            return default_formatter(__(value), row, column, data);
        }

        if (column.fieldname === "value") {
            const val = parseFloat(value) || 0;
            let formatted = default_formatter(value, row, column, data);
            if (formatted && formatted.includes("<div")) {
                formatted = $(formatted).text().trim();
            }
            
            const green_metrics = [
                "Net Inflow (Debit)",
                "VAT Collected (Sales)",
                "Net Operating Profit",
                "Net Sales"
            ];

            const red_metrics = [
                "Net Outflow (Credit)",
                "VAT Paid (Purchases)",
                "Total Payables",
                "Overdue Payables",
                "Payables (0-30 Days)",
                "Payables (30-60 Days)",
                "Payables (60+ Days)",
                "Operating Expenses",
                "Cost of Goods Sold (COGS)",
                "Net Purchases"
            ];

            const metric_val = data.metric || "";
            const is_green = green_metrics.some(m => metric_val === m || metric_val === __(m));
            const is_red = red_metrics.some(m => metric_val === m || metric_val === __(m));

            if (is_green) {
                return `<span style="color: #27ae60; font-weight: bold;">+${formatted}</span>`;
            }
            if (is_red) {
                return `<span style="color: #e74c3c; font-weight: bold;">-${formatted}</span>`;
            }
            return `<span style="font-weight: bold; color: #2c3e50;">${formatted}</span>`;
        }

        return default_formatter(value, row, column, data);
    },
    "after_datatable_render": function(datatable) {
        var report = frappe.query_report;
        if (report.data && report.data.length > 0) {
            // Hide standard summary
            report.page.wrapper.find(".report-summary").hide();
            
            // Remove previous custom dashboard if present
            report.page.wrapper.find(".financial-dashboard-section").remove();
            
            var $dashboardSection = $('<div class="financial-dashboard-section"></div>');
            
            var $anchor = report.page.wrapper.find(".page-form");
            if (!$anchor.length) {
                $anchor = report.page.wrapper.find(".report-summary");
            }
            
            if ($anchor.length) {
                $anchor.after($dashboardSection);
            } else {
                report.page.wrapper.find(".report-wrapper").before($dashboardSection);
            }
            
            updateFinancialDashboard(report.data, $dashboardSection);
        }
    },
    "onload": function(report) {
        report.page.add_inner_button(__("طباعة التقرير"), function() {
            if (report.data && report.data.length > 0) {
                const html = get_accountant_print_html(report.data, report.get_values());
                var w = window.open();
                if (w) {
                    w.document.write(html);
                    w.document.close();
                    setTimeout(function() {
                        w.print();
                    }, 500);
                } else {
                    frappe.msgprint(__("تم حظر النوافذ المنبثقة. يرجى السماح بالنوافذ المنبثقة لطباعة التقرير."));
                }
            } else {
                frappe.msgprint(__("لا توجد بيانات لعرضها."));
            }
        });
    }
};

function updateFinancialDashboard(data, $container) {
    if (!$('#financial-summary-style').length) {
        $('head').append(`
            <style id="financial-summary-style">
                .financial-dashboard-container {
                    margin: 20px 15px;
                    direction: rtl;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                .financial-kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .financial-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 18px 15px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .financial-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
                }
                .financial-card .card-icon {
                    position: absolute;
                    top: 15px;
                    left: 15px;
                    font-size: 24px;
                    opacity: 0.8;
                }
                .financial-card .card-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #64748b;
                    font-weight: 600;
                    margin-bottom: 6px;
                }
                .financial-card .card-value {
                    font-size: 20px;
                    font-weight: 700;
                    color: #0f172a;
                    font-family: Menlo, Monaco, Consolas, monospace;
                    margin-bottom: 6px;
                    direction: ltr;
                    text-align: right;
                }
                .financial-card .card-sub {
                    font-size: 11px;
                    color: #64748b;
                }
                .financial-panels-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .financial-panel {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    overflow: hidden;
                }
                .financial-panel .panel-header {
                    background-color: #f8fafc;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 12px 15px;
                    font-weight: 700;
                    color: #1e293b;
                    font-size: 13px;
                }
                .financial-panel .panel-body {
                    padding: 15px;
                }
                .panel-table, .aging-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .panel-table th, .panel-table td, .aging-table th, .aging-table td {
                    padding: 8px 10px;
                    font-size: 12px;
                    border-bottom: 1px solid #f1f5f9;
                    text-align: right;
                }
                .panel-table th, .aging-table th {
                    background-color: #f8fafc;
                    font-weight: 700;
                    color: #475569;
                    border-bottom: 2px solid #e2e8f0;
                }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 12px;
                }
                .stat-row.highlight-row {
                    background-color: #f8fafc;
                    font-weight: bold;
                    padding: 10px 5px;
                    border-radius: 4px;
                    border-bottom: 2px solid #e2e8f0;
                }
                .stat-label {
                    color: #334155;
                }
                .stat-value {
                    font-weight: 700;
                    direction: ltr;
                    font-family: Menlo, Monaco, monospace;
                }
                .sub-panel-title {
                    font-size: 12px;
                    font-weight: bold;
                    color: #0f172a;
                    border-inline-start: 3px solid #3b82f6;
                    padding-inline-start: 8px;
                    margin-bottom: 10px;
                }
                .text-green { color: #16a34a !important; }
                .text-red { color: #dc2626 !important; }
                .text-orange { color: #ea580c !important; }
                .text-bold { font-weight: bold; }
            </style>
        `);
    }

    // Extraction helper
    const getVal = (metric, cat) => {
        const row = data.find(r => 
            (r.metric === metric || r.metric === __(metric)) && 
            (cat ? (r.category === cat || r.category === __(cat)) : true)
        );
        return row ? flt(row.value) : 0.0;
    };

    const total_liquidity = getVal("Total Liquidity", "Cash & Bank");
    const cash_in_hand = getVal("Cash in Hand", "Cash & Bank");
    const bank_balances = getVal("Bank Balances", "Cash & Bank");
    const total_receivables = getVal("Total Receivables");
    const overdue_receivables = getVal("Overdue Receivables");
    const total_payables = getVal("Total Payables");
    const overdue_payables = getVal("Overdue Payables");
    const net_profit = getVal("Net Operating Profit");
    const net_sales = getVal("Net Sales");
    const net_purchases = getVal("Net Purchases");
    const vat_collected = getVal("VAT Collected (Sales)");
    const vat_paid = getVal("VAT Paid (Purchases)");
    const net_vat_liability = getVal("Net VAT Liability");
    const ar_aging_30 = getVal("Receivables (0-30 Days)");
    const ar_aging_60 = getVal("Receivables (30-60 Days)");
    const ar_aging_90 = getVal("Receivables (60+ Days)");
    const ap_aging_30 = getVal("Payables (0-30 Days)");
    const ap_aging_60 = getVal("Payables (30-60 Days)");
    const ap_aging_90 = getVal("Payables (60+ Days)");

    // Cash & Bank accounts details
    let accounts_rows = '';
    const details = data.filter(r => r.category === "Cash & Bank Accounts Detail" || r.category === __("Cash & Bank Accounts Detail"));
    details.forEach(d => {
        accounts_rows += `
            <tr>
                <td style="font-weight: 600;">${d.metric}</td>
                <td>${__(d.remarks || "")}</td>
                <td class="stat-value text-bold" style="text-align: left; color: ${flt(d.value) < 0 ? '#dc2626' : '#1e293b'};">
                    ${frappe.format(d.value, {fieldtype: 'Currency'})}
                </td>
            </tr>
        `;
    });

    if (!accounts_rows) {
        accounts_rows = `<tr><td colspan="3" style="text-align: center; color: #64748b;">${__("No account details found")}</td></tr>`;
    }

    const html = `
        <div class="financial-dashboard-container">
            <div class="financial-kpi-grid">
                <div class="financial-card">
                    <span class="card-icon">💵</span>
                    <div class="card-title">${__("Total Liquidity")}</div>
                    <div class="card-value text-green">${frappe.format(total_liquidity, {fieldtype: 'Currency'})}</div>
                    <div class="card-sub">${__("Cash")}: ${frappe.format(cash_in_hand, {fieldtype: 'Currency'})} | ${__("Bank")}: ${frappe.format(bank_balances, {fieldtype: 'Currency'})}</div>
                </div>
                <div class="financial-card">
                    <span class="card-icon">📈</span>
                    <div class="card-title">${__("Total Receivables")}</div>
                    <div class="card-value" style="color: #2980b9;">${frappe.format(total_receivables, {fieldtype: 'Currency'})}</div>
                    <div class="card-sub" style="color: ${overdue_receivables > 0 ? '#dc2626' : '#64748b'}; font-weight: ${overdue_receivables > 0 ? '700' : '400'};">
                        ${__("Overdue")}: ${frappe.format(overdue_receivables, {fieldtype: 'Currency'})}
                    </div>
                </div>
                <div class="financial-card">
                    <span class="card-icon">📉</span>
                    <div class="card-title">${__("Total Payables")}</div>
                    <div class="card-value" style="color: #c0392b;">${frappe.format(total_payables, {fieldtype: 'Currency'})}</div>
                    <div class="card-sub" style="color: ${overdue_payables > 0 ? '#dc2626' : '#64748b'}; font-weight: ${overdue_payables > 0 ? '700' : '400'};">
                        ${__("Overdue")}: ${frappe.format(overdue_payables, {fieldtype: 'Currency'})}
                    </div>
                </div>
                <div class="financial-card">
                    <span class="card-icon">📊</span>
                    <div class="card-title">${__("Operating Profit")}</div>
                    <div class="card-value" style="color: ${net_profit < 0 ? '#dc2626' : '#16a34a'};">${frappe.format(net_profit, {fieldtype: 'Currency'})}</div>
                    <div class="card-sub">${__("Sales")}: ${frappe.format(net_sales, {fieldtype: 'Currency'})} | ${__("Purchases")}: ${frappe.format(net_purchases, {fieldtype: 'Currency'})}</div>
                </div>
            </div>

            <div class="financial-panels-grid">
                <div class="financial-panel">
                    <div class="panel-header">${__("Cash & Bank Accounts")}</div>
                    <div class="panel-body" style="max-height: 300px; overflow-y: auto;">
                        <table class="panel-table">
                            <thead>
                                <tr>
                                    <th>${__("Account")}</th>
                                    <th>${__("Type")}</th>
                                    <th style="text-align: left;">${__("Balance")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${accounts_rows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="financial-panel">
                    <div class="panel-header">${__("Tax & Aging Analysis")}</div>
                    <div class="panel-body">
                        <div class="sub-panel-title">${__("VAT Estimate")}</div>
                        <div class="stat-row">
                            <span class="stat-label">${__("VAT Collected")}:</span>
                            <span class="stat-value text-green">+${frappe.format(vat_collected, {fieldtype: 'Currency'})}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">${__("VAT Paid")}:</span>
                            <span class="stat-value text-red">-${frappe.format(vat_paid, {fieldtype: 'Currency'})}</span>
                        </div>
                        <div class="stat-row highlight-row">
                            <span class="stat-label">${__("Net VAT Liability")}:</span>
                            <span class="stat-value ${net_vat_liability < 0 ? 'text-green' : 'text-red'}">
                                ${net_vat_liability < 0 ? '' : '+'}${frappe.format(net_vat_liability, {fieldtype: 'Currency'})}
                            </span>
                        </div>

                        <div class="sub-panel-title" style="margin-top: 18px;">${__("AR & AP Aging")}</div>
                        <table class="aging-table">
                            <thead>
                                <tr>
                                    <th>${__("Age")}</th>
                                    <th style="color: #2980b9;">${__("AR")}</th>
                                    <th style="color: #c0392b;">${__("AP")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${__("0-30 Days")}</td>
                                    <td class="stat-value">${frappe.format(ar_aging_30, {fieldtype: 'Currency'})}</td>
                                    <td class="stat-value">${frappe.format(ap_aging_30, {fieldtype: 'Currency'})}</td>
                                </tr>
                                <tr>
                                    <td>${__("30-60 Days")}</td>
                                    <td class="stat-value text-orange">${frappe.format(ar_aging_60, {fieldtype: 'Currency'})}</td>
                                    <td class="stat-value text-orange">${frappe.format(ap_aging_60, {fieldtype: 'Currency'})}</td>
                                </tr>
                                <tr>
                                    <td>${__("60+ Days")}</td>
                                    <td class="stat-value text-red text-bold">${frappe.format(ar_aging_90, {fieldtype: 'Currency'})}</td>
                                    <td class="stat-value text-red text-bold">${frappe.format(ap_aging_90, {fieldtype: 'Currency'})}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    $container.html(html);
}

function get_accountant_print_html(data, filters) {
    const getVal = (metric, cat) => {
        const row = data.find(r => 
            (r.metric === metric || r.metric === __(metric)) && 
            (cat ? (r.category === cat || r.category === __(cat)) : true)
        );
        return row ? flt(row.value) : 0.0;
    };

    const total_liquidity = getVal("Total Liquidity", "Cash & Bank");
    const cash_in_hand = getVal("Cash in Hand", "Cash & Bank");
    const bank_balances = getVal("Bank Balances", "Cash & Bank");
    const total_receivables = getVal("Total Receivables");
    const overdue_receivables = getVal("Overdue Receivables");
    const total_payables = getVal("Total Payables");
    const overdue_payables = getVal("Overdue Payables");
    const net_profit = getVal("Net Operating Profit");
    const net_sales = getVal("Net Sales");
    const net_purchases = getVal("Net Purchases");
    const vat_collected = getVal("VAT Collected (Sales)");
    const vat_paid = getVal("VAT Paid (Purchases)");
    const net_vat_liability = getVal("Net VAT Liability");
    const ar_aging_30 = getVal("Receivables (0-30 Days)");
    const ar_aging_60 = getVal("Receivables (30-60 Days)");
    const ar_aging_90 = getVal("Receivables (60+ Days)");
    const ap_aging_30 = getVal("Payables (0-30 Days)");
    const ap_aging_60 = getVal("Payables (30-60 Days)");
    const ap_aging_90 = getVal("Payables (60+ Days)");

    let accounts_rows = '';
    const details = data.filter(r => r.category === "Cash & Bank Accounts Detail" || r.category === __("Cash & Bank Accounts Detail"));
    details.forEach(d => {
        accounts_rows += `
            <tr>
                <td style="text-align: right; font-weight: bold;">${d.metric}</td>
                <td>${__(d.remarks || "")}</td>
                <td class="en-number" style="text-align: left; color: ${flt(d.value) < 0 ? '#dc2626' : '#1e293b'}; font-weight: bold;">
                    ${frappe.format(d.value, {fieldtype: 'Currency'})}
                </td>
            </tr>
        `;
    });

    const currentDate = frappe.datetime.get_today();
    const dir = document.documentElement.dir || 'rtl';
    return `
    <!DOCTYPE html>
    <html dir="${dir}">
    <head>
        <meta charset="UTF-8">
        <title>${__("Accountant Quick Financial Summary")}</title>
        <style>
            @page { size: A4 portrait; margin: 0.5cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; direction: ${dir}; font-size: 11px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .header-table td { border: none; text-align: center; }
            .header-table h3 { margin: 5px 0; font-size: 16px; }
            .header-table h4 { margin: 5px 0; font-size: 14px; color: #555; }
            .info-table, .data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .info-table td, .info-table th { border: 1px solid #ddd; padding: 6px; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
            .data-table td, .data-table th { border: 1px solid #ccc; padding: 6px; text-align: center; }
            .data-table th { background-color: #f5f5f5; font-weight: bold; }
            .section-title { font-size: 12px; font-weight: bold; color: #2c3e50; margin: 15px 0 8px 0; padding-bottom: 3px; border-bottom: 2px solid #34495e; }
            .en-number { font-family: Arial, sans-serif !important; }
            .text-green { color: #16a34a !important; }
            .text-red { color: #dc2626 !important; }
            .kpi-summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            .kpi-summary-table td { border: 1px solid #ccc; padding: 8px; text-align: center; width: 25%; }
            .kpi-summary-table .kpi-title { font-size: 10px; color: #555; text-transform: uppercase; margin-bottom: 4px; }
            .kpi-summary-table .kpi-value { font-size: 14px; font-weight: bold; font-family: Arial, sans-serif !important; }
        </style>
    </head>
    <body>
        <div class="header-table">
            <table style="width: 100%; border: none;">
                <tr>
                    <td style="text-align: center;">
                        <h3>${filters.company || ""}</h3>
                        <h4>${__("Accountant Quick Financial Summary")}</h4>
                    </td>
                </tr>
            </table>
        </div>
        <table class="info-table">
            <tr>
                <td style="font-weight: bold; width: 15%;">${__("Period")}:</td>
                <td class="en-number" style="text-align: ${dir === 'rtl' ? 'right' : 'left'};">${filters.from_date || ""} ${__("to")} ${filters.to_date || ""}</td>
                <td style="font-weight: bold; width: 15%;">${__("Print Date")}:</td>
                <td class="en-number" style="text-align: ${dir === 'rtl' ? 'right' : 'left'};">${currentDate}</td>
            </tr>
        </table>
        
        <table class="kpi-summary-table">
            <tr>
                <td>
                    <div class="kpi-title">${__("Total Liquidity")}</div>
                    <div class="kpi-value text-green">${frappe.format(total_liquidity, {fieldtype: 'Currency'})}</div>
                </td>
                <td>
                    <div class="kpi-title">${__("Total Receivables")}</div>
                    <div class="kpi-value" style="color: #2980b9;">${frappe.format(total_receivables, {fieldtype: 'Currency'})}</div>
                </td>
                <td>
                    <div class="kpi-title">${__("Total Payables")}</div>
                    <div class="kpi-value" style="color: #c0392b;">${frappe.format(total_payables, {fieldtype: 'Currency'})}</div>
                </td>
                <td>
                    <div class="kpi-title">${__("Net Profit")}</div>
                    <div class="kpi-value" style="color: ${net_profit < 0 ? '#dc2626' : '#16a34a'};">${frappe.format(net_profit, {fieldtype: 'Currency'})}</div>
                </td>
            </tr>
        </table>

        <div class="section-title">${__("Cash & Bank Balances")}</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>${__("Account")}</th>
                    <th>${__("Type")}</th>
                    <th style="${dir === 'rtl' ? 'text-align: left;' : 'text-align: right;'}">${__("Balance")}</th>
                </tr>
            </thead>
            <tbody>
                ${accounts_rows}
            </tbody>
        </table>

        <div class="section-title">${__("Tax & Aging Analysis")}</div>
        <table style="width: 100%; border: none;">
            <tr style="vertical-align: top;">
                <td style="width: 48%; ${dir === 'rtl' ? 'padding-left: 10px;' : 'padding-right: 10px;'}">
                    <div style="font-weight: bold; margin-bottom: 5px;">${__("VAT Report")}</div>
                    <table class="info-table" style="width: 100%;">
                        <tr>
                            <td>${__("VAT Collected")}</td>
                            <td class="en-number text-green">+${frappe.format(vat_collected, {fieldtype: 'Currency'})}</td>
                        </tr>
                        <tr>
                            <td>${__("VAT Paid")}</td>
                            <td class="en-number text-red">-${frappe.format(vat_paid, {fieldtype: 'Currency'})}</td>
                        </tr>
                        <tr style="font-weight: bold; background-color: #f5f5f5;">
                            <td>${__("Net VAT Liability")}</td>
                            <td class="en-number ${net_vat_liability < 0 ? 'text-green' : 'text-red'}">
                                ${frappe.format(net_vat_liability, {fieldtype: 'Currency'})}
                            </td>
                        </tr>
                    </table>
                </td>
                <td style="width: 4%;">&nbsp;</td>
                <td style="width: 48%;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${__("AR & AP Aging")}</div>
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>${__("Age")}</th>
                                <th>${__("AR")}</th>
                                <th>${__("AP")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${__("0-30 Days")}</td>
                                <td class="en-number">${frappe.format(ar_aging_30, {fieldtype: 'Currency'})}</td>
                                <td class="en-number">${frappe.format(ap_aging_30, {fieldtype: 'Currency'})}</td>
                            </tr>
                            <tr>
                                <td>${__("30-60 Days")}</td>
                                <td class="en-number">${frappe.format(ar_aging_60, {fieldtype: 'Currency'})}</td>
                                <td class="en-number">${frappe.format(ap_aging_60, {fieldtype: 'Currency'})}</td>
                            </tr>
                            <tr style="font-weight: bold;">
                                <td>${__("60+ Days")}</td>
                                <td class="en-number text-red">${frappe.format(ar_aging_90, {fieldtype: 'Currency'})}</td>
                                <td class="en-number text-red">${frappe.format(ap_aging_90, {fieldtype: 'Currency'})}</td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}
