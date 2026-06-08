frappe.query_reports["POSAwesome Opening Closing Report"] = {
    filters: [
        {
            fieldname: "company",
            label: __("Company"),
            fieldtype: "Link",
            options: "Company",
            default: frappe.defaults.get_user_default("company"),
            reqd: 1
        },
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_start(),
            reqd: 1
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_end(),
            reqd: 1
        },
        {
            fieldname: "pos_profile",
            label: __("POS Profile"),
            fieldtype: "Link",
            options: "POS Profile",
            get_query: function() {
                return {
                    filters: {
                        company: frappe.query_report.get_filter_value("company")
                    }
                };
            }
        },
        {
            fieldname: "user",
            label: __("Cashier"),
            fieldtype: "Link",
            options: "User"
        },
        {
            fieldname: "show_payment_details",
            label: __("Show Payment Details"),
            fieldtype: "Check"
        }
    ],

    formatter: function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);

        if (data && data.is_total_row) {
            value = `<b>${value}</b>`;
        }

        if (column.fieldname === "difference") {
            const diff = parseFloat(data.difference) || 0;
            if (diff < 0) {
                value = `<span style="color: #e74c3c; font-weight: bold;">${value}</span>`;
            } else if (diff > 0) {
                value = `<span style="color: #27ae60; font-weight: bold;">${value}</span>`;
            }
        }

        if (column.fieldname === "difference_percentage") {
            const percent = parseFloat(data.difference_percentage) || 0;
            if (percent < -5) {
                value = `<span style="color: #e74c3c; font-weight: bold;">${value}</span>`;
            } else if (percent > 5) {
                value = `<span style="color: #e67e22; font-weight: bold;">${value}</span>`;
            }
        }

        if (column.fieldname === "status") {
            if (data.status === "Submitted" || data.status === __("Submitted")) {
                value = `<span class="indicator-pill green">${value}</span>`;
            } else {
                value = `<span class="indicator-pill orange">${value}</span>`;
            }
        }

        return value;
    },

    onload: function(report) {
        report.page.add_inner_button(__("Print"), function() {
            print_custom_report(report);
        }, null, "btn-primary");
    }
};

function print_custom_report(report) {
    const data = frappe.query_report.data || [];
    const columns = frappe.query_report.columns || [];
    const filters = report.get_values();
    const company = filters.company || frappe.defaults.get_user_default("company");
    const from_date = filters.from_date;
    const to_date = filters.to_date;
    const show_details = filters.show_payment_details;

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${__("POS Opening Closing Report")}</title>
            <style>
                @page {
                    size: A4 landscape;
                    margin: 10mm;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #2c3e50;
                    background: #fff;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #3498db;
                    padding-bottom: 20px;
                }
                
                .header h1 {
                    margin: 0;
                    color: #2c3e50;
                    font-size: 28px;
                    font-weight: 600;
                }
                
                .header h2 {
                    margin: 10px 0 0 0;
                    color: #3498db;
                    font-size: 20px;
                    font-weight: 400;
                }
                
                .info-section {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    padding: 15px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .info-item {
                    display: flex;
                    align-items: center;
                }
                
                .info-label {
                    font-weight: 600;
                    color: #7f8c8d;
                    margin-right: 10px;
                }
                
                .info-value {
                    color: #2c3e50;
                    font-weight: 500;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                thead {
                    background: linear-gradient(135deg, #3498db, #2980b9);
                    color: white;
                }
                
                th {
                    padding: 12px 8px;
                    text-align: center;
                    font-weight: 600;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                    border-right: 1px solid rgba(255,255,255,0.2);
                }
                
                th:last-child {
                    border-right: none;
                }
                
                td {
                    padding: 10px 8px;
                    text-align: center;
                    font-size: 11px;
                    border-bottom: 1px solid #ecf0f1;
                }
                
                tbody tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                
                tbody tr:hover {
                    background-color: #e8f4f8;
                    transition: background-color 0.2s;
                }
                
                .total-row {
                    background: linear-gradient(135deg, #34495e, #2c3e50) !important;
                    color: white;
                    font-weight: 700;
                    font-size: 13px;
                }
                
                .total-row td {
                    border-bottom: none;
                    padding: 15px 8px;
                }
                
                .negative {
                    color: #e74c3c;
                    font-weight: 600;
                }
                
                .positive {
                    color: #27ae60;
                    font-weight: 600;
                }
                
                .status-submitted {
                    background: #27ae60;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    display: inline-block;
                }
                
                .status-draft {
                    background: #f39c12;
                    color: white;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 500;
                    display: inline-block;
                }
                
                .summary {
                    margin-top: 30px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                
                .summary-card {
                    background: #fff;
                    border: 2px solid #ecf0f1;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    transition: all 0.3s;
                }
                
                .summary-card:hover {
                    border-color: #3498db;
                    box-shadow: 0 4px 8px rgba(52, 152, 219, 0.1);
                }
                
                .summary-label {
                    color: #7f8c8d;
                    font-size: 12px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }
                
                .summary-value {
                    color: #2c3e50;
                    font-size: 20px;
                    font-weight: 700;
                }
                
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #7f8c8d;
                    font-size: 11px;
                    border-top: 1px solid #ecf0f1;
                    padding-top: 20px;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .no-print {
                        display: none;
                    }
                    
                    table {
                        box-shadow: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${company}</h1>
                <h2>${__("POS Opening Closing Report")}</h2>
            </div>
            
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">${__("Period")}:</span>
                    <span class="info-value">${frappe.datetime.str_to_user(from_date)} - ${frappe.datetime.str_to_user(to_date)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${__("Print Date")}:</span>
                    <span class="info-value">${frappe.datetime.now_datetime()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">${__("Printed By")}:</span>
                    <span class="info-value">${frappe.session.user_fullname}</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>`;

    columns.forEach(col => {
        if (!show_details && col.fieldname === "mode_of_payment") return;
        html += `<th>${col.label}</th>`;
    });

    html += `</tr></thead><tbody>`;

    data.forEach(row => {
        const is_total = row.is_total_row;
        html += `<tr${is_total ? ' class="total-row"' : ''}>`;
        
        columns.forEach(col => {
            if (!show_details && col.fieldname === "mode_of_payment") return;
            
            let val = row[col.fieldname];
            let formatted_val = val || "";
            
            if (col.fieldtype === "Currency" && val !== null && val !== undefined) {
                formatted_val = format_currency(val, row.currency);
            } else if (col.fieldtype === "Percent" && val !== null && val !== undefined) {
                formatted_val = val.toFixed(2) + "%";
            } else if (col.fieldtype === "Datetime" && val) {
                formatted_val = frappe.datetime.str_to_user(val);
            }
            
            if (col.fieldname === "difference" && val) {
                const diff = parseFloat(val);
                if (diff < 0) {
                    formatted_val = `<span class="negative">${formatted_val}</span>`;
                } else if (diff > 0) {
                    formatted_val = `<span class="positive">${formatted_val}</span>`;
                }
            }
            
            if (col.fieldname === "status" && val) {
                if (val === "Submitted" || val === __("Submitted")) {
                    formatted_val = `<span class="status-submitted">${val}</span>`;
                } else {
                    formatted_val = `<span class="status-draft">${val}</span>`;
                }
            }
            
            html += `<td>${formatted_val}</td>`;
        });
        
        html += `</tr>`;
    });

    html += `</tbody></table>`;

    // Always show summary totals
    let total_row = data.find(r => r.is_total_row);
    
    // If no total row exists, calculate it
    if (!total_row && data.length > 0) {
        total_row = {
            opening_amount: 0,
            sales_amount: 0,
            expected_amount: 0,
            closing_amount: 0,
            difference: 0,
            currency: data[0].currency || "SAR"
        };
        
        data.forEach(row => {
            if (!row.is_total_row) {
                total_row.opening_amount += parseFloat(row.opening_amount) || 0;
                total_row.sales_amount += parseFloat(row.sales_amount) || 0;
                total_row.expected_amount += parseFloat(row.expected_amount) || 0;
                total_row.closing_amount += parseFloat(row.closing_amount) || 0;
                total_row.difference += parseFloat(row.difference) || 0;
            }
        });
    }
    
    if (total_row) {
        html += `
            <div class="summary">
                <div class="summary-card">
                    <div class="summary-label">${__("Total Opening")}</div>
                    <div class="summary-value">${format_currency(total_row.opening_amount, total_row.currency)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Sales")}</div>
                    <div class="summary-value">${format_currency(total_row.sales_amount, total_row.currency)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Expected")}</div>
                    <div class="summary-value">${format_currency(total_row.expected_amount, total_row.currency)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Closing")}</div>
                    <div class="summary-value">${format_currency(total_row.closing_amount, total_row.currency)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">${__("Total Difference")}</div>
                    <div class="summary-value ${total_row.difference < 0 ? 'negative' : 'positive'}">${format_currency(total_row.difference, total_row.currency)}</div>
                </div>
            </div>`;
    }

    html += `
            <div class="footer">
                <p>${company} - ${__("HIGH SPEED IT REPORT")}</p>
            </div>
        </body>
        </html>`;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

function format_currency(value, currency) {
    if (!value && value !== 0) return "";
    
    const number = parseFloat(value);
    if (isNaN(number)) return value;
    
    // Format with commas and 2 decimal places
    const formatted = number.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    return formatted;
}