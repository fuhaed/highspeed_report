# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt, cint, getdate, cstr, nowdate
from frappe.utils.xlsxutils import make_xlsx
import json
from six import string_types

def execute(filters=None):
    if not filters: 
        filters = {}

    validate_filters(filters)
    
    columns = get_columns(filters)
    
    # Get data using the optimized method
    data = get_stock_balance_data(filters)
    
    # Calculate totals
    total_qty = 0.0
    total_value = 0.0
    
    for row in data:
        total_qty += flt(row[4])  # Quantity column
        total_value += flt(row[8])  # Total value column
    
    # Add totals row
    if data:
        data.append([
            "", 
            "Total",
            "", 
            "", 
            total_qty, 
            "", 
            "", 
            "", 
            total_value
        ])
    
    return columns, data, None, None, get_report_summary(data, total_qty, total_value)

def get_stock_balance_data(filters):
    """Get stock balance data using bin table and stock ledger entry"""
    
    warehouse = filters.get("warehouse")
    posting_date = filters.get("date")
    company = filters.get("company")
    
    # Build conditions for filtering
    conditions = ""
    if filters.get("item_code"):
        conditions += " AND item.name = %(item_code)s"
    
    if filters.get("item_group"):
        conditions += " AND item.item_group = %(item_group)s"
    
    if filters.get("brand"):
        conditions += " AND item.brand = %(brand)s"
    
    # First, get the current stock from Stock Ledger Entry
    # Using a more reliable method to get the last entry for each item
    stock_query = """
        SELECT 
            item.name as item_code,
            item.item_name as item_name,
            %(warehouse)s as warehouse,
            item.stock_uom as stock_uom,
            IFNULL(
                (SELECT qty_after_transaction 
                 FROM `tabStock Ledger Entry` sle2
                 WHERE sle2.item_code = item.name
                   AND sle2.warehouse = %(warehouse)s
                   AND sle2.posting_date <= %(posting_date)s
                   AND sle2.is_cancelled = 0
                 ORDER BY sle2.posting_date DESC, 
                          sle2.posting_time DESC, 
                          sle2.creation DESC
                 LIMIT 1), 0
            ) as qty,
            IFNULL(
                (SELECT stock_value 
                 FROM `tabStock Ledger Entry` sle3
                 WHERE sle3.item_code = item.name
                   AND sle3.warehouse = %(warehouse)s
                   AND sle3.posting_date <= %(posting_date)s
                   AND sle3.is_cancelled = 0
                 ORDER BY sle3.posting_date DESC, 
                          sle3.posting_time DESC, 
                          sle3.creation DESC
                 LIMIT 1), 0
            ) as stock_value
        FROM `tabItem` item
        WHERE 
            item.is_stock_item = 1
            AND item.disabled = 0
            {conditions}
        ORDER BY item.name
    """
    
    # Execute the query
    data = frappe.db.sql(stock_query.format(conditions=conditions), {
        "warehouse": warehouse,
        "posting_date": posting_date,
        "item_code": filters.get("item_code"),
        "item_group": filters.get("item_group"),
        "brand": filters.get("brand")
    }, as_dict=1)
    
    # Get price information
    selling_price_map = {}
    purchase_price_map = {}
    
    if filters.get("price_list"):
        selling_price_map = get_item_prices(filters.get("price_list"), posting_date)
    
    if filters.get("purchase_price_list"):
        purchase_price_map = get_item_prices(filters.get("purchase_price_list"), posting_date)
    else:
        purchase_price_map = get_last_purchase_prices(company, posting_date)
    
    # Process the data
    processed_data = []
    for row in data:
        qty = flt(row.get('qty', 0), 3)
        stock_value = flt(row.get('stock_value', 0), 2)
        
        # Skip zero quantity items if not included
        if not filters.get("include_zero_qty") and qty == 0:
            continue
        
        # Calculate valuation rate
        valuation_rate = 0
        if qty != 0 and stock_value != 0:
            valuation_rate = abs(stock_value / qty)
        
        # Get item code and name, ensure they're not None
        item_code = row.get('item_code') or ''
        item_name = row.get('item_name') or ''
        warehouse_name = row.get('warehouse') or warehouse
        stock_uom = row.get('stock_uom') or 'Nos'
        
        # Get prices
        selling_price = selling_price_map.get(item_code, 0)
        purchase_price = purchase_price_map.get(item_code, 0)
        
        # Add row to processed data - keeping code and name separate
        processed_data.append([
            item_code,  # Only the code
            item_name,  # Only the name
            warehouse_name,
            stock_uom,
            qty,
            round(valuation_rate, 2),
            round(selling_price, 2),
            round(purchase_price, 2),
            round(stock_value, 2)
        ])
    
    return processed_data

def get_item_prices(price_list, date):
    """Get item prices from price list"""
    prices = {}
    
    price_data = frappe.db.sql("""
        SELECT 
            item_code,
            price_list_rate
        FROM `tabItem Price`
        WHERE 
            price_list = %s
            AND (valid_from IS NULL OR valid_from <= %s)
            AND (valid_upto IS NULL OR valid_upto >= %s)
        ORDER BY valid_from DESC
    """, (price_list, date, date), as_dict=1)
    
    # Use dict to get unique prices per item
    for p in price_data:
        if p.item_code not in prices:
            prices[p.item_code] = flt(p.price_list_rate, 2)
    
    return prices

def get_last_purchase_prices(company, date):
    """Get last purchase price for items"""
    prices = {}
    
    # Get from Purchase Invoice first
    invoice_prices = frappe.db.sql("""
        SELECT 
            pii.item_code,
            pii.rate
        FROM `tabPurchase Invoice Item` pii
        INNER JOIN `tabPurchase Invoice` pi ON pi.name = pii.parent
        WHERE 
            pi.docstatus = 1
            AND pi.company = %s
            AND pi.posting_date <= %s
            AND (pii.item_code, pi.posting_date) IN (
                SELECT 
                    pii2.item_code,
                    MAX(pi2.posting_date)
                FROM `tabPurchase Invoice Item` pii2
                INNER JOIN `tabPurchase Invoice` pi2 ON pi2.name = pii2.parent
                WHERE 
                    pi2.docstatus = 1
                    AND pi2.company = %s
                    AND pi2.posting_date <= %s
                GROUP BY pii2.item_code
            )
    """, (company, date, company, date), as_dict=1)
    
    for p in invoice_prices:
        prices[p.item_code] = flt(p.rate, 2)
    
    # For items without invoice, check Purchase Order
    po_prices = frappe.db.sql("""
        SELECT 
            poi.item_code,
            poi.rate
        FROM `tabPurchase Order Item` poi
        INNER JOIN `tabPurchase Order` po ON po.name = poi.parent
        WHERE 
            po.docstatus = 1
            AND po.company = %s
            AND po.transaction_date <= %s
            AND poi.item_code NOT IN (%s)
            AND (poi.item_code, po.transaction_date) IN (
                SELECT 
                    poi2.item_code,
                    MAX(po2.transaction_date)
                FROM `tabPurchase Order Item` poi2
                INNER JOIN `tabPurchase Order` po2 ON po2.name = poi2.parent
                WHERE 
                    po2.docstatus = 1
                    AND po2.company = %s
                    AND po2.transaction_date <= %s
                GROUP BY poi2.item_code
            )
    """, (company, date, ','.join(["'%s'" % k for k in prices.keys()]) if prices else "''", 
         company, date), as_dict=1)
    
    for p in po_prices:
        if p.item_code not in prices:
            prices[p.item_code] = flt(p.rate, 2)
    
    return prices

def validate_filters(filters):
    """Validate filters"""
    if not filters.get("date"):
        filters["date"] = nowdate()
    
    if not filters.get("warehouse"):
        frappe.throw(_("Warehouse is required"))
    
    if not filters.get("company"):
        filters["company"] = frappe.defaults.get_user_default("Company")

def get_columns(filters):
    """Return report columns"""
    
    columns = [
        {
            "label": _("Item Code"),
            "fieldname": "item_code",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": _("Item Name"),
            "fieldname": "item_name",
            "fieldtype": "Data",
            "width": 250
        },
        {
            "label": _("Warehouse"),
            "fieldname": "warehouse",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": _("UOM"),
            "fieldname": "stock_uom",
            "fieldtype": "Data",
            "width": 80
        },
        {
            "label": _("Qty"),
            "fieldname": "qty",
            "fieldtype": "Float",
            "width": 100,
            "precision": 3
        },
        {
            "label": _("Valuation Rate"),
            "fieldname": "valuation_rate",
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "label": _("Selling Price"),
            "fieldname": "selling_price",
            "fieldtype": "Currency",
            "width": 110
        },
        {
            "label": _("Last Purchase Price"),
            "fieldname": "last_purchase_price",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": _("Total Value"),
            "fieldname": "total_value",
            "fieldtype": "Currency",
            "width": 120
        }
    ]

    return columns

def get_report_summary(data, calculated_total_qty=None, calculated_total_value=None):
    """Create report summary"""
    if not data:
        return None
    
    # Use calculated totals - ensure they are floats
    total_qty = flt(calculated_total_qty or 0, 3)
    total_value = flt(calculated_total_value or 0, 2)
    
    # Count items (excluding totals row)
    item_count = len(data) - 1 if data else 0
    
    # Count items by status
    negative_items = 0
    zero_items = 0
    positive_items = 0
    
    for row in data[:-1]:  # Exclude last row (totals)
        if len(row) > 4:
            qty = flt(row[4])
            if qty < 0:
                negative_items += 1
            elif qty == 0:
                zero_items += 1
            else:
                positive_items += 1
    
    return [
        {
            "value": item_count,
            "label": _("Total Items"),
            "datatype": "Int",
            "indicator": "Blue"
        },
        {
            "value": positive_items,
            "label": _("In Stock"),
            "datatype": "Int", 
            "indicator": "Green"
        },
        {
            "value": zero_items,
            "label": _("Out of Stock"),
            "datatype": "Int",
            "indicator": "Orange"
        },
        {
            "value": negative_items,
            "label": _("Negative Stock"),
            "datatype": "Int",
            "indicator": "Red"
        },
        {
            "value": round(total_qty, 3),
            "label": _("Total Quantity"),
            "datatype": "Float",
            "precision": 3,
            "indicator": "Blue" if total_qty >= 0 else "Red"
        },
        {
            "value": round(total_value, 2),
            "label": _("Total Value"),
            "datatype": "Currency",
            "indicator": "Green" if total_value >= 0 else "Red"
        }
    ]

@frappe.whitelist()
def get_print_data(filters):
    """Get print data"""
    if isinstance(filters, string_types):
        filters = json.loads(filters)

    columns, data, _, chart, report_summary = execute(filters)
    
    # Get warehouse name
    warehouse_name = frappe.db.get_value("Warehouse", filters.get("warehouse"), "warehouse_name")
    
    return {
        "columns": columns,
        "data": data,
        "report_summary": report_summary,
        "company": filters.get("company") or frappe.defaults.get_user_default("Company"),
        "report_date": frappe.format_value(filters.get("date"), {"fieldtype": "Date"}),
        "warehouse": warehouse_name or filters.get("warehouse"),
        "filters": filters
    }

@frappe.whitelist()
def download_xlsx(filters):
    """Download report as Excel"""
    if isinstance(filters, string_types):
        filters = json.loads(filters)
        
    columns, data, _, chart, report_summary = execute(filters)
    
    xlsx_data = build_xlsx_data(columns, data, filters, report_summary)
    xlsx_file = make_xlsx(xlsx_data, "Item Stock Balance")
    
    # File name
    filename = 'Item_Stock_Balance_{0}_{1}.xlsx'.format(
        filters.get("warehouse", "").replace(" ", "_").replace("/", "_"),
        filters.get("date")
    )
    
    frappe.response['filename'] = filename
    frappe.response['filecontent'] = xlsx_file.getvalue()
    frappe.response['type'] = 'binary'

def build_xlsx_data(columns, data, filters, report_summary):
    """Build Excel file data"""
    output = []
    
    # Get warehouse name
    warehouse_name = frappe.db.get_value("Warehouse", filters.get("warehouse"), "warehouse_name")
    
    # Add report title
    output.append([])
    output.append([_("Item Stock Balance Report")])
    output.append([])
    
    # Add filter information
    output.append([_("Company"), filters.get("company") or frappe.defaults.get_user_default("Company")])
    output.append([_("Warehouse"), warehouse_name or filters.get("warehouse")])
    output.append([_("As on Date"), frappe.format_value(filters.get("date"), {"fieldtype": "Date"})])
    
    if filters.get("item_group"):
        output.append([_("Item Group"), filters.get("item_group")])
    
    if filters.get("brand"):
        output.append([_("Brand"), filters.get("brand")])
        
    if filters.get("price_list"):
        output.append([_("Price List"), filters.get("price_list")])
    
    output.append([])
    
    # Add report summary
    if report_summary:
        output.append([_("Report Summary")])
        for summary in report_summary:
            value = summary.get("value")
            if summary.get("datatype") == "Float" and summary.get("precision"):
                value = round(value, summary.get("precision"))
            output.append([summary.get("label"), value])
        output.append([])
    
    # Add column headers
    headers = [d.get("label") for d in columns]
    output.append(headers)
    
    # Add data
    for row in data:
        output.append(row)
    
    # Add generation information
    output.append([])
    output.append([_("Generated On"), frappe.utils.now()])
    output.append([_("Generated By"), frappe.session.user])
    
    return output