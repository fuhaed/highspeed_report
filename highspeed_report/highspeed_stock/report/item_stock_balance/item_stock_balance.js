// Copyright (c) 2023, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Item Stock Balance"] = {
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
			"fieldname": "date",
			"label": __("As on Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},
		{
			"fieldname": "warehouse",
			"label": __("Warehouse"),
			"fieldtype": "Link",
			"options": "Warehouse",
			"reqd": 1,
			"get_query": function() {
				return {
					filters: {
						"company": frappe.query_report.get_filter_value('company')
					}
				}
			}
		},
		{
			"fieldname": "item_code",
			"label": __("Item"),
			"fieldtype": "Link",
			"options": "Item",
			"get_query": function() {
				return {
					query: "erpnext.controllers.queries.item_query"
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
			"fieldname": "brand",
			"label": __("Brand"),
			"fieldtype": "Link",
			"options": "Brand"
		},
		{
			"fieldname": "price_list",
			"label": __("Selling Price List"),
			"fieldtype": "Link",
			"options": "Price List",
			"default": frappe.defaults.get_user_default("selling_price_list"),
			"get_query": function() {
				return {
					filters: {
						"selling": 1
					}
				}
			}
		},
		{
			"fieldname": "purchase_price_list",
			"label": __("Purchase Price List"),
			"fieldtype": "Link",
			"options": "Price List",
			"get_query": function() {
				return {
					filters: {
						"buying": 1
					}
				}
			}
		},
		{
			"fieldname": "include_zero_qty",
			"label": __("Include Zero Quantity Items"),
			"fieldtype": "Check",
			"default": 0
		}
	],
	
	"formatter": function(value, row, column, data, default_formatter) {
		// Use default formatter first
		value = default_formatter(value, row, column, data);
		
		// Apply special formatting for totals row
		if (data && data[1] === "Total") {
			var qty = data[4];  // Total quantity
			var total_value = data[8];  // Total value (last column)
			
			// Highlight negative total quantities
			if (column.fieldname === "qty" || column.label === "Qty") {
				if (qty < 0) {
					return "<b style='color: red;'>" + value + "</b>";
				}
			}
			
			// Highlight negative total values
			if (column.fieldname === "total_value" || column.label === "Total Value") {
				if (total_value < 0) {
					return "<b style='color: red;'>" + value + "</b>";
				}
			}
			
			return "<b>" + value + "</b>";
		}
		
		// Add highlighting for zero and negative quantities
		if (column.fieldname === "qty" || column.label === "Qty") {
			var qty = data[4];  // Quantity in column 4
			if (qty === 0) {
				return "<span style='color: orange;'>" + value + "</span>";
			} else if (qty < 0) {
				return "<span style='color: red;'>" + value + "</span>";
			}
		}
		
		// Add highlighting for zero and negative values
		if (column.fieldname === "total_value" || column.label === "Total Value") {
			var total_value = data[8];  // Total value in last column
			if (total_value === 0) {
				return "<span style='color: orange;'>" + value + "</span>";
			} else if (total_value < 0) {
				return "<span style='color: red; font-weight: 600;'>" + value + "</span>";
			}
		}
		
		// Keep prices without special colors
		if (column.fieldname === "valuation_rate" || column.label === "Valuation Rate") {
			return value;
		}
		
		if (column.fieldname === "selling_price" || column.label === "Selling Price") {
			return value;
		}
		
		if (column.fieldname === "last_purchase_price" || column.label === "Last Purchase Price") {
			return value;
		}
		
		return value;
	},

	"onload": function(report) {
		// Add custom buttons
		report.page.add_inner_button(__("Stock Ledger"), function() {
			frappe.route_options = {
				"warehouse": frappe.query_report.get_filter_value("warehouse"),
				"from_date": frappe.datetime.add_days(frappe.query_report.get_filter_value("date"), -30),
				"to_date": frappe.query_report.get_filter_value("date")
			};
			frappe.set_route("query-report", "Stock Ledger");
		});

		report.page.add_inner_button(__("Stock Reconciliation"), function() {
			frappe.new_doc("Stock Reconciliation", {
				"purpose": "Stock Reconciliation",
				"warehouse": frappe.query_report.get_filter_value("warehouse"),
				"posting_date": frappe.query_report.get_filter_value("date")
			});
		});

		report.page.add_inner_button(__("Print Report"), function() {
			print_report(report);
		});

		report.page.add_inner_button(__("Export to Excel"), function() {
			export_report(report);
		});

		// Update report view
		setTimeout(function() {
			// Hide chart wrapper if exists
			if (document.querySelector('.chart-wrapper')) {
				document.querySelector('.chart-wrapper').style.display = 'none';
			}
			
			// Expand data table width
			if (document.querySelector('.datatable')) {
				document.querySelector('.datatable').style.width = '100%';
			}
			
			// Adjust column widths in table
			adjust_column_widths(report);
			
			// Add special formatting for totals row
			add_total_row_format();
			
			// Add additional information
			add_report_info(report);
		}, 1000);
	}
};

// Function to add additional report info
function add_report_info(report) {
	// Add simple hints for the user
	var info_html = `
		<div class="report-info" style="margin: 10px 0; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px;">
			<p style="margin: 0; font-size: 12px; color: #666;">
				<i class="fa fa-info-circle"></i> 
				${__("This report shows actual stock balance from Stock Ledger Entry with valuation rate, selling price and last purchase price")}
			</p>
		</div>
	`;
	
	// Add info before the table
	if (document.querySelector('.report-wrapper') && !document.querySelector('.report-info')) {
		var report_wrapper = document.querySelector('.report-wrapper');
		report_wrapper.insertAdjacentHTML('afterbegin', info_html);
	}
}

// Function to add special formatting for totals row
function add_total_row_format() {
	let style_id = 'total-row-custom-styles';
	if (!document.getElementById(style_id)) {
		let style = document.createElement('style');
		style.id = style_id;
		style.innerHTML = `
			.dt-scrollable .dt-row:last-child {
				background-color: #f5f7fa !important;
				border-top: 2px solid #d1d8dd !important;
			}
			.dt-scrollable .dt-row:last-child .dt-cell {
				font-weight: bold !important;
			}
			.negative-total {
				color: red !important;
				font-weight: bold !important;
			}
			.zero-qty {
				color: orange !important;
			}
			.negative-qty {
				color: red !important;
			}
			.report-info {
				animation: fadeIn 0.5s ease-in;
			}
			@keyframes fadeIn {
				from { opacity: 0; }
				to { opacity: 1; }
			}
		`;
		document.head.appendChild(style);
	}
}

// Function to adjust column widths in table
function adjust_column_widths(report) {
	// Ensure report is ready
	if (!report.datatable) return;
	
	// Set larger column widths (9 columns now, not 10)
	let column_widths = [
		120,  // Item code
		250,  // Item name
		120,  // Warehouse
		80,   // UOM
		100,  // Quantity
		110,  // Valuation rate
		110,  // Selling price
		130,  // Last purchase price
		120   // Total value
	];
	
	// Apply new widths to columns
	column_widths.forEach((width, index) => {
		if (report.datatable.columnmanager) {
			report.datatable.columnmanager.setColumnWidth(index, width);
		}
	});
	
	// Refresh the table
	if (report.datatable.refresh) {
		report.datatable.refresh();
	}
	
	// Update CSS styles for table
	add_custom_table_styles();
}

// Add custom CSS styles for table
function add_custom_table_styles() {
	// Create style element if it doesn't exist
	let style_id = 'item-stock-balance-custom-styles';
	if (!document.getElementById(style_id)) {
		let style = document.createElement('style');
		style.id = style_id;
		style.innerHTML = `
			.dt-scrollable {
				max-width: 100% !important;
				width: 100% !important;
			}
			.dt-cell {
				padding: 0px 10px !important;
				font-size: 14px !important;
			}
			.dt-cell--header {
				font-weight: bold !important;
				background-color: #f5f7fa !important;
				color: #333 !important;
			}
			.dt-row {
				border-bottom: 1px solid #e0e0e0 !important;
			}
			.dt-row:hover {
				background-color: #f9f9f9 !important;
			}
			.dt-row--total {
				font-weight: bold !important;
				background-color: #f5f7fa !important;
			}
			.negative-qty {
				color: red !important;
			}
			.zero-qty {
				color: orange !important;
			}
		`;
		document.head.appendChild(style);
	}
}

// Function to print report
function print_report(report) {
	var filters = report.get_values();
	
	if (filters) {
		// Get report data for printing directly without letterhead
		frappe.call({
			method: "erpnext.stock.report.item_stock_balance.item_stock_balance.get_print_data",
			args: {
				filters: filters
			},
			callback: function(r) {
				if (r.message) {
					open_print_view(r.message, filters);
				}
			}
		});
	}
}

// Open print window
function open_print_view(data, filters) {
	// Create print template without letterhead
	var print_template = `
		<div style="font-family: Arial, sans-serif;">
			<div style="text-align: center; margin-bottom: 20px;">
				<h2 style="margin: 0; font-size: 24px;">${__("Item Stock Balance Report")}</h2>
				<div style="font-size: 14px; margin-top: 10px;">
					<div style="margin: 5px;">${__("Company")}: <strong>${data.company}</strong></div>
					<div style="margin: 5px;">${__("Warehouse")}: <strong>${data.warehouse}</strong></div>
					<div style="margin: 5px;">${__("As on Date")}: <strong>${data.report_date}</strong></div>
				</div>
			</div>
			
			${get_report_summary_html(data.report_summary)}
			
			<table class="table table-bordered" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
				<thead>
					<tr style="background-color: #f5f7fa;">
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Item Code")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Item Name")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Warehouse")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("UOM")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Qty")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Valuation Rate")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Selling Price")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Last Purchase")}</th>
						<th style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${__("Total Value")}</th>
					</tr>
				</thead>
				<tbody>
					${get_data_rows(data.data)}
				</tbody>
			</table>
			
			<div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; font-size: 12px;">
				<div>${__("Printed On")}: ${frappe.datetime.now_datetime()}</div>
				<div>${__("Printed By")}: ${frappe.session.user}</div>
			</div>
		</div>
	`;
	
	// Create print window directly without using frappe.ui.form.qz_print
	var w = window.open('', '_blank');
	if (!w) {
		frappe.msgprint(__("Please enable pop-ups for this site"));
		return;
	}
	
	w.document.write(`
		<!DOCTYPE html>
		<html>
			<head>
				<title>${__("Item Stock Balance Report")}</title>
				<meta charset="utf-8">
				<style>
					@media print {
						.print-format {
							padding: 0.5in;
							font-size: 9pt;
						}
						.print-format td, .print-format th {
							padding: 5px !important;
							font-size: 9pt !important;
						}
						.no-print {
							display: none;
						}
						@page {
							size: landscape;
							margin: 0.5in;
						}
					}
					body {
						font-family: Arial, sans-serif;
						margin: 0;
						padding: 20px;
					}
					.zero-qty {
						color: orange;
					}
					.negative-qty {
						color: red;
					}
					.negative-total {
						color: red;
						font-weight: bold;
					}
					.summary-box {
						display: inline-block;
						margin: 5px;
						padding: 10px;
						border: 1px solid #ddd;
						border-radius: 4px;
						background: #f9f9f9;
						min-width: 120px;
						text-align: center;
					}
					.summary-label {
						font-size: 11px;
						color: #666;
					}
					.summary-value {
						font-size: 16px;
						font-weight: bold;
						margin-top: 5px;
					}
					table {
						page-break-inside: auto;
					}
					tr {
						page-break-inside: avoid;
						page-break-after: auto;
					}
				</style>
			</head>
			<body>
				<div class="print-format">
					${print_template}
				</div>
				<div class="no-print" style="text-align: center; margin: 20px;">
					<button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
						${__("Print")}
					</button>
					<button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 10px;">
						${__("Close")}
					</button>
				</div>
			</body>
		</html>
	`);
	w.document.close();
}

// Create HTML for report summary
function get_report_summary_html(report_summary) {
	if (!report_summary || report_summary.length === 0) return '';
	
	var html = '<div style="text-align: center; margin-bottom: 30px;">';
	
	report_summary.forEach(function(summary) {
		var color = '#333';
		if (summary.indicator === 'Red') color = '#dc2626';
		else if (summary.indicator === 'Green') color = '#16a34a';
		else if (summary.indicator === 'Orange') color = '#f59e0b';
		else if (summary.indicator === 'Blue') color = '#2563eb';
		
		html += `
			<div class="summary-box">
				<div class="summary-label">${summary.label}</div>
				<div class="summary-value" style="color: ${color};">${format_value(summary.value, summary.datatype, summary.precision)}</div>
			</div>
		`;
	});
	
	html += '</div>';
	return html;
}

// Format values according to data type - FIXED FOR NEGATIVE NUMBERS
function format_value(value, datatype, precision) {
	// Handle null or undefined values
	if (value === null || value === undefined) {
		return "0";
	}
	
	// Convert to number and check if valid
	var numValue = parseFloat(value);
	if (isNaN(numValue)) {
		return value; // Return original if not a number
	}
	
	if (datatype === 'Currency') {
		return format_currency(numValue);
	} else if (datatype === 'Float') {
		return format_number(numValue, precision);
	} else if (datatype === 'Int') {
		return Math.round(numValue).toLocaleString();
	}
	return value;
}

// Create data rows for print window
function get_data_rows(data) {
	var rows_html = '';
	
	// Add data rows
	if (data && data.length) {
		data.forEach(function(row, index) {
			var is_total_row = (row[1] === 'Total');
			var row_style = is_total_row ? 'font-weight: bold; background-color: #f5f7fa;' : '';
			
			if (index % 2 === 0 && !is_total_row) {
				row_style = 'background-color: #f9f9f9;';
			}
			
			// Determine colors for zero and negative quantities
			var qty = parseFloat(row[4]) || 0;
			var total_value = parseFloat(row[8]) || 0;
			var qty_class = '';
			var total_value_class = '';
			
			if (is_total_row) {
				// Special formatting for totals row
				if (qty < 0) {
					qty_class = 'class="negative-total"';
				}
				
				if (total_value < 0) {
					total_value_class = 'class="negative-total"';
				}
			} else {
				// Formatting for regular rows
				if (qty === 0) {
					qty_class = 'class="zero-qty"';
				} else if (qty < 0) {
					qty_class = 'class="negative-qty"';
				}
				
				if (total_value === 0) {
					total_value_class = 'class="zero-qty"';
				} else if (total_value < 0) {
					total_value_class = 'class="negative-qty"';
				}
			}
			
			rows_html += `
				<tr style="${row_style}">
					<td style="padding: 8px; border: 1px solid #ddd;">${row[0] || ''}</td>
					<td style="padding: 8px; border: 1px solid #ddd;">${row[1] || ''}</td>
					<td style="padding: 8px; border: 1px solid #ddd;">${row[2] || ''}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${row[3] || ''}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: right;" ${qty_class}>${format_number(row[4], 3)}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${format_currency(row[5])}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${format_currency(row[6])}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${format_currency(row[7])}</td>
					<td style="padding: 8px; border: 1px solid #ddd; text-align: right;" ${total_value_class}>${format_currency(row[8])}</td>
				</tr>
			`;
		});
	}
	
	return rows_html;
}

// Export report to Excel file
function export_report(report) {
	var filters = report.get_values();
	
	if (filters) {
		frappe.msgprint(__("Generating Excel file, please wait..."));
		
		frappe.call({
			method: "erpnext.stock.report.item_stock_balance.item_stock_balance.download_xlsx",
			args: {
				filters: filters
			},
			callback: function(r) {
				// File will be downloaded automatically
				frappe.msgprint(__("Excel file generated successfully!"));
			}
		});
	}
}

// Format numbers - FIXED FOR NEGATIVE NUMBERS
function format_number(value, precision) {
	// Handle null, undefined, or empty values
	if (value === null || value === undefined || value === '') {
		return "0.00";
	}
	
	// Convert to number
	var numValue = parseFloat(value);
	
	// Check if it's a valid number
	if (isNaN(numValue)) {
		return "0.00";
	}
	
	// Determine decimal places
	var minDecimals = 2;
	var maxDecimals = precision || 3;
	
	// Format the number
	try {
		return numValue.toLocaleString(undefined, {
			minimumFractionDigits: minDecimals,
			maximumFractionDigits: maxDecimals
		});
	} catch (e) {
		// Fallback formatting
		return numValue.toFixed(minDecimals);
	}
}

// Format currency - FIXED FOR NEGATIVE NUMBERS
function format_currency(value) {
	// Handle null, undefined, or empty values
	if (value === null || value === undefined || value === '') {
		return "SAR 0.00";
	}
	
	// Convert to number
	var numValue = parseFloat(value);
	
	// Check if it's a valid number
	if (isNaN(numValue)) {
		return "SAR 0.00";
	}
	
	// Get currency symbol
	var currency_symbol = frappe.defaults.get_default('currency_symbol') || frappe.defaults.get_default('currency') || "SAR";
	
	// Format the number
	try {
		var formatted_value = numValue.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		
		return currency_symbol + " " + formatted_value;
	} catch (e) {
		// Fallback formatting
		return currency_symbol + " " + numValue.toFixed(2);
	}
}