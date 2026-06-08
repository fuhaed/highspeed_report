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
    data = get_purchase_data(filters)
    
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
            "options": "Purchase Invoice",
            "width": 140
        },
        {
            "fieldname": "supplier_name",
            "label": _("Supplier"),
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
        },
        {
            "fieldname": "bill_no",
            "label": _("رقم فاتورة المورد"),
            "fieldtype": "Data",
            "width": 130
        }
    ]

def get_purchase_data(filters):
    """Get purchase data based on filters"""
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("pi.company = %(company)s")
    conditions.append("pi.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    
    # Filter by supplier if provided
    if filters.get("supplier"):
        conditions.append("pi.supplier = %(supplier)s")
        values["supplier"] = filters.get("supplier")
    
    # في هذه النسخة من ERPNext، لا يوجد جدول لطرق الدفع في فاتورة المشتريات
    # لذلك سنقوم بحذف مرشح طريقة الدفع من الاستعلام
    
    # Filter by cost center if provided
    if filters.get("cost_center"):
        conditions.append("pi_item.cost_center = %(cost_center)s")
        values["cost_center"] = filters.get("cost_center")
    
    # Filter by invoice status if provided
    if filters.get("status"):
        conditions.append("pi.status = %(status)s")
        values["status"] = filters.get("status")
    
    # Query to get purchase invoice data with cost center
    # Note: We're not using `tabPurchase Invoice Payment` as it doesn't exist in some ERPNext versions
    purchase_data = frappe.db.sql("""
        SELECT DISTINCT
            pi.posting_date,
            'Purchase Invoice' as voucher_type,
            pi.name as voucher_no,
            pi.supplier_name,
            pi.status,
            pi.is_return,
            pi.grand_total,
            pi_item.cost_center,
            NULL as mode_of_payment,
            pi.bill_no
        FROM
            `tabPurchase Invoice` pi
        LEFT JOIN
            `tabPurchase Invoice Item` pi_item ON pi.name = pi_item.parent
        WHERE
            {conditions}
        ORDER BY
            pi.posting_date DESC, pi.name
    """.format(
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    # Process and augment data
    data = []
    for row in purchase_data:
        # Get invoice status in Arabic
        invoice_status = get_arabic_status(row.status, row.is_return)
        
        # Add the purchase entry to the data
        data.append({
            "posting_date": row.posting_date,
            "voucher_type": _("Purchase Invoice") if row.voucher_type == "Purchase Invoice" else row.voucher_type,
            "voucher_no": row.voucher_no,
            "supplier_name": row.supplier_name,
            "invoice_status": invoice_status,
            "grand_total": flt(row.grand_total),
            "cost_center": row.cost_center or _("غير محدد"),
            "mode_of_payment": _("غير متاح"),
            "bill_no": row.bill_no or _("غير محدد")
        })
    
    # Add total row if we have data
    if data:
        total_amount = sum(row.get("grand_total", 0) for row in data)
        
        data.append({
            "voucher_type": None,
            "voucher_no": None,
            "supplier_name": _("Grand Total"),
            "grand_total": flt(total_amount),
            "is_total_row": True
        })
    
    return data

def get_arabic_status(status, is_return=0):
    """Convert invoice status to Arabic"""
    if is_return:
        return _("مرتجع مشتريات")
    
    status_map = {
        "Draft": _("مسودة"),
        "Submitted": _("مقدمة"),
        "Paid": _("مسددة بالكامل"),
        "Unpaid": _("غير مسددة"),
        "Partly Paid": _("مسددة جزئياً"),
        "Overdue": _("متأخرة السداد"),
        "Cancelled": _("ملغية"),
        "Debit Note Issued": _("إشعار مدين مصدر")
    }
    
    return status_map.get(status, status)
