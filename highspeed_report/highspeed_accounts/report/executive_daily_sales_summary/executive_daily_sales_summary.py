# Copyright (c) 2026, Highspeed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, add_days, getdate

def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_data(filters)
    summary = get_report_summary(data)

    return columns, data, None, None, summary

def get_columns():
    return [
        {
            "label": _("Particulars"),
            "fieldname": "metric",
            "fieldtype": "Data",
            "width": 260
        },
        {
            "label": _("Today's Value"),
            "fieldname": "today_val",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": _("Yesterday's Value"),
            "fieldname": "yesterday_val",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": _("Change"),
            "fieldname": "change_val",
            "fieldtype": "Data",
            "width": 130
        },
        {
            "label": _("Change %"),
            "fieldname": "change_percent",
            "fieldtype": "Data",
            "width": 110
        }
    ]

def get_data(filters):
    company = filters.get("company")
    target_date = getdate(filters.get("posting_date") or frappe.utils.today())
    yesterday_date = add_days(target_date, -1)

    # 1. Helper function to query sales summary for a date
    def query_sales_summary(date_str):
        conditions = ["si.docstatus = 1", "si.posting_date = %(date)s"]
        values = {"date": date_str}
        if company:
            conditions.append("si.company = %(company)s")
            values["company"] = company
            
        # Sales query
        sales_data = frappe.db.sql(f"""
            SELECT 
                COALESCE(SUM(base_grand_total), 0) as total_sales,
                COUNT(name) as invoice_count
            FROM `tabSales Invoice` si
            WHERE {" AND ".join(conditions)} AND is_return = 0
        """, values, as_dict=True)[0]

        # Returns query
        returns_data = frappe.db.sql(f"""
            SELECT 
                ABS(COALESCE(SUM(base_grand_total), 0)) as total_returns
            FROM `tabSales Invoice` si
            WHERE {" AND ".join(conditions)} AND is_return = 1
        """, values, as_dict=True)[0]

        sales = flt(sales_data.total_sales)
        count = flt(sales_data.invoice_count)
        returns = flt(returns_data.total_returns)
        basket = (sales / count) if count else 0.0
        net = sales - returns

        return {
            "sales": sales,
            "count": count,
            "basket": basket,
            "returns": returns,
            "net_sales": net
        }

    t_data = query_sales_summary(target_date)
    y_data = query_sales_summary(yesterday_date)

    # Calculate metrics row helper
    def get_row(metric_name, t_val, y_val, is_currency=True):
        change = t_val - y_val
        change_pct = (change / y_val * 100) if y_val else (100.0 if t_val else 0.0)
        
        currency_sym = frappe.get_cached_value("Company", company, "default_currency") if company else "SAR"
        
        def format_val(val):
            if is_currency:
                return frappe.utils.fmt_money(val, currency=currency_sym)
            return str(int(val)) if val.is_integer() else f"{val:.2f}"

        return {
            "metric": metric_name,
            "today_val": format_val(t_val),
            "yesterday_val": format_val(y_val),
            "change_val": format_val(change),
            "change_percent": f"{change_pct:+.1f}%" if change_pct else "0.0%",
            "raw_change_pct": change_pct
        }

    data = []

    # Section 1 Header
    data.append({
        "metric": "--- Executive Summary ---",
        "today_val": "",
        "yesterday_val": "",
        "change_val": "",
        "change_percent": ""
    })

    data.append(get_row(_("Total Sales"), t_data["sales"], y_data["sales"]))
    data.append(get_row(_("Total Invoices"), t_data["count"], y_data["count"], is_currency=False))
    data.append(get_row(_("Average Basket Value"), t_data["basket"], y_data["basket"]))
    data.append(get_row(_("Total Returns"), t_data["returns"], y_data["returns"]))
    data.append(get_row(_("Net Sales"), t_data["net_sales"], y_data["net_sales"]))

    # Section 2 Header: Top 5 Selling Items
    data.append({
        "metric": "--- Top 5 Selling Items (Today) ---",
        "today_val": "",
        "yesterday_val": "",
        "change_val": "",
        "change_percent": ""
    })

    # Query top items
    top_items_conditions = ["si.docstatus = 1", "si.posting_date = %(date)s", "si.is_return = 0"]
    top_items_values = {"date": target_date}
    if company:
        top_items_conditions.append("si.company = %(company)s")
        top_items_values["company"] = company

    top_items = frappe.db.sql(f"""
        SELECT 
            sii.item_code,
            sii.item_name,
            SUM(sii.qty) as qty,
            SUM(sii.base_net_amount) as amount
        FROM 
            `tabSales Invoice Item` sii
        INNER JOIN 
            `tabSales Invoice` si ON sii.parent = si.name
        WHERE 
            {" AND ".join(top_items_conditions)}
        GROUP BY 
            sii.item_code, sii.item_name
        ORDER BY 
            qty DESC
        LIMIT 5
    """, top_items_values, as_dict=True)

    currency_sym = frappe.get_cached_value("Company", company, "default_currency") if company else "SAR"

    for idx, item in enumerate(top_items):
        item_label = f"#{idx+1} - {item.item_code} ({item.item_name})"
        qty_formatted = f"{flt(item.qty):.2f}"
        amt_formatted = frappe.utils.fmt_money(item.amount, currency=currency_sym)
        
        data.append({
            "metric": item_label,
            "today_val": qty_formatted,
            "yesterday_val": amt_formatted,
            "change_val": _("Qty Sold"),
            "change_percent": _("Sales Amount")
        })

    return data

def get_report_summary(data):
    # Retrieve Net Sales row
    net_sales_row = next((r for r in data if r["metric"] == _("Net Sales")), None)
    total_invoices_row = next((r for r in data if r["metric"] == _("Total Invoices")), None)
    basket_row = next((r for r in data if r["metric"] == _("Average Basket Value")), None)
    
    summary = []
    if net_sales_row:
        summary.append({
            "value": net_sales_row["today_val"],
            "label": _("Net Sales (Today)"),
            "indicator": "green",
            "datatype": "Data"
        })
    if total_invoices_row:
        summary.append({
            "value": total_invoices_row["today_val"],
            "label": _("Total Invoices (Today)"),
            "indicator": "blue",
            "datatype": "Data"
        })
    if basket_row:
        summary.append({
            "value": basket_row["today_val"],
            "label": _("Average Basket (Today)"),
            "indicator": "orange",
            "datatype": "Data"
        })
        
    return summary
