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
    data = get_sales_data(filters)
    
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
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 140
        },
        {
            "fieldname": "customer_name",
            "label": _("Customer"),
            "fieldtype": "Data",
            "width": 180
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة الفاتورة"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "tax_amount",
            "label": _("Tax"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "grand_total",
            "label": _("Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "cost_center",
            "label": _("Cost Center"),
            "fieldtype": "Data",
            "width": 140
        },
        {
            "fieldname": "mode_of_payment",
            "label": _("Payment Mode"),
            "fieldtype": "Data",
            "width": 130
        }
    ]

def get_sales_data(filters):
    """Get sales data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("si.company = %(company)s")
    conditions.append("si.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    
    # Filter by customer if provided
    if filters.get("customer"):
        conditions.append("si.customer = %(customer)s")
        values["customer"] = filters.get("customer")
    
    # Filter by mode of payment if provided
    if filters.get("mode_of_payment"):
        conditions.append("sip.mode_of_payment = %(mode_of_payment)s")
        values["mode_of_payment"] = filters.get("mode_of_payment")
    
    # Filter by cost center if provided
    if filters.get("cost_center"):
        conditions.append("si_item.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")
    
    # Filter by invoice status if provided
    if filters.get("status"):
        conditions.append("si.status = %(status)s")
        values["status"] = filters.get("status")
    
    # Query to get sales invoice data with payment method and cost center
    sales_data = frappe.db.sql("""
        SELECT DISTINCT
            si.posting_date,
            'Sales Invoice' as voucher_type,
            si.name as voucher_no,
            si.customer_name,
            si.status,
            si.is_return,
            si.total_taxes_and_charges as tax_amount,
            si.grand_total,
            si_item.cost_center,
            sip.mode_of_payment
        FROM
            `tabSales Invoice` si
        LEFT JOIN
            `tabSales Invoice Payment` sip ON si.name = sip.parent
        LEFT JOIN
            `tabSales Invoice Item` si_item ON si.name = si_item.parent
        WHERE
            {conditions}
        ORDER BY
            si.posting_date DESC, si.name
    """.format(
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    # Process and augment data
    data = []
    for row in sales_data:
        # Get invoice status in Arabic
        invoice_status = get_arabic_status(row.status, row.is_return)
        
        # Add the sales entry to the data
        data.append({
            "posting_date": row.posting_date,
            "voucher_type": _("Sales Invoice") if row.voucher_type == "Sales Invoice" else row.voucher_type,
            "voucher_no": row.voucher_no,
            "customer_name": row.customer_name,
            "invoice_status": invoice_status,
            "tax_amount": flt(row.tax_amount or 0),
            "grand_total": flt(row.grand_total),
            "cost_center": row.cost_center or _("غير محدد"),
            "mode_of_payment": row.mode_of_payment or _("غير محدد")
        })
    
    # Add total row if we have data
    if data:
        total_amount = sum(row.get("grand_total", 0) for row in data)
        total_tax = sum(row.get("tax_amount", 0) for row in data)
        
        data.append({
            "voucher_type": None,
            "voucher_no": None,
            "customer_name": _("Grand Total"),
            "tax_amount": flt(total_tax),
            "grand_total": flt(total_amount),
            "is_total_row": True
        })
    
    return data

def get_arabic_status(status, is_return=0):
    """Convert invoice status to Arabic"""
    if is_return:
        return _("مرتجع مبيعات")
    
    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدمة"),
        "Paid": _("مسددة بالكامل"),
        "Unpaid": _("غير مسددة"),
        "Partly Paid": _("مسددة جزئياً"),
        "Overdue": _("متأخرة السداد"),
        "Cancelled": _("ملغية"),
        "Credit Note Issued": _("إشعار دائن مصدر")
    }
    
    return status_map.get(status, status)