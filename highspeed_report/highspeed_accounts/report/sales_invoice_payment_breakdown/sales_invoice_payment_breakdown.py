# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import datetime

def execute(filters=None):
    if not filters:
        filters = {}
    
    if not filters.get("from_date"):
        filters["from_date"] = datetime.date.today().replace(day=1)
    
    if not filters.get("to_date"):
        filters["to_date"] = datetime.date.today()
    
    if not filters.get("from_time"):
        filters["from_time"] = "00:00:00"
    
    if not filters.get("to_time"):
        filters["to_time"] = "23:59:59"
    
    columns = get_columns()
    data = get_payment_breakdown_data(filters)
    
    return columns, data

def get_columns():
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "posting_time",
            "label": _("الوقت"),
            "fieldtype": "Time",
            "width": 80
        },
        {
            "fieldname": "voucher_no",
            "label": _("Invoice No"),
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
            "fieldname": "mode_of_payment",
            "label": _("Payment Mode"),
            "fieldtype": "Data",
            "width": 130
        },
        {
            "fieldname": "payment_amount",
            "label": _("Payment Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "multiple_payments",
            "label": _("دفع متعدد"),
            "fieldtype": "Data",
            "width": 80
        },
        {
            "fieldname": "invoice_total",
            "label": _("إجمالي الفاتورة"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "tax_amount",
            "label": _("Tax"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة الفاتورة"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "pos_profile",
            "label": _("نقطة البيع"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "owner",
            "label": _("المستخدم"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "warehouse",
            "label": _("المستودع"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "cost_center",
            "label": _("Cost Center"),
            "fieldtype": "Data",
            "width": 140
        },
        {
            "fieldname": "account",
            "label": _("Account"),
            "fieldtype": "Data",
            "width": 140
        }
    ]

def get_payment_breakdown_data(filters):
    conditions = []
    values = {
        "company": filters.get("company"),
        "from_date": filters.get("from_date"),
        "to_date": filters.get("to_date")
    }
    
    conditions.append("si.company = %(company)s")
    conditions.append("si.posting_date BETWEEN %(from_date)s AND %(to_date)s")
    conditions.append("si.docstatus = 1")
    conditions.append("si.status NOT IN ('Draft', 'Cancelled')")
    
    if filters.get("from_time") and filters.get("to_time"):
        conditions.append("""
            CONCAT(si.posting_date, ' ', si.posting_time) BETWEEN 
            CONCAT(%(from_date)s, ' ', %(from_time)s) AND 
            CONCAT(%(to_date)s, ' ', %(to_time)s)
        """)
        values["from_time"] = filters.get("from_time")
        values["to_time"] = filters.get("to_time")
    
    if filters.get("customer"):
        conditions.append("si.customer = %(customer)s")
        values["customer"] = filters.get("customer")
    
    if filters.get("mode_of_payment"):
        if isinstance(filters.get("mode_of_payment"), list):
            mode_of_payment_list = filters.get("mode_of_payment")
            if mode_of_payment_list:
                placeholders = ", ".join([f"%(mode_of_payment_{i})s" for i in range(len(mode_of_payment_list))])
                conditions.append(f"sip.mode_of_payment IN ({placeholders})")
                for i, mode in enumerate(mode_of_payment_list):
                    values[f"mode_of_payment_{i}"] = mode
        else:
            conditions.append("sip.mode_of_payment = %(mode_of_payment)s")
            values["mode_of_payment"] = filters.get("mode_of_payment")
    
    if filters.get("cost_center"):
        if isinstance(filters.get("cost_center"), list):
            cost_center_list = filters.get("cost_center")
            if cost_center_list:
                placeholders = ", ".join([f"%(cost_center_{i})s" for i in range(len(cost_center_list))])
                conditions.append(f"si_item.cost_center IN ({placeholders})")
                for i, center in enumerate(cost_center_list):
                    values[f"cost_center_{i}"] = center
        else:
            conditions.append("si_item.cost_center = %(cost_center)s")
            values["cost_center"] = filters.get("cost_center")
    
    if filters.get("pos_profile"):
        if isinstance(filters.get("pos_profile"), list):
            pos_profile_list = filters.get("pos_profile")
            if pos_profile_list:
                placeholders = ", ".join([f"%(pos_profile_{i})s" for i in range(len(pos_profile_list))])
                conditions.append(f"si.pos_profile IN ({placeholders})")
                for i, profile in enumerate(pos_profile_list):
                    values[f"pos_profile_{i}"] = profile
        else:
            conditions.append("si.pos_profile = %(pos_profile)s")
            values["pos_profile"] = filters.get("pos_profile")
    
    if filters.get("owner"):
        if isinstance(filters.get("owner"), list):
            owner_list = filters.get("owner")
            if owner_list:
                placeholders = ", ".join([f"%(owner_{i})s" for i in range(len(owner_list))])
                conditions.append(f"si.owner IN ({placeholders})")
                for i, owner in enumerate(owner_list):
                    values[f"owner_{i}"] = owner
        else:
            conditions.append("si.owner = %(owner)s")
            values["owner"] = filters.get("owner")
    
    if filters.get("warehouse"):
        if isinstance(filters.get("warehouse"), list):
            warehouse_list = filters.get("warehouse")
            if warehouse_list:
                placeholders = ", ".join([f"%(warehouse_{i})s" for i in range(len(warehouse_list))])
                conditions.append(f"si_item.warehouse IN ({placeholders})")
                for i, warehouse in enumerate(warehouse_list):
                    values[f"warehouse_{i}"] = warehouse
        else:
            conditions.append("si_item.warehouse = %(warehouse)s")
            values["warehouse"] = filters.get("warehouse")
    
    if filters.get("status") and filters.get("status") not in ['Draft', 'Cancelled']:
        conditions.append("si.status = %(status)s")
        values["status"] = filters.get("status")
    
    payment_data = frappe.db.sql("""
        SELECT DISTINCT
            si.posting_date,
            si.posting_time,
            si.name as voucher_no,
            si.customer_name,
            sip.mode_of_payment,
            sip.amount as payment_amount,
            si.grand_total as invoice_total,
            si.total_taxes_and_charges as tax_amount,
            si.status,
            si.is_return,
            si.pos_profile,
            si.owner,
            COALESCE(si_item.warehouse, '') as warehouse,
            COALESCE(si_item.cost_center, '') as cost_center,
            sip.account
        FROM
            `tabSales Invoice` si
        INNER JOIN
            `tabSales Invoice Payment` sip ON si.name = sip.parent
        LEFT JOIN
            `tabSales Invoice Item` si_item ON si.name = si_item.parent
        WHERE
            {conditions}
        ORDER BY
            si.posting_date DESC, si.posting_time DESC, si.name, sip.idx
    """.format(
        conditions=" AND ".join(conditions)
    ), values, as_dict=1)
    
    invoice_payment_counts = {}
    unique_invoices = {}
    
    for row in payment_data:
        invoice_no = row.voucher_no
        if invoice_no not in invoice_payment_counts:
            invoice_payment_counts[invoice_no] = 0
            unique_invoices[invoice_no] = {
                'invoice_total': row.invoice_total,
                'tax_amount': row.tax_amount
            }
        invoice_payment_counts[invoice_no] += 1
    
    data = []
    for row in payment_data:
        invoice_status = get_arabic_status(row.status, row.is_return)
        user_fullname = frappe.db.get_value("User", row.owner, "full_name") if row.owner else ""
        
        posting_date = row.posting_date or ""
        posting_time = row.posting_time or ""
        voucher_no = row.voucher_no or ""
        customer_name = row.customer_name or _("غير محدد")
        mode_of_payment = row.mode_of_payment or _("غير محدد")
        payment_amount = float(row.payment_amount or 0)
        invoice_total = float(row.invoice_total or 0)
        multiple_payments = "✓" if invoice_payment_counts.get(row.voucher_no, 0) > 1 else ""
        tax_amount = float(row.tax_amount or 0)
        pos_profile = row.pos_profile or _("غير محدد")
        owner = user_fullname or row.owner or _("غير محدد")
        warehouse = row.warehouse or _("غير محدد")
        cost_center = row.cost_center or _("غير محدد")
        account = row.account or _("غير محدد")
        
        data.append({
            "posting_date": posting_date,
            "posting_time": posting_time,
            "voucher_no": voucher_no,
            "customer_name": customer_name,
            "mode_of_payment": mode_of_payment,
            "payment_amount": payment_amount,
            "multiple_payments": multiple_payments,
            "invoice_total": invoice_total,
            "tax_amount": tax_amount,
            "invoice_status": invoice_status,
            "pos_profile": pos_profile,
            "owner": owner,
            "warehouse": warehouse,
            "cost_center": cost_center,
            "account": account
        })
    
    if data:
        total_payments = sum(row['payment_amount'] for row in data)
        total_invoices_amount = sum(unique_invoices[inv]['invoice_total'] for inv in unique_invoices)
        total_tax_amount = sum(unique_invoices[inv]['tax_amount'] for inv in unique_invoices)
        
        data.append({
            "posting_date": "",
            "posting_time": "",
            "voucher_no": _("Grand Total"),
            "customer_name": "",
            "mode_of_payment": "",
            "payment_amount": total_payments,
            "multiple_payments": "",
            "invoice_total": total_invoices_amount,
            "tax_amount": total_tax_amount,
            "invoice_status": "",
            "pos_profile": "",
            "owner": "",
            "warehouse": "",
            "cost_center": "",
            "account": "",
            "is_total_row": 1
        })
    
    return data

def get_arabic_status(status, is_return=0):
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