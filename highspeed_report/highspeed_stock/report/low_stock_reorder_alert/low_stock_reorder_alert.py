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
            "label": _("Warehouse"),
            "fieldname": "warehouse",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 150
        },
        {
            "label": _("Actual Qty"),
            "fieldname": "actual_qty",
            "fieldtype": "Float",
            "width": 110
        },
        {
            "label": _("Reorder Level"),
            "fieldname": "reorder_level",
            "fieldtype": "Float",
            "width": 110
        },
        {
            "label": _("Reorder Qty"),
            "fieldname": "reorder_qty",
            "fieldtype": "Float",
            "width": 110
        },
        {
            "label": _("Shortage Qty"),
            "fieldname": "shortage_qty",
            "fieldtype": "Float",
            "width": 110
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 120
        }
    ]

def get_data(filters):
    # Fetch reorder levels from Item Reorder child table
    reorder_conditions = ["i.disabled = 0"]
    reorder_values = {}
    
    if filters.get("item_group"):
        reorder_conditions.append("i.item_group = %(item_group)s")
        reorder_values["item_group"] = filters.get("item_group")
    if filters.get("warehouse"):
        reorder_conditions.append("ir.warehouse = %(warehouse)s")
        reorder_values["warehouse"] = filters.get("warehouse")

    reorder_cond_str = " AND " + " AND ".join(reorder_conditions) if reorder_conditions else ""

    reorder_query = f"""
        SELECT 
            ir.parent as item_code,
            i.item_name,
            i.item_group,
            ir.warehouse,
            ir.warehouse_reorder_level as reorder_level,
            ir.warehouse_reorder_qty as reorder_qty
        FROM 
            `tabItem Reorder` ir
        INNER JOIN 
            `tabItem` i ON ir.parent = i.name
        WHERE 
            1=1
            {reorder_cond_str}
    """
    reorder_items = frappe.db.sql(reorder_query, reorder_values, as_dict=True)

    # Fetch bins
    bin_conditions = []
    bin_values = {}
    if filters.get("warehouse"):
        bin_conditions.append("bin.warehouse = %(warehouse)s")
        bin_values["warehouse"] = filters.get("warehouse")
        
    bin_cond_str = " WHERE " + " AND ".join(bin_conditions) if bin_conditions else ""
    
    bin_query = f"""
        SELECT 
            bin.item_code,
            bin.warehouse,
            bin.actual_qty
        FROM 
            `tabBin` bin
        {bin_cond_str}
    """
    bins = frappe.db.sql(bin_query, bin_values, as_dict=True)
    
    # Map bins to (item_code, warehouse) -> actual_qty
    bin_map = {(b.item_code, b.warehouse): flt(b.actual_qty) for b in bins}

    data = []
    processed = set()

    # Process items with defined reorder levels
    for r in reorder_items:
        key = (r.item_code, r.warehouse)
        processed.add(key)
        
        actual_qty = bin_map.get(key, 0.0)
        reorder_level = flt(r.reorder_level)
        reorder_qty = flt(r.reorder_qty)
        
        if actual_qty < reorder_level or actual_qty <= 0:
            shortage = max(0.0, reorder_level - actual_qty)
            status = _("Out of Stock") if actual_qty <= 0 else _("Low Stock")
            
            data.append({
                "item_code": r.item_code,
                "item_name": r.item_name,
                "item_group": r.item_group,
                "warehouse": r.warehouse,
                "actual_qty": actual_qty,
                "reorder_level": reorder_level,
                "reorder_qty": reorder_qty,
                "shortage_qty": shortage,
                "status": status
            })

    # Find items that have zero stock but no reorder level defined (as a fallback)
    for (item_code, warehouse), actual_qty in bin_map.items():
        if actual_qty <= 0:
            key = (item_code, warehouse)
            if key not in processed:
                # Get item details
                item_details = frappe.db.get_value("Item", item_code, ["item_name", "item_group", "disabled"], as_dict=True)
                if item_details and not item_details.disabled:
                    if filters.get("item_group") and item_details.item_group != filters.get("item_group"):
                        continue
                        
                    data.append({
                        "item_code": item_code,
                        "item_name": item_details.item_name,
                        "item_group": item_details.item_group,
                        "warehouse": warehouse,
                        "actual_qty": actual_qty,
                        "reorder_level": 0.0,
                        "reorder_qty": 0.0,
                        "shortage_qty": 0.0,
                        "status": _("Out of Stock")
                    })

    # Sort shortage descending, then status
    data.sort(key=lambda x: (x["status"] == _("Out of Stock"), x["shortage_qty"]), reverse=True)
    return data

def get_report_summary(data):
    out_of_stock_count = sum(1 for row in data if row["status"] == _("Out of Stock"))
    low_stock_count = sum(1 for row in data if row["status"] == _("Low Stock"))
    total_shortage = sum(row["shortage_qty"] for row in data)

    return [
        {
            "value": out_of_stock_count,
            "label": _("Out of Stock Items"),
            "indicator": "red",
            "datatype": "Int"
        },
        {
            "value": low_stock_count,
            "label": _("Low Stock Items"),
            "indicator": "orange",
            "datatype": "Int"
        },
        {
            "value": total_shortage,
            "label": _("Total Shortage Qty"),
            "indicator": "blue",
            "datatype": "Float"
        }
    ]
