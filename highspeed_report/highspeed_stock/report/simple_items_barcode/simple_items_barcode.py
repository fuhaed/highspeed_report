# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, cstr

def execute(filters=None):
    """Main execution function for the Simple Items Barcode report"""
    if not filters:
        filters = {}
    
    # Get report data
    columns = get_columns()
    data = get_item_barcode_data(filters)
    
    # Add summary if needed
    summary = get_summary(data)
    
    return columns, data, None, None, summary

def get_columns():
    """Define the columns for the simple items barcode report"""
    return [
        {
            "fieldname": "item_code",
            "label": _("Item Code"),
            "fieldtype": "Link",
            "options": "Item",
            "width": 120
        },
        {
            "fieldname": "item_name",
            "label": _("Item Name"),
            "fieldtype": "Data",
            "width": 250
        },
        {
            "fieldname": "item_group",
            "label": _("Item Group"),
            "fieldtype": "Link",
            "options": "Item Group",
            "width": 120
        },
        {
            "fieldname": "uom",
            "label": _("UOM"),
            "fieldtype": "Link",
            "options": "UOM",
            "width": 80
        },
        {
            "fieldname": "selling_price",
            "label": _("Selling Price"),
            "fieldtype": "Currency",
            "width": 120,
            "options": "currency"
        },
        {
            "fieldname": "barcode",
            "label": _("Barcode"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "barcode_type",
            "label": _("Barcode Type"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "print_label",
            "label": _("Print Label"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "print_barcode",
            "label": _("Print Barcode Only"),
            "fieldtype": "Data",
            "width": 120
        }
    ]

def get_item_barcode_data(filters):
    """Get items that have barcodes with proper UOM and no duplicates"""
    
    # Build conditions based on filters
    conditions = ["i.disabled = 0", "ib.barcode IS NOT NULL", "ib.barcode != ''"]
    values = []
    
    if filters.get("item_code"):
        conditions.append("i.name = %s")
        values.append(filters.get("item_code"))
    
    if filters.get("item_group"):
        lft, rgt = frappe.db.get_value("Item Group", filters.get("item_group"), ["lft", "rgt"])
        conditions.append("i.item_group IN (SELECT name FROM `tabItem Group` WHERE lft >= %s AND rgt <= %s)")
        values.extend([lft, rgt])
    
    if filters.get("barcode"):
        conditions.append("ib.barcode LIKE %s")
        values.append(f"%{filters.get('barcode')}%")
    
    # Get default price list from settings or use fallback
    default_price_list = get_default_price_list(filters)
    
    # Get company currency
    company = filters.get("company") or frappe.defaults.get_user_default("Company")
    currency = frappe.get_cached_value("Company", company, "default_currency") if company else None
    
    # Main query to get item data with barcodes and selling price
    query = """
        SELECT
            i.name as item_code,
            i.item_name,
            i.item_group,
            COALESCE(ib.uom, i.stock_uom) as uom,
            ib.barcode,
            ib.barcode_type,
            '{currency}' as currency,
            COALESCE(
                (SELECT ip.price_list_rate
                 FROM `tabItem Price` ip
                 WHERE ip.item_code = i.name
                 AND ip.price_list = %s
                 AND ip.selling = 1
                 AND IFNULL(ip.uom, i.stock_uom) = COALESCE(ib.uom, i.stock_uom)
                 AND (ip.valid_from IS NULL OR ip.valid_from <= CURDATE())
                 AND (ip.valid_upto IS NULL OR ip.valid_upto >= CURDATE())
                 ORDER BY ip.valid_from DESC
                 LIMIT 1),
                i.standard_rate,
                0
            ) as selling_price
        FROM
            `tabItem` i
        INNER JOIN
            `tabItem Barcode` ib ON i.name = ib.parent
        WHERE
            {conditions}
        ORDER BY
            i.item_name ASC, ib.idx ASC
    """.format(
        conditions=" AND ".join(conditions),
        currency=currency or frappe.defaults.get_global_default("currency")
    )
    
    # Execute query with price list parameter
    values.insert(0, default_price_list)
    item_data = frappe.db.sql(query, values, as_dict=1)
    
    # Process and clean data
    processed_data = []
    seen_combinations = set()
    
    for row in item_data:
        # Create unique key to prevent duplicates
        key = (row.get("item_code"), row.get("barcode"), row.get("uom"))
        if key in seen_combinations:
            continue
        seen_combinations.add(key)
        
        # Clean None values
        for field in row:
            if row[field] is None:
                if field == "selling_price":
                    row[field] = 0.0
                else:
                    row[field] = ""
        
        # Ensure selling_price is float
        row["selling_price"] = flt(row.get("selling_price", 0))
        
        processed_data.append(row)
    
    return processed_data

def get_default_price_list(filters):
    """Get the default price list based on filters or settings"""
    if filters.get("price_list"):
        return filters.get("price_list")
    
    # Try to get from Selling Settings
    price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")
    
    # Fallback to Standard Selling
    if not price_list:
        price_list = frappe.db.get_value("Price List", 
            {"selling": 1, "enabled": 1}, 
            "name", 
            order_by="creation"
        ) or "Standard Selling"
    
    return price_list

def get_summary(data):
    """Generate summary statistics for the report"""
    if not data:
        return []
    
    total_items = len(set(d.get("item_code") for d in data))
    total_barcodes = len(data)
    items_with_price = len([d for d in data if flt(d.get("selling_price", 0)) > 0])
    items_without_price = total_barcodes - items_with_price
    
    return [
        {
            "value": total_items,
            "label": _("Total Unique Items"),
            "datatype": "Int",
        },
        {
            "value": total_barcodes,
            "label": _("Total Barcodes"),
            "datatype": "Int",
        },
        {
            "value": items_with_price,
            "label": _("Items with Price"),
            "datatype": "Int",
        },
        {
            "value": items_without_price,
            "label": _("Items without Price"),
            "datatype": "Int",
            "indicator": "red" if items_without_price > 0 else "green"
        }
    ]