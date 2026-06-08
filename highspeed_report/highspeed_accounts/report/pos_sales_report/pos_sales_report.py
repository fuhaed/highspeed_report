# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, cint
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
    data = get_pos_sales_data(filters)
    
    return columns, data

def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "name",
            "label": _("Invoice No"),
            "fieldtype": "Link",
            "options": "POS Invoice",
            "width": 140
        },
        {
            "fieldname": "customer_name",
            "label": _("Customer"),
            "fieldtype": "Data",
            "width": 180
        },
        {
            "fieldname": "grand_total",
            "label": _("Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "cashier",
            "label": _("الكاشير"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "mode_of_payment",
            "label": _("Payment Mode"),
            "fieldtype": "Data",
            "width": 130
        },
        {
            "fieldname": "remarks",
            "label": _("الملاحظات"),
            "fieldtype": "Data",
            "width": 200
        }
    ]

def get_pos_sales_data(filters):
    """Get POS sales data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("pi.company = %(company)s")
    conditions.append("pi.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    
    # Include docstatus check to ensure we get cancelled documents properly
    # In ERPNext: 0=Draft, 1=Submitted, 2=Cancelled
    # We don't filter by docstatus by default to allow all types
    
    # Filter by POS Profile if provided
    if filters.get("pos_profile"):
        conditions.append("pi.pos_profile = %(pos_profile)s")
        values["pos_profile"] = filters.get("pos_profile")
    
    # Filter by customer if provided
    if filters.get("customer"):
        conditions.append("pi.customer = %(customer)s")
        values["customer"] = filters.get("customer")
    
    # Filter by cashier if provided
    if filters.get("cashier"):
        conditions.append("pi.owner = %(cashier)s")
        values["cashier"] = filters.get("cashier")
    
    # Filter by mode of payment if provided
    if filters.get("mode_of_payment"):
        conditions.append("sip.mode_of_payment = %(mode_of_payment)s")
        values["mode_of_payment"] = filters.get("mode_of_payment")
    
    # Filter by invoice status if provided
    if filters.get("status"):
        # Handle the status filter with special consideration for cancelled
        if filters.get("status") == "Cancelled":
            conditions.append("pi.docstatus = 2")  # Explicitly check docstatus for cancelled
        else:
            conditions.append("pi.status = %(status)s")
            conditions.append("pi.docstatus < 2")  # Not cancelled
            values["status"] = filters.get("status")
    
    # Query to get POS invoice data with payment methods
    # Using CTE (Common Table Expression) for cleaner query structure
    pos_data = frappe.db.sql("""
        WITH payment_data AS (
            SELECT 
                sip.parent,
                GROUP_CONCAT(DISTINCT sip.mode_of_payment ORDER BY sip.mode_of_payment SEPARATOR ', ') as modes_of_payment
            FROM
                `tabSales Invoice Payment` sip
            GROUP BY
                sip.parent
        ),
        reference_data AS (
            SELECT
                per.reference_name,
                GROUP_CONCAT(DISTINCT pe.name ORDER BY pe.creation SEPARATOR ', ') as payment_entries,
                GROUP_CONCAT(DISTINCT pe.reference_no ORDER BY pe.creation SEPARATOR ', ') as payment_references
            FROM
                `tabPayment Entry Reference` per
            JOIN
                `tabPayment Entry` pe ON per.parent = pe.name
            WHERE
                per.reference_doctype = 'POS Invoice'
            GROUP BY
                per.reference_name
        )
        SELECT
            pi.posting_date,
            pi.name,
            pi.docstatus,
            rd.payment_entries,
            rd.payment_references as payment_reference,
            pi.customer_name,
            pi.status,
            pi.is_return,
            pi.grand_total,
            pi.remarks,
            pi.owner as cashier,
            pd.modes_of_payment as mode_of_payment
        FROM
            `tabPOS Invoice` pi
        LEFT JOIN
            payment_data pd ON pi.name = pd.parent
        LEFT JOIN
            reference_data rd ON pi.name = rd.reference_name
        WHERE
            {conditions}
        ORDER BY
            pi.posting_date DESC, pi.name
    """.format(
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    # Process and augment data
    data = []
    total_amount = 0
    
    for row in pos_data:
        # Get username for cashier
        cashier = frappe.db.get_value("User", row.cashier, "full_name") if row.cashier else ""
        
        # Get payment reference or reference number
        payment_reference = row.payment_reference or ""
        
        # Determine accurate status
        status = row.status
        
        # Override status for docstatus=2 to ensure cancelled documents show correctly
        if row.docstatus == 2:
            status = "Cancelled"
        
        # For return invoices, explicitly set status as Return if not already
        if row.is_return and status != "Return":
            status = "Return"
        
        # Calculate the amount (negative for returns)
        amount = flt(row.grand_total)
        
        # Add to total (we'll still track cancelled and returns in total for accounting)
        if status != "Cancelled":  # Don't include cancelled invoices in totals
            total_amount += amount
        
        # Add the POS entry to the data
        data.append({
            "posting_date": row.posting_date,
            "name": row.name,
            "customer_name": row.customer_name,
            "status": status,
            "grand_total": amount,
            "cashier": cashier,
            "mode_of_payment": row.mode_of_payment or _("غير محدد"),
            "remarks": row.remarks or ""
        })
    
    # Add total row if we have data
    if data:
        data.append({
            "name": None,
            "customer_name": _("Grand Total"),
            "grand_total": flt(total_amount),
            "is_total_row": True
        })
    
    return data