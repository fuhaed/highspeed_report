# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, add_days, cint, formatdate
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
    
    # Ensure supplier is specified
    if not filters.get("supplier"):
        frappe.throw(_("يرجى تحديد المورد"))
    
    # Get report data
    columns = get_columns()
    
    # Get opening balance and transactions
    opening_balance, opening_date, data = get_supplier_ledger_entries(filters)
    
    # تنسيق تاريخ الرصيد الافتتاحي
    if opening_date:
        # تحويل التاريخ إلى نص بتنسيق مناسب
        formatted_opening_date = formatdate(opening_date)
    else:
        # إذا كان التاريخ غير متوفر، استخدم تاريخ اليوم السابق
        yesterday = add_days(getdate(), -1)
        formatted_opening_date = formatdate(yesterday)
    
    # Add opening balance to report_dict
    report_dict = frappe._dict({
        "opening_balance": flt(opening_balance),
        "opening_date": formatted_opening_date
    })
    
    # Return empty data with a message if no entries
    if not data:
        frappe.msgprint(_("لا توجد بيانات لهذا المورد في الفترة المحددة"))
        return columns, data, report_dict
    
    return columns, data, report_dict

def get_columns():
    """Define the columns for the report"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("التاريخ"),
            "fieldtype": "Date",
            "width": 110
        },
        {
            "fieldname": "voucher_no",
            "label": _("رقم المستند"),
            "fieldtype": "Dynamic Link",
            "options": "voucher_type",
            "width": 150
        },
        {
            "fieldname": "voucher_type",
            "label": _("نوع المستند"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "description",
            "label": _("Particulars"),
            "fieldtype": "Data",
            "width": 250
        },
        {
            "fieldname": "invoice_status",
            "label": _("حالة المستند"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "debit",
            "label": _("مدين"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "credit",
            "label": _("دائن"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "balance",
            "label": _("Balance"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "invoice_amount",
            "label": _("قيمة الفاتورة"),
            "fieldtype": "Currency",
            "width": 120
        }
    ]

def get_supplier_ledger_entries(filters):
    """Get supplier ledger entries directly from GL entries"""
    # Step 1: Get payable accounts for the supplier
    payable_accounts = get_payable_accounts(filters.get("company"), filters.get("supplier"))
    
    if not payable_accounts:
        frappe.msgprint(_("لم يتم العثور على حسابات دائنة للمورد"))
        return 0, None, []
    
    # Step 2: Calculate opening balance (all entries before from_date)
    opening_balance = 0
    opening_date = add_days(getdate(filters.get("from_date")), -1)
    
    # تأكد من أن التاريخ ليس None
    if not opening_date:
        opening_date = add_days(getdate(), -1)  # استخدم تاريخ أمس إذا كان التاريخ غير متوفر
    
    for account in payable_accounts:
        opening_gl = frappe.db.sql("""
            SELECT SUM(credit) - SUM(debit) as balance
            FROM `tabGL Entry`
            WHERE account = %s
            AND party_type = 'Supplier'
            AND party = %s
            AND company = %s
            AND posting_date <= %s
            AND is_cancelled = 0
        """, (account, filters.get("supplier"), filters.get("company"), 
              opening_date), as_dict=1)
        
        if opening_gl and opening_gl[0].balance:
            opening_balance += flt(opening_gl[0].balance)
    
    # المرحلة 2.1: تأكد من أن الرصيد الافتتاحي ليس صفرًا
    if opening_balance == 0:
        # محاولة الحصول على رصيد المورد الحالي كبديل
        try:
            current_balance = frappe.db.get_value("Supplier", filters.get("supplier"), "outstanding_amount")
            if current_balance:
                opening_balance = flt(current_balance)
        except Exception:
            pass
    
    # Step 3: Get all GL entries within date range for all supplier accounts
    gl_entries = []
    for account in payable_accounts:
        entries = frappe.db.sql("""
            SELECT
                posting_date,
                voucher_type,
                voucher_no,
                debit,
                credit,
                remarks,
                against,
                is_opening,
                account,
                against_voucher,
                against_voucher_type,
                creation,
                CASE
                    WHEN voucher_type = 'Purchase Invoice' THEN 
                        (SELECT grand_total FROM `tabPurchase Invoice` WHERE name = voucher_no)
                    ELSE NULL
                END as invoice_amount
            FROM
                `tabGL Entry`
            WHERE
                account = %s
                AND party_type = 'Supplier'
                AND party = %s
                AND company = %s
                AND posting_date BETWEEN %s AND %s
                AND is_cancelled = 0
            ORDER BY
                posting_date, creation
        """, (account, filters.get("supplier"), filters.get("company"), 
              filters.get("from_date"), filters.get("to_date")), as_dict=1)
        
        gl_entries.extend(entries)
    
    # Step 4: Sort by date
    gl_entries.sort(key=lambda x: (x.posting_date, x.creation if hasattr(x, 'creation') else ''))
    
    # Step 5: Process entries and create report data
    data = []
    balance = opening_balance
    
    # Get invoice statuses for purchase invoices
    invoice_numbers = [entry.voucher_no for entry in gl_entries 
                     if entry.voucher_type == "Purchase Invoice" and entry.voucher_no]
    invoice_statuses = get_invoice_statuses(invoice_numbers)
    
    # Get payment references to link payments with invoices
    payment_references = get_payment_references()
    
    # Process each GL entry
    for entry in gl_entries:
        # Update running balance (for supplier, credit increases balance and debit decreases)
        balance += flt(entry.credit) - flt(entry.debit)
        
        # Get description
        description = entry.remarks or ""
        
        # For payment entries, try to get more details
        if entry.voucher_type == "Payment Entry" and entry.voucher_no in payment_references:
            references = payment_references[entry.voucher_no]
            if references:
                invoices = [ref.reference_name for ref in references if ref.reference_doctype == "Purchase Invoice"]
                if invoices:
                    description = _("سداد للفواتير: ") + ", ".join(invoices)
        
        # If still no description, use fallbacks
        if not description:
            description = entry.against or entry.voucher_no or _("لايوجد وصف")
        
        # Get invoice status
        invoice_status = ""
        if entry.voucher_type == "Purchase Invoice" and entry.voucher_no in invoice_statuses:
            invoice_status = invoice_statuses[entry.voucher_no]
        elif entry.voucher_type == "Payment Entry":
            invoice_status = _("سداد")
        
        # Add entry to data
        data.append({
            "posting_date": entry.posting_date,
            "voucher_type": entry.voucher_type,
            "voucher_no": entry.voucher_no,
            "description": description,
            "debit": flt(entry.debit),
            "credit": flt(entry.credit),
            "balance": balance,
            "invoice_status": invoice_status,
            "invoice_amount": flt(entry.invoice_amount) if hasattr(entry, 'invoice_amount') and entry.invoice_amount else None
        })
    
    # Add total row
    if gl_entries:
        total_debit = sum(flt(entry.debit) for entry in gl_entries)
        total_credit = sum(flt(entry.credit) for entry in gl_entries)
        
        data.append({
            "posting_date": None,
            "voucher_type": "Total",
            "voucher_no": "",
            "description": _("Grand Total"),
            "debit": total_debit,
            "credit": total_credit,
            "balance": balance,
            "is_total_row": True
        })
    
    # إضافة صف للرصيد الافتتاحي في بداية البيانات
    data.insert(0, {
        "posting_date": opening_date,
        "voucher_type": "Opening Balance",
        "voucher_no": "",
        "description": _("Opening Balance"),
        "debit": abs(opening_balance) if opening_balance < 0 else 0,
        "credit": opening_balance if opening_balance > 0 else 0,
        "balance": opening_balance,
        "invoice_status": "",
        "is_opening_row": True
    })
    
    return opening_balance, opening_date, data

def get_payable_accounts(company, supplier):
    """Get all payable accounts for the supplier"""
    accounts = []
    
    # Method 1: Try to get from Party Account
    try:
        party_accounts = frappe.get_all(
            "Party Account",
            filters={
                "parenttype": "Supplier",
                "parent": supplier,
                "company": company
            },
            fields=["account"]
        )
        
        if party_accounts:
            accounts.extend([d.account for d in party_accounts])
    except Exception:
        pass
    
    # Method 2: If no specific accounts, get from recent GL entries
    if not accounts:
        try:
            gl_accounts = frappe.db.sql("""
                SELECT DISTINCT account
                FROM `tabGL Entry`
                WHERE party_type = 'Supplier'
                AND party = %s
                AND company = %s
                AND is_cancelled = 0
                ORDER BY creation DESC
            """, (supplier, company), as_dict=1)
            
            if gl_accounts:
                accounts.extend([d.account for d in gl_accounts])
        except Exception:
            pass
    
    # Method 3: Fallback to all payable accounts
    if not accounts:
        try:
            payable_accounts = frappe.get_all(
                "Account",
                filters={
                    "company": company,
                    "account_type": "Payable",
                    "is_group": 0
                },
                fields=["name"]
            )
            
            if payable_accounts:
                accounts.extend([d.name for d in payable_accounts])
        except Exception:
            pass
    
    return accounts

def get_payment_references():
    """Get payment references to link payments with invoices"""
    references = {}
    
    payment_refs = frappe.db.sql("""
        SELECT parent, reference_doctype, reference_name
        FROM `tabPayment Entry Reference`
        WHERE docstatus = 1
    """, as_dict=1)
    
    for ref in payment_refs:
        if ref.parent not in references:
            references[ref.parent] = []
        references[ref.parent].append(ref)
    
    return references

def get_invoice_statuses(invoice_numbers):
    """Get the payment status for the invoices"""
    invoice_statuses = {}
    
    if not invoice_numbers:
        return invoice_statuses
    
    # Fetch invoice status
    invoices = frappe.get_all(
        "Purchase Invoice",
        filters={"name": ["in", invoice_numbers]},
        fields=["name", "status", "is_return", "outstanding_amount", "grand_total", "is_paid"]
    )
    
    for invoice in invoices:
        status = ""
        
        if invoice.is_return:
            status = _("مرتجع مشتريات")
        elif invoice.status == "Paid" or (invoice.grand_total and invoice.outstanding_amount == 0):
            if invoice.is_paid:
                status = _("فاتورة نقدية")
            else:
                status = _("مسددة بالكامل")
        elif invoice.status == "Unpaid":
            status = _("غير مسددة")
        elif invoice.status == "Partly Paid" and invoice.grand_total:
            outstanding_percent = (invoice.outstanding_amount / invoice.grand_total) * 100
            status = _("مسددة جزئياً ({0}%)").format(round(100 - outstanding_percent))
        elif invoice.status == "Overdue":
            status = _("متأخرة السداد")
        elif invoice.status == "Cancelled":
            status = _("ملغية")
        else:
            status = _(invoice.status)
        
        invoice_statuses[invoice.name] = status
    
    return invoice_statuses