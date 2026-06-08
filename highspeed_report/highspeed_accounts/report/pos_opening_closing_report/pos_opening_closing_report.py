# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, cint, get_datetime
import datetime

def execute(filters=None):
    """Main execution function for the report"""
    if not filters:
        filters = {}
    
    # Set default date range if not provided
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)
    
    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()
    
    # Get report data
    columns = get_columns()
    data = get_pos_opening_closing_data(filters)
    
    return columns, data

def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "period_start_date",
            "label": _("تاريخ الفتح"),
            "fieldtype": "Datetime",
            "width": 140
        },
        {
            "fieldname": "period_end_date",
            "label": _("تاريخ الإغلاق"),
            "fieldtype": "Datetime",
            "width": 140
        },
        {
            "fieldname": "name",
            "label": _("رقم الجلسة"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "pos_profile",
            "label": _("صالة البيع"),
            "fieldtype": "Link",
            "options": "POS Profile",
            "width": 150
        },
        {
            "fieldname": "user",
            "label": _("المستخدم"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "total_quantity",
            "label": _("عدد الفواتير"),
            "fieldtype": "Int",
            "width": 100
        },
        {
            "fieldname": "net_total",
            "label": _("المبلغ بدون ضريبة"),
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "fieldname": "total_taxes",
            "label": _("إجمالي الضرائب"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "grand_total",
            "label": _("المبلغ مع الضريبة"),
            "fieldtype": "Currency",
            "width": 140
        }
    ]

def get_pos_opening_closing_data(filters):
    """Get POS opening/closing data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("poe.company = %(company)s")
    conditions.append("DATE(poe.period_start_date) BETWEEN %(from_date)s AND %(to_date)s")
    
    # Filter by POS Profile if provided
    if filters.get("pos_profile"):
        conditions.append("poe.pos_profile = %(pos_profile)s")
        values["pos_profile"] = filters.get("pos_profile")
    
    # Filter by user if provided
    if filters.get("user"):
        conditions.append("poe.user = %(user)s")
        values["user"] = filters.get("user")
    
    # Filter by status if provided
    if filters.get("status"):
        if filters.get("status") == "Open":
            conditions.append("poe.docstatus = 1 AND poe.status = 'Open'")
        elif filters.get("status") == "Closed":
            conditions.append("poe.docstatus = 1 AND poe.status = 'Closed'")
    
    # Check if POS Closing Entry table exists and get available columns
    closing_fields = []
    if frappe.db.table_exists("POS Closing Entry"):
        # Get available fields from POS Closing Entry
        closing_columns = frappe.db.get_table_columns("POS Closing Entry")
        
        # Build field list based on what's available
        closing_fields.append("pce.name as closing_entry_name")
        if "period_end_date" in closing_columns:
            closing_fields.append("pce.period_end_date as closing_end_date")
        if "net_total" in closing_columns:
            closing_fields.append("pce.net_total as closing_net_total")
        if "grand_total" in closing_columns:
            closing_fields.append("pce.grand_total as closing_grand_total")
        if "total_taxes_and_charges" in closing_columns:
            closing_fields.append("pce.total_taxes_and_charges as closing_total_taxes")
        # Add invoice count fields if available
        if "total_quantity" in closing_columns:
            closing_fields.append("pce.total_quantity as closing_invoice_count")
        elif "total_invoices" in closing_columns:
            closing_fields.append("pce.total_invoices as closing_invoice_count")
    
    # Build query based on available fields
    if closing_fields:
        closing_select = ", " + ", ".join(closing_fields)
        closing_join = "LEFT JOIN `tabPOS Closing Entry` pce ON pce.pos_opening_entry = poe.name AND pce.docstatus = 1"
    else:
        closing_select = ""
        closing_join = ""
    
    # Main query to get POS Opening Entry data
    pos_openings = frappe.db.sql("""
        SELECT
            poe.name,
            poe.period_start_date,
            poe.period_end_date,
            poe.pos_profile,
            poe.user,
            poe.status,
            poe.docstatus,
            prof.warehouse
            {closing_select}
        FROM
            `tabPOS Opening Entry` poe
        LEFT JOIN
            `tabPOS Profile` prof ON poe.pos_profile = prof.name
        {closing_join}
        WHERE
            {conditions}
        ORDER BY
            poe.period_start_date DESC
    """.format(
        closing_select=closing_select,
        closing_join=closing_join,
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    data = []
    total_net = 0
    total_taxes = 0
    total_grand = 0
    total_invoices = 0
    
    for opening in pos_openings:
        # Get user full name
        user_name = frappe.db.get_value("User", opening.user, "full_name") or opening.user
        
        # Check if we have closing data
        has_closing_data = (
            hasattr(opening, 'closing_net_total') and 
            opening.get('closing_net_total') is not None
        )
        
        if has_closing_data:
            # Use data from POS Closing Entry
            closing_taxes = 0
            if hasattr(opening, 'closing_total_taxes') and opening.get('closing_total_taxes'):
                closing_taxes = opening.closing_total_taxes
            else:
                # Calculate taxes from grand_total - net_total
                closing_taxes = flt(opening.get('closing_grand_total', 0)) - flt(opening.get('closing_net_total', 0))
            
            # Get invoice count from closing entry or calculate
            invoice_count = 0
            if hasattr(opening, 'closing_invoice_count') and opening.get('closing_invoice_count'):
                invoice_count = opening.closing_invoice_count
            else:
                invoice_count = get_invoice_count_for_opening(opening.name)
            
            sales_summary = {
                "invoice_count": invoice_count,
                "net_total": opening.get('closing_net_total', 0),
                "total_taxes": closing_taxes,
                "grand_total": opening.get('closing_grand_total', 0)
            }
        else:
            # Calculate from individual invoices
            sales_summary = get_sales_summary_for_opening(opening)
        
        # Determine status in Arabic
        status_ar = "مفتوح" if opening.status == "Open" else "مغلق"
        if opening.docstatus == 0:
            status_ar = "مسودة"
        elif opening.docstatus == 2:
            status_ar = "ملغي"
        
        # Determine end date
        end_date = None
        if hasattr(opening, 'closing_end_date') and opening.get('closing_end_date'):
            end_date = opening.closing_end_date
        else:
            end_date = opening.period_end_date
        
        # Determine which entry name to show (prefer closing entry if available)
        entry_name = opening.name  # Default to opening entry name
        if hasattr(opening, 'closing_entry_name') and opening.get('closing_entry_name'):
            entry_name = opening.closing_entry_name
        
        # Add to data
        row_data = {
            "period_start_date": opening.period_start_date,
            "period_end_date": end_date,
            "name": entry_name,
            "pos_profile": opening.pos_profile,
            "user": user_name,
            "status": status_ar,
            "total_quantity": sales_summary.get("invoice_count", 0),
            "net_total": flt(sales_summary.get("net_total", 0)),
            "total_taxes": flt(sales_summary.get("total_taxes", 0)),
            "grand_total": flt(sales_summary.get("grand_total", 0)),
            "opening_entry": opening.name  # Keep reference to opening entry
        }
        
        data.append(row_data)
        
        # Add to totals (only for submitted and not cancelled entries)
        if opening.docstatus == 1:
            total_net += flt(sales_summary.get("net_total", 0))
            total_taxes += flt(sales_summary.get("total_taxes", 0))
            total_grand += flt(sales_summary.get("grand_total", 0))
            total_invoices += sales_summary.get("invoice_count", 0)
    
    # Add total row if we have data
    if data:
        data.append({
            "name": None,
            "pos_profile": _("Grand Total"),
            "user": "",
            "status": "",
            "total_quantity": total_invoices,
            "net_total": flt(total_net),
            "total_taxes": flt(total_taxes),
            "grand_total": flt(total_grand),
            "is_total_row": True
        })
    
    return data

def get_invoice_count_for_opening(pos_opening_entry):
    """Get invoice count for a specific POS opening entry"""
    
    # Check if pos_opening_entry field exists in POS Invoice
    if frappe.db.has_column("POS Invoice", "pos_opening_entry"):
        count = frappe.db.sql("""
            SELECT COUNT(*) as count
            FROM `tabPOS Invoice`
            WHERE pos_opening_entry = %s AND docstatus = 1
        """, (pos_opening_entry,), as_dict=1)
        
        if count:
            return count[0].count or 0
    
    # Fallback: try to get count from Sales Invoice if POS Invoice doesn't work
    try:
        # Get the opening entry details
        opening_details = frappe.db.get_value("POS Opening Entry", pos_opening_entry, 
                                            ["pos_profile", "user", "period_start_date", "period_end_date"], 
                                            as_dict=1)
        
        if opening_details:
            # Use time range to count invoices
            end_date = opening_details.period_end_date
            if not end_date:
                # If no end date, use end of day for start date
                from frappe.utils import get_datetime
                start_date = getdate(opening_details.period_start_date)
                end_date = get_datetime(start_date).replace(hour=23, minute=59, second=59)
            
            # Try POS Invoice first
            count = frappe.db.sql("""
                SELECT COUNT(*) as count
                FROM `tabPOS Invoice`
                WHERE pos_profile = %s 
                AND owner = %s
                AND creation >= %s 
                AND creation <= %s
                AND docstatus = 1
            """, (opening_details.pos_profile, opening_details.user, 
                  opening_details.period_start_date, end_date), as_dict=1)
            
            if count and count[0].count > 0:
                return count[0].count
            
            # Fallback to Sales Invoice
            count = frappe.db.sql("""
                SELECT COUNT(*) as count
                FROM `tabSales Invoice`
                WHERE pos_profile = %s 
                AND owner = %s
                AND creation >= %s 
                AND creation <= %s
                AND is_pos = 1
                AND docstatus = 1
            """, (opening_details.pos_profile, opening_details.user, 
                  opening_details.period_start_date, end_date), as_dict=1)
            
            if count:
                return count[0].count or 0
    
    except Exception as e:
        frappe.log_error(f"Error getting invoice count for {pos_opening_entry}: {str(e)}")
    
    return 0

def get_sales_summary_for_opening(opening_entry):
    """Get sales summary for a specific POS opening entry using time range and POS profile"""
    
    # Check if pos_opening_entry field exists in POS Invoice
    pos_opening_field_exists = frappe.db.has_column("POS Invoice", "pos_opening_entry")
    
    if pos_opening_field_exists:
        # Use the direct field if available (newer ERPNext versions)
        sales_data = frappe.db.sql("""
            SELECT
                COUNT(pi.name) as invoice_count,
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.net_total ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.net_total ELSE 0 END) as net_total,
                
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.total_taxes_and_charges ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.total_taxes_and_charges ELSE 0 END) as total_taxes,
                
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.grand_total ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.grand_total ELSE 0 END) as grand_total
            FROM
                `tabPOS Invoice` pi
            WHERE
                pi.pos_opening_entry = %s
                AND pi.docstatus != 2
        """, (opening_entry.name,), as_dict=1)
    else:
        # Fall back to more precise time-based matching for older ERPNext versions
        # Get the exact start and end times for this specific opening entry
        start_datetime = opening_entry.period_start_date
        
        if opening_entry.period_end_date:
            end_datetime = opening_entry.period_end_date
        else:
            # If no end date, use end of the day for the start date
            from frappe.utils import get_datetime, add_days, get_time
            start_date = getdate(opening_entry.period_start_date)
            end_datetime = get_datetime(start_date).replace(hour=23, minute=59, second=59)
        
        # First try POS Invoice table
        sales_data = frappe.db.sql("""
            SELECT
                COUNT(pi.name) as invoice_count,
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.net_total ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.net_total ELSE 0 END) as net_total,
                
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.total_taxes_and_charges ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.total_taxes_and_charges ELSE 0 END) as total_taxes,
                
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 0 THEN pi.grand_total ELSE 0 END) -
                SUM(CASE WHEN pi.docstatus = 1 AND pi.is_return = 1 THEN pi.grand_total ELSE 0 END) as grand_total
            FROM
                `tabPOS Invoice` pi
            WHERE
                pi.pos_profile = %s
                AND pi.owner = %s
                AND pi.creation >= %s
                AND pi.creation <= %s
                AND pi.docstatus != 2
        """, (
            opening_entry.pos_profile,
            opening_entry.user,
            start_datetime,
            end_datetime
        ), as_dict=1)
        
        # If no data found in POS Invoice, try Sales Invoice as fallback
        if not sales_data or sales_data[0].invoice_count == 0:
            sales_data = frappe.db.sql("""
                SELECT
                    COUNT(si.name) as invoice_count,
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.net_total ELSE 0 END) -
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.net_total ELSE 0 END) as net_total,
                    
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.total_taxes_and_charges ELSE 0 END) -
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.total_taxes_and_charges ELSE 0 END) as total_taxes,
                    
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.grand_total ELSE 0 END) -
                    SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.grand_total ELSE 0 END) as grand_total
                FROM
                    `tabSales Invoice` si
                WHERE
                    si.pos_profile = %s
                    AND si.owner = %s
                    AND si.creation >= %s
                    AND si.creation <= %s
                    AND si.is_pos = 1
                    AND si.docstatus != 2
            """, (
                opening_entry.pos_profile,
                opening_entry.user,
                start_datetime,
                end_datetime
            ), as_dict=1)
    
    if sales_data and len(sales_data) > 0:
        return {
            "invoice_count": sales_data[0].invoice_count or 0,
            "net_total": sales_data[0].net_total or 0,
            "total_taxes": sales_data[0].total_taxes or 0,
            "grand_total": sales_data[0].grand_total or 0
        }
    
    return {
        "invoice_count": 0,
        "net_total": 0,
        "total_taxes": 0,
        "grand_total": 0
    }

def get_alternative_sales_summary(opening_entry):
    """Alternative method using Sales Invoice if POS Invoice method fails"""
    try:
        end_time = opening_entry.period_end_date or get_datetime()
        
        # Try with Sales Invoice table as fallback
        sales_data = frappe.db.sql("""
            SELECT
                COUNT(si.name) as invoice_count,
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.net_total ELSE 0 END) -
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.net_total ELSE 0 END) as net_total,
                
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.total_taxes_and_charges ELSE 0 END) -
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.total_taxes_and_charges ELSE 0 END) as total_taxes,
                
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 0 THEN si.grand_total ELSE 0 END) -
                SUM(CASE WHEN si.docstatus = 1 AND si.is_return = 1 THEN si.grand_total ELSE 0 END) as grand_total
            FROM
                `tabSales Invoice` si
            WHERE
                si.pos_profile = %s
                AND si.owner = %s
                AND si.posting_date = %s
                AND si.posting_time >= %s
                AND si.posting_time <= %s
                AND si.is_pos = 1
                AND si.docstatus != 2
        """, (
            opening_entry.pos_profile,
            opening_entry.user,
            getdate(opening_entry.period_start_date),
            get_datetime(opening_entry.period_start_date).time(),
            get_datetime(end_time).time()
        ), as_dict=1)
        
        if sales_data:
            return {
                "invoice_count": sales_data[0].invoice_count or 0,
                "net_total": sales_data[0].net_total or 0,
                "total_taxes": sales_data[0].total_taxes or 0,
                "grand_total": sales_data[0].grand_total or 0
            }
    except:
        pass
    
    return {
        "invoice_count": 0,
        "net_total": 0,
        "total_taxes": 0,
        "grand_total": 0
    }