# Copyright (c) 2026, Highspeed and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt

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
            "label": _("Item Code"),
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 140
        },
        {
            "label": _("Item Name"),
            "fieldname": "item_name",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": _("Item Group"),
            "fieldname": "item_group",
            "fieldtype": "Link",
            "options": "Item Group",
            "width": 130
        },
        {
            "label": _("UOM"),
            "fieldname": "uom",
            "fieldtype": "Link",
            "options": "UOM",
            "width": 90
        },
        {
            "label": _("Sold Quantity"),
            "fieldname": "qty",
            "fieldtype": "Float",
            "width": 110
        },
        {
            "label": _("Sales Amount"),
            "fieldname": "sales_amount",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Cost Amount"),
            "fieldname": "cost_amount",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Gross Profit"),
            "fieldname": "gross_profit",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Profit Margin %"),
            "fieldname": "margin_percentage",
            "fieldtype": "Percent",
            "width": 110
        }
    ]

def get_data(filters):
    conditions = []
    values = {
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }

    if filters.get("company"):
        conditions.append("si.company = %(company)s")
        values["company"] = filters.get("company")
    if filters.get("item_group"):
        conditions.append("sii.item_group = %(item_group)s")
        values["item_group"] = filters.get("item_group")
    if filters.get("warehouse"):
        conditions.append("sii.warehouse = %(warehouse)s")
        values["warehouse"] = filters.get("warehouse")

    condition_str = " AND " + " AND ".join(conditions) if conditions else ""

    query = f"""
        SELECT 
            sii.item_code,
            sii.item_name,
            sii.item_group,
            sii.stock_uom as uom,
            SUM(sii.qty) as qty,
            SUM(sii.base_net_amount) as sales_amount,
            SUM(sii.qty * sii.incoming_rate) as cost_amount
        FROM 
            `tabSales Invoice Item` sii
        INNER JOIN 
            `tabSales Invoice` si ON sii.parent = si.name
        WHERE 
            si.docstatus = 1
            AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
            {condition_str}
        GROUP BY 
            sii.item_code, sii.item_name, sii.item_group, sii.stock_uom
        ORDER BY 
            sales_amount DESC
    """
    
    raw_data = frappe.db.sql(query, values, as_dict=True)
    
    processed_data = []
    for row in raw_data:
        sales = flt(row.sales_amount)
        cost = flt(row.cost_amount)
        profit = sales - cost
        margin = (profit / sales * 100) if sales else 0.0
        
        processed_data.append({
            "item_code": row.item_code,
            "item_name": row.item_name,
            "item_group": row.item_group,
            "uom": row.uom,
            "qty": row.qty,
            "sales_amount": sales,
            "cost_amount": cost,
            "gross_profit": profit,
            "margin_percentage": margin
        })
        
    return processed_data

def get_report_summary(data):
    total_sales = sum(row["sales_amount"] for row in data)
    total_cost = sum(row["cost_amount"] for row in data)
    total_profit = total_sales - total_cost
    avg_margin = (total_profit / total_sales * 100) if total_sales else 0.0

    return [
        {
            "value": total_sales,
            "label": _("Total Sales"),
            "indicator": "green",
            "datatype": "Currency"
        },
        {
            "value": total_cost,
            "label": _("Total Cost"),
            "indicator": "blue",
            "datatype": "Currency"
        },
        {
            "value": total_profit,
            "label": _("Gross Profit"),
            "indicator": "orange",
            "datatype": "Currency"
        },
        {
            "value": avg_margin,
            "label": _("Average Margin %"),
            "indicator": "purple",
            "datatype": "Percent"
        }
    ]
